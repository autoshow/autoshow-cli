import { expect, test } from 'bun:test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../../test-utils/budget'
import {
  cleanupTestOutput,
  fileExists,
  findLatestDirectory,
  runCommand,
  STABLE_EXAMPLE_AUDIO_URL,
  STABLE_EXAMPLE_AUDIO_TITLE
} from '../../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../../test-utils/manifest-helpers'
import {
  readAwsSttConfigDefaults,
  readAwsSttReadiness
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/aws/aws'

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
    'extract',
    STABLE_EXAMPLE_AUDIO_URL,
    '--aws',
    'invalid-model'
  ])

  expect(result.exitCode).toBe(2)
})

budgetedTest('transcribe-aws-standard', 'aws standard transcribes local audio when AWS CLI Transcribe is configured', async () => {
  const { state } = await readAwsTestReadiness()
  if (!state.hasCli || !state.authConfigured || !state.region || state.bucketAccessible !== true || state.transcribeAccessible !== true) {
    throw new Error('AWS CLI auth, region, bucket, and Amazon Transcribe readiness are required for AWS transcription')
  }

  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    STABLE_EXAMPLE_AUDIO_URL,
    '--aws',
    'standard',
    '--speaker-count',
    '2'
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE)
  if (!outputDir) {
    throw new Error(`Expected output directory for ${STABLE_EXAMPLE_AUDIO_TITLE}`)
  }

  expect(await fileExists(`${outputDir}/transcription.txt`)).toBe(true)
  expect(await fileExists(`${outputDir}/result.json`)).toBe(true)

  const metadata = await readRunMetadata(outputDir) as {
    step2?: { transcriptionService?: string, transcriptionModel?: string }
  }
  expect(metadata.step2?.transcriptionService).toBe('aws')
  expect(metadata.step2?.transcriptionModel).toBe('standard')
}, E2E_TEST_TIMEOUT_MS)
