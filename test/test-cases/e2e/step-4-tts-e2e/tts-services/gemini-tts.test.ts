import { defineTTSServiceTest } from '../../../../test-utils/define-tts-service-test'
import { readConfiguredEnvVar } from '../../../../test-utils/test-helpers'
import { GEMINI_DEFAULT_TTS_VOICE } from '~/cli/commands/models/model-options'

defineTTSServiceTest({
  models: ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts'],
  cliFlag: '--gemini-tts',
  ttsService: 'gemini',
  envVarKey: 'GEMINI_API_KEY',
  envVarDescription: 'Gemini TTS',
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('GEMINI_TTS_VOICE')
    return voice ?? GEMINI_DEFAULT_TTS_VOICE
  },
})
