import { basename } from 'node:path'
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
import { requireConfiguredEnvVar, requireConfiguredValue } from '../../../../../test-utils/service-test-kit'

const openaiCustomVoiceTestEnabled = readConfiguredEnvVarSync('OPENAI_TTS_CUSTOM_VOICE_TEST') === '1'

budgetedTestIf(openaiCustomVoiceTestEnabled, 'tts-openai-gpt-4o-mini-tts-clone', 'OpenAI custom voice clone generates speech.wav when explicitly enabled', async () => {
  const enabled = await requireConfiguredEnvVar(
    'OPENAI_TTS_CUSTOM_VOICE_TEST',
    'OPENAI_TTS_CUSTOM_VOICE_TEST=1 is required for OpenAI custom voice TTS test'
  )
  requireConfiguredValue(
    enabled === '1' ? enabled : null,
    'OPENAI_TTS_CUSTOM_VOICE_TEST=1 is required for OpenAI custom voice TTS test'
  )
  await requireConfiguredEnvVar('OPENAI_API_KEY', 'OPENAI_API_KEY is required for OpenAI custom voice TTS test')
  const consentId = await requireConfiguredEnvVar('OPENAI_TTS_CONSENT_ID', 'OPENAI_TTS_CONSENT_ID and OPENAI_TTS_REF_AUDIO are required for OpenAI custom voice TTS test')
  const refAudio = await requireConfiguredEnvVar('OPENAI_TTS_REF_AUDIO', 'OPENAI_TTS_CONSENT_ID and OPENAI_TTS_REF_AUDIO are required for OpenAI custom voice TTS test')

  const result = await runCommand([
    'src/cli/create-cli.ts',
    'tts',
    STABLE_TTS_MD_PATH,
    '--provider',
    'openai=gpt-4o-mini-tts',
    '--openai-tts-ref-audio',
    refAudio,
    '--openai-tts-consent-id',
    consentId,
    '--openai-tts-voice-name',
    `AutoShowLive${Date.now().toString(36)}`
  ])

  expect(result.exitCode).toBe(0)

  const outputDir = result.outputDir ?? await findLatestDirectory(STABLE_TTS_MD_TITLE, result.outputRoot)
  expect(outputDir).not.toBeNull()

  if (outputDir) {
    expect(await fileExists(`${outputDir}/speech.wav`)).toBe(true)

    const metadata = await readRunMetadata(outputDir) as {
      tts?: Array<{ ttsService?: string, ttsModel?: string, speaker?: string, clonedVoiceId?: string, cloneCostCents?: number }>
    }
    expect(metadata.tts?.[0]?.ttsService).toBe('openai')
    expect(metadata.tts?.[0]?.ttsModel).toBe('gpt-4o-mini-tts')
    expect(metadata.tts?.[0]?.speaker).toBe(`ref_audio:${basename(refAudio)}`)
    expect(metadata.tts?.[0]?.clonedVoiceId?.startsWith('voice_')).toBe(true)
    expect(metadata.tts?.[0]?.cloneCostCents).toBe(0)
  }
}, E2E_TEST_TIMEOUT_MS)
