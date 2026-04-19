import { expect, test } from 'bun:test'
import {
  cleanupTestOutput,
  fileExists,
  findLatestDirectory,
  runCommand,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE
} from '../../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../../test-utils/manifest-helpers'
import {
  readAwsSttConfigDefaults,
  readAwsSttReadiness
} from '~/cli/commands/process-steps/step-2-stt/stt-services/aws/aws'

const readAwsTestReadiness = async () => {
  const defaults = await readAwsSttConfigDefaults()
  const state = await readAwsSttReadiness({
    preferredRegion: defaults.preferredRegion,
    preferredBucket: defaults.preferredBucket,
    verifyTranscribe: true
  })
  return { defaults, state }
}

test('rejects invalid aws model', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--aws-stt',
    'invalid-model'
  ])

  expect(result.exitCode).toBe(2)
})

test('aws standard --price prints estimate', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--aws-stt',
    'standard',
    '--price'
  ])

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('"provider": "aws"')
  expect(`${result.stdout}\n${result.stderr}`).toContain('"model": "standard"')
})

test('aws standard transcribes local audio when AWS CLI Transcribe is configured', async () => {
  const { state } = await readAwsTestReadiness()
  if (!state.hasCli || !state.authConfigured || !state.region || state.bucketAccessible !== true || state.transcribeAccessible !== true) {
    console.log('Skipping: AWS CLI auth, region, bucket, and Amazon Transcribe readiness are required for AWS transcription')
    return
  }

  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'stt',
    STABLE_LOCAL_AUDIO_PATH,
    '--aws-stt',
    'standard',
    '--speaker-count',
    '2'
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_LOCAL_AUDIO_TITLE)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/transcription.txt`)).toBe(true)
    expect(await fileExists(`${outputDir}/result.json`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      step2?: { transcriptionService?: string, transcriptionModel?: string }
    }
    expect(metadata.step2?.transcriptionService).toBe('aws')
    expect(metadata.step2?.transcriptionModel).toBe('standard')
  }
}, 120_000)
