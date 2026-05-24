import { expect } from 'bun:test'
import { budgetedTestIf, E2E_TEST_TIMEOUT_MS } from '../../../../../test-utils/budget'
import {
  fileExists,
  findLatestDirectory,
  readConfiguredEnvVarSync,
  runCommand,
  STABLE_TTS_MD_PATH,
  STABLE_TTS_MD_TITLE,
} from '../../../../../test-utils/test-helpers'
import { readRunMetadata } from '../../../../../test-utils/manifest-helpers'
import { requireConfiguredEnvVar } from '../../../../../test-utils/service-test-kit'
import { mistralTtsModel } from './cases'

const mistralSavedVoiceConfigured = readConfiguredEnvVarSync('MISTRAL_TTS_VOICE') !== undefined

budgetedTestIf(mistralSavedVoiceConfigured, 'tts-mistral-voxtral-mini-tts-2603-voice', 'mistral saved voice generates speech.wav when MISTRAL_TTS_VOICE is configured', async () => {
  await requireConfiguredEnvVar('MISTRAL_API_KEY', 'MISTRAL_API_KEY is required for Mistral TTS test')
  const voice = await requireConfiguredEnvVar('MISTRAL_TTS_VOICE', 'MISTRAL_TTS_VOICE is required for Mistral saved-voice TTS test')

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    `mistral=${mistralTtsModel}`,
    '--mistral-tts-voice',
    voice
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE, result.outputRoot)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/speech.wav`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string }>
    }
    expect(metadata.tts?.[0]?.ttsService).toBe('mistral')
    expect(metadata.tts?.[0]?.ttsModel).toBe(mistralTtsModel)
    expect(metadata.tts?.[0]?.speaker).toBe(voice)
  }
}, E2E_TEST_TIMEOUT_MS)
