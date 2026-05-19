import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config/config-loader'
import { setupAwsStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/aws/aws'

const tempDirs: string[] = []
const previousEnv: Record<string, string | undefined> = {}
const envKeys = [
  'AUTOSHOW_AWS_BIN',
  'AWS_REGION',
  'AWS_DEFAULT_REGION'
]

const writeFakeAws = async (dir: string): Promise<{ bin: string, log: string }> => {
  const bin = join(dir, 'aws')
  const log = join(dir, 'aws.log')
  const createdBucket = join(dir, 'created-bucket.txt')
  await writeFile(log, '')
  await writeFile(bin, `#!/bin/sh
echo "$@" >> "${log}"
if [ "$1 $2" = "sts get-caller-identity" ]; then
  echo '{"Account":"123456789012","Arn":"arn:aws:iam::123456789012:user/test","UserId":"test-user"}'
  exit 0
fi
if [ "$1 $2 $3" = "configure get region" ]; then
  echo "us-east-1"
  exit 0
fi
if [ "$1 $2" = "transcribe list-transcription-jobs" ]; then
  echo '{"TranscriptionJobSummaries":[]}'
  exit 0
fi
if [ "$1 $2" = "s3api create-bucket" ]; then
  echo "created" > "${createdBucket}"
  exit 0
fi
if [ "$1 $2 $3" = "s3api wait bucket-exists" ]; then
  exit 0
fi
if [ "$1 $2" = "s3api head-bucket" ]; then
  test -f "${createdBucket}"
  exit $?
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

describe('aws setup contracts', () => {
  test('checks readiness without creating a bucket by default', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-aws-setup-'))
    tempDirs.push(dir)
    const configPath = join(dir, 'autoshow.json')
    const { bin, log } = await writeFakeAws(dir)
    process.env['AUTOSHOW_AWS_BIN'] = bin

    await setupAwsStt({
      focused: true,
      preferredRegion: 'us-east-1',
      verifyTranscribe: true,
      configPathOverride: configPath
    })

    const commands = await readFile(log, 'utf8')
    expect(commands).toContain('sts get-caller-identity')
    expect(commands).toContain('transcribe list-transcription-jobs')
    expect(commands).not.toContain('s3api create-bucket')
    expect(await Bun.file(configPath).exists()).toBe(false)
  })

  test('creates requested bucket and saves shared AWS defaults', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autoshow-aws-setup-create-'))
    tempDirs.push(dir)
    const configPath = join(dir, 'autoshow.json')
    const { bin, log } = await writeFakeAws(dir)
    process.env['AUTOSHOW_AWS_BIN'] = bin

    await setupAwsStt({
      focused: true,
      preferredRegion: 'us-east-2',
      preferredBucket: 'autoshow-transcribe-test',
      autoCreateBucket: true,
      verifyTranscribe: true,
      configPathOverride: configPath
    })

    const commands = await readFile(log, 'utf8')
    expect(commands).toContain('s3api create-bucket --bucket autoshow-transcribe-test --region us-east-2')
    expect(commands).toContain('s3api head-bucket --bucket autoshow-transcribe-test --region us-east-2')
    await expect(loadConfig(configPath)).resolves.toMatchObject({
      defaults: {
        extract: {
          stt: {
            awsStt: ['standard'],
            awsRegion: 'us-east-2',
            awsBucket: 'autoshow-transcribe-test'
          }
        }
      }
    })
  })
})
