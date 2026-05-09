import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ensureAwsTextractSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/aws-textract/aws-textract'

const tempDirs: string[] = []
const previousEnv: Record<string, string | undefined> = {}
const envKeys = [
  'AUTOSHOW_AWS_BIN',
  'AWS_REGION',
  'AWS_DEFAULT_REGION'
]

type FakeAwsMode = 'created' | 'accessible' | 'unavailable'

const writeFakeAws = async (
  dir: string,
  mode: FakeAwsMode
): Promise<{ bin: string, log: string }> => {
  const bin = join(dir, 'aws')
  const log = join(dir, 'aws.log')
  const createdBucket = join(dir, 'created-bucket.txt')
  await writeFile(log, '')
  await writeFile(bin, `#!/bin/sh
MODE="${mode}"
echo "$@" >> "${log}"

read_bucket_arg() {
  BUCKET_VALUE=""
  while [ "$#" -gt 0 ]; do
    if [ "$1" = "--bucket" ]; then
      shift
      BUCKET_VALUE="$1"
      break
    fi
    shift
  done
}

if [ "$1 $2" = "sts get-caller-identity" ]; then
  echo '{"Account":"123456789012","Arn":"arn:aws:iam::123456789012:user/test","UserId":"test-user"}'
  exit 0
fi
if [ "$1 $2 $3" = "configure get region" ]; then
  exit 1
fi
if [ "$1 $2" = "s3api head-bucket" ]; then
  read_bucket_arg "$@"
  if [ "$MODE" = "accessible" ] && [ "$BUCKET_VALUE" = "existing-textract-bucket" ]; then
    exit 0
  fi
  if [ "$MODE" = "created" ] && [ -f "${createdBucket}" ]; then
    test "$BUCKET_VALUE" = "$(cat "${createdBucket}")"
    exit $?
  fi
  echo "An error occurred (404) when calling the HeadBucket operation: Not Found" >&2
  exit 1
fi
if [ "$1 $2" = "s3api create-bucket" ]; then
  read_bucket_arg "$@"
  if [ "$MODE" = "unavailable" ]; then
    echo "An error occurred (BucketAlreadyExists) when calling the CreateBucket operation: The requested bucket name is not available." >&2
    exit 1
  fi
  echo "$BUCKET_VALUE" > "${createdBucket}"
  exit 0
fi
if [ "$1 $2 $3" = "s3api wait bucket-exists" ]; then
  exit 0
fi
exit 1
`)
  await chmod(bin, 0o755)
  return { bin, log }
}

beforeEach(() => {
  for (const key of envKeys) {
    previousEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(async () => {
  for (const key of envKeys) {
    if (previousEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = previousEnv[key]
    }
  }
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('aws textract setup contracts', () => {
  test('auto-creates a missing staging bucket and saves shared AWS defaults', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-aws-textract-create-'))
    tempDirs.push(dir)
    const configPath = join(dir, 'autoshow.json')
    const { bin, log } = await writeFakeAws(dir, 'created')
    process.env['AUTOSHOW_AWS_BIN'] = bin

    const setup = await ensureAwsTextractSetup({
      preferredRegion: 'us-east-2',
      configPath,
      requireBucket: true
    })

    expect(setup.region).toBe('us-east-2')
    expect(setup.configPath).toBe(configPath)
    expect(setup.bucket).toMatch(/^autoshow-aws-123456789012-us-east-2-[a-f0-9]{10}$/)

    const commands = await readFile(log, 'utf8')
    expect(commands).toContain('sts get-caller-identity --output json')
    expect(commands).toContain(`s3api create-bucket --bucket ${setup.bucket} --region us-east-2`)
    expect(commands).toContain(`s3api wait bucket-exists --bucket ${setup.bucket} --region us-east-2`)
    expect(commands).toContain(`s3api head-bucket --bucket ${setup.bucket} --region us-east-2`)

    const saved = JSON.parse(await readFile(configPath, 'utf8')) as {
      defaults?: { extract?: { stt?: { awsRegion?: string, awsBucket?: string } } }
    }
    expect(saved.defaults?.extract?.stt?.awsRegion).toBe('us-east-2')
    expect(saved.defaults?.extract?.stt?.awsBucket).toBe(setup.bucket)
  })

  test('reuses an accessible explicit bucket without creating it', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-aws-textract-accessible-'))
    tempDirs.push(dir)
    const configPath = join(dir, 'autoshow.json')
    const { bin, log } = await writeFakeAws(dir, 'accessible')
    process.env['AUTOSHOW_AWS_BIN'] = bin

    const setup = await ensureAwsTextractSetup({
      preferredRegion: 'us-west-2',
      preferredBucket: 'existing-textract-bucket',
      configPath,
      requireBucket: true
    })

    expect(setup.region).toBe('us-west-2')
    expect(setup.bucket).toBe('existing-textract-bucket')

    const commands = await readFile(log, 'utf8')
    expect(commands).toContain('s3api head-bucket --bucket existing-textract-bucket --region us-west-2')
    expect(commands).not.toContain('s3api create-bucket')
  })

  test('surfaces a useful error when an explicit bucket name is globally unavailable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-aws-textract-unavailable-'))
    tempDirs.push(dir)
    const configPath = join(dir, 'autoshow.json')
    const { bin, log } = await writeFakeAws(dir, 'unavailable')
    process.env['AUTOSHOW_AWS_BIN'] = bin

    await expect(ensureAwsTextractSetup({
      preferredRegion: 'us-east-1',
      preferredBucket: 'unavailable-textract-bucket',
      configPath,
      requireBucket: true
    })).rejects.toThrow('unavailable globally')

    const commands = await readFile(log, 'utf8')
    expect(commands).toContain('s3api head-bucket --bucket unavailable-textract-bucket --region us-east-1')
    expect(commands).toContain('s3api create-bucket --bucket unavailable-textract-bucket --region us-east-1')
    expect(await Bun.file(configPath).exists()).toBe(false)
  })
})
