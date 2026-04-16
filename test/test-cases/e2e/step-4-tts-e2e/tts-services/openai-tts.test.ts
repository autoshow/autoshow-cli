import { defineTTSServiceTest } from '../../../../test-utils/define-tts-service-test'
import { readConfiguredEnvVar } from '../../../../test-utils/test-helpers'
import { OPENAI_DEFAULT_TTS_VOICE } from '~/cli/commands/setup-and-utilities/models/model-options'

defineTTSServiceTest({
  models: ['gpt-4o-mini-tts'],
  cliFlag: '--openai-tts',
  ttsService: 'openai',
  envVarKey: 'OPENAI_API_KEY',
  envVarDescription: 'OpenAI TTS',
  resolveExpectedSpeaker: async () => {
    const voice = await readConfiguredEnvVar('OPENAI_TTS_VOICE')
    return voice ?? OPENAI_DEFAULT_TTS_VOICE
  },
})
