import { expect, test } from 'bun:test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../../test-utils/budget'
import {
  cleanupTestOutput,
  fileExists,
  findLatestDirectory,
  runCommand,
  STABLE_LOCAL_AUDIO_PATH,
  STABLE_LOCAL_AUDIO_TITLE
} from '../../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../../test-utils/manifest-helpers'
import { readGcloudSttReadiness } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/gcloud/gcloud'

test('rejects invalid gcloud model', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    STABLE_LOCAL_AUDIO_PATH,
    '--gcloud-stt',
    'invalid-model'
  ])

  expect(result.exitCode).toBe(2)
})

budgetedTest('transcribe-gcloud-chirp_3', 'gcloud chirp_3 transcribes local audio when gcloud CLI is configured', async () => {
  const state = await readGcloudSttReadiness()
  if (!state.hasCli || !state.authConfigured || !state.projectId || state.speechApiEnabled !== true) {
    console.log('Skipping: gcloud CLI auth, project, and speech.googleapis.com readiness are required for Google transcription')
    return
  }

  await cleanupTestOutput(STABLE_LOCAL_AUDIO_TITLE)

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    STABLE_LOCAL_AUDIO_PATH,
    '--gcloud-stt',
    'chirp_3',
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
    expect(metadata.step2?.transcriptionService).toBe('gcloud')
    expect(metadata.step2?.transcriptionModel).toBe('chirp_3')
  }
}, E2E_TEST_TIMEOUT_MS)
