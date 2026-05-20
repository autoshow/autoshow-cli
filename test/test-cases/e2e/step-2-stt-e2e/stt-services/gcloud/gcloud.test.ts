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
import { readGcloudSttReadiness } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gcloud/gcloud'

test('rejects invalid gcloud model', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    STABLE_EXAMPLE_AUDIO_URL,
    '--gcloud',
    'invalid-model'
  ])

  expect(result.exitCode).toBe(2)
})

budgetedTest('transcribe-gcloud-chirp_3', 'gcloud chirp_3 transcribes local audio when gcloud CLI is configured', async () => {
  const state = await readGcloudSttReadiness()
  if (!state.hasCli || !state.authConfigured || !state.projectId || state.speechApiEnabled !== true) {
    throw new Error('gcloud CLI auth, project, and speech.googleapis.com readiness are required for Google transcription')
  }

  await cleanupTestOutput(STABLE_EXAMPLE_AUDIO_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    STABLE_EXAMPLE_AUDIO_URL,
    '--gcloud',
    'chirp_3',
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
  expect(metadata.step2?.transcriptionService).toBe('gcloud')
  expect(metadata.step2?.transcriptionModel).toBe('chirp_3')
}, E2E_TEST_TIMEOUT_MS)
