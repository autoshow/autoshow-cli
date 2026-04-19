import { afterEach, beforeEach, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config/config-loader'
import {
  ensureAwsSttSetup,
  readAwsSttReadiness,
  setupAwsStt
} from '~/cli/commands/process-steps/step-2-stt/stt-services/aws/aws'
import { ensureSttTargetSetup } from '~/cli/commands/process-steps/step-2-stt/bootstrap'

const FAKE_AWS_REGION = 'us-east-2'

let tempDir = ''
let configPath = ''
let statePath = ''
let originalPath = ''
let originalAwsState = ''
let originalAwsBin = ''

const writeFakeAwsBinary = async (targetPath: string): Promise<void> => {
  await writeFile(targetPath, `#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const statePath = process.env['AUTOSHOW_TEST_AWS_STATE']
if (!statePath) {
  console.error('missing AUTOSHOW_TEST_AWS_STATE')
  process.exit(1)
}

const readState = () => existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, 'utf8'))
  : { buckets: [] }
const writeState = (state) => writeFileSync(statePath, JSON.stringify(state))
const args = process.argv.slice(2)
const readFlag = (name) => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}
const bucket = readFlag('--bucket')
const region = readFlag('--region') ?? '${FAKE_AWS_REGION}'

if (args[0] === 'sts' && args[1] === 'get-caller-identity') {
  console.log(JSON.stringify({
    Account: '123456789012',
    Arn: 'arn:aws:iam::123456789012:user/autoshow-test',
    UserId: 'AUTOSHOWTEST'
  }))
  process.exit(0)
}

if (args[0] === 'configure' && args[1] === 'get' && args[2] === 'region') {
  console.log(region)
  process.exit(0)
}

if (args[0] === 'transcribe' && args[1] === 'list-transcription-jobs') {
  console.log(JSON.stringify({ TranscriptionJobSummaries: [] }))
  process.exit(0)
}

if (args[0] === 's3api' && args[1] === 'head-bucket') {
  const state = readState()
  if (bucket && state.buckets.includes(bucket)) {
    process.exit(0)
  }
  console.error('Not Found')
  process.exit(255)
}

if (args[0] === 's3api' && args[1] === 'create-bucket') {
  const state = readState()
  if (bucket && !state.buckets.includes(bucket)) {
    state.buckets.push(bucket)
    writeState(state)
  }
  console.log(JSON.stringify({ Location: '/' + (bucket ?? '') }))
  process.exit(0)
}

if (args[0] === 's3api' && args[1] === 'wait' && args[2] === 'bucket-exists') {
  const state = readState()
  if (bucket && state.buckets.includes(bucket)) {
    process.exit(0)
  }
  console.error('BucketNotReady')
  process.exit(255)
}

console.error('Unsupported fake aws command: ' + args.join(' '))
process.exit(1)
`)
  await chmod(targetPath, 0o755)
}

const writeFakeAwsState = async (buckets: string[]): Promise<void> => {
  await writeFile(statePath, JSON.stringify({ buckets }))
}

const writeProjectConfig = async (
  projectDir: string,
  bucket: string
): Promise<void> => {
  await mkdir(join(projectDir, 'config'), { recursive: true })
  await writeFile(join(projectDir, 'package.json'), JSON.stringify({
    name: 'autoshow-aws-test',
    version: '0.0.0',
    type: 'module'
  }, null, 2))
  await writeFile(join(projectDir, 'config', 'autoshow.json'), JSON.stringify({
    version: 2,
    defaults: {
      stt: {
        awsRegion: FAKE_AWS_REGION,
        awsBucket: bucket,
        awsStt: ['standard']
      }
    }
  }, null, 2))
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), 'autoshow-aws-setup-'))
  configPath = join(tempDir, 'autoshow.json')
  statePath = join(tempDir, 'aws-state.json')
  await writeFakeAwsState([])
  await writeFakeAwsBinary(join(tempDir, 'aws'))

  originalPath = process.env['PATH'] ?? ''
  originalAwsState = process.env['AUTOSHOW_TEST_AWS_STATE'] ?? ''
  originalAwsBin = process.env['AUTOSHOW_AWS_BIN'] ?? ''
  process.env['PATH'] = `${tempDir}:${originalPath}`
  process.env['AUTOSHOW_TEST_AWS_STATE'] = statePath
  process.env['AUTOSHOW_AWS_BIN'] = join(tempDir, 'aws')
})

afterEach(async () => {
  process.env['PATH'] = originalPath
  if (originalAwsState.length > 0) {
    process.env['AUTOSHOW_TEST_AWS_STATE'] = originalAwsState
  } else {
    delete process.env['AUTOSHOW_TEST_AWS_STATE']
  }
  if (originalAwsBin.length > 0) {
    process.env['AUTOSHOW_AWS_BIN'] = originalAwsBin
  } else {
    delete process.env['AUTOSHOW_AWS_BIN']
  }
  await rm(tempDir, { recursive: true, force: true })
})

test('setupAwsStt creates and saves an AWS staging bucket when missing bucket fallback is enabled', async () => {
  await setupAwsStt({
    preferredRegion: FAKE_AWS_REGION,
    autoCreateMissingBucket: true,
    verifyTranscribe: true,
    configPathOverride: configPath
  })

  const config = await loadConfig(configPath)
  const savedBucket = config.defaults?.stt?.awsBucket

  expect(config.defaults?.stt?.awsRegion).toBe(FAKE_AWS_REGION)
  expect(config.defaults?.stt?.awsStt).toEqual(['standard'])
  expect(savedBucket).toMatch(/^autoshow-transcribe-123456789012-us-east-2-[a-z0-9]+$/)

  const readiness = await readAwsSttReadiness({
    preferredRegion: FAKE_AWS_REGION,
    preferredBucket: savedBucket,
    verifyTranscribe: true
  })

  expect(readiness.bucketAccessible).toBe(true)
  expect(readiness.transcribeAccessible).toBe(true)
})

test('ensureAwsSttSetup falls back to saved config defaults when explicit values are omitted', async () => {
  const savedBucket = 'autoshow-transcribe-123456789012-us-east-2-savedcfg'
  const projectDir = join(tempDir, 'project-defaults')
  await writeProjectConfig(projectDir, savedBucket)
  await writeFakeAwsState([savedBucket])

  const originalCwd = process.cwd()
  process.chdir(projectDir)

  try {
    await expect(ensureAwsSttSetup()).resolves.toEqual({
      region: FAKE_AWS_REGION,
      bucket: savedBucket
    })
  } finally {
    process.chdir(originalCwd)
  }
})

test('ensureSttTargetSetup passes AWS target region and bucket through bootstrap', async () => {
  const bucket = 'autoshow-transcribe-123456789012-us-east-2-bootstrap'
  await writeFakeAwsState([bucket])

  await expect(ensureSttTargetSetup({
    service: 'aws',
    model: 'standard',
    awsRegion: FAKE_AWS_REGION,
    awsBucket: bucket
  })).resolves.toBeUndefined()
})
