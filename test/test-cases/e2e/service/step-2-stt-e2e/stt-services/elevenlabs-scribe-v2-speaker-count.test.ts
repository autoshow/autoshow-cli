import { expect } from 'bun:test'
import { budgetedTest, E2E_TEST_TIMEOUT_MS } from '../../../../../test-utils/budget'
import {
  fileExists,
  findLatestDirectory,
  runCommand,
  STABLE_EXAMPLE_AUDIO_TITLE,
  STABLE_EXAMPLE_AUDIO_URL,
} from '../../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar } from '../../../../../test-utils/service-test-kit'
import { elevenlabsScribeV2 } from './cases'

const budgetKey = 'transcribe-elevenlabs-scribe_v2'

budgetedTest(budgetKey, 'elevenlabs scribe_v2 transcribes with speaker-count 3', async () => {
  await requireConfiguredEnvVar(elevenlabsScribeV2.envVarKey, 'ELEVENLABS_API_KEY is required for ElevenLabs transcription')

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'extract',
    STABLE_EXAMPLE_AUDIO_URL,
    '--provider',
    'elevenlabs=scribe_v2',
    '--speaker-count',
    '3'
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_EXAMPLE_AUDIO_TITLE, result.outputRoot)
  if (!outputDir) {
    throw new Error(`Expected output directory for ${STABLE_EXAMPLE_AUDIO_TITLE}`)
  }

  expect(await fileExists(`${outputDir}/transcription.txt`)).toBe(true)

  const metadata = await readRunMetadata(outputDir) as {
    step2?: { transcriptionService?: string, transcriptionModel?: string }
  }
  expect(metadata.step2?.transcriptionService).toBe('elevenlabs')
  expect(metadata.step2?.transcriptionModel).toBe('scribe_v2')
}, E2E_TEST_TIMEOUT_MS)

