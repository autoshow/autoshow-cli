import { defineTTSServiceTest } from '../../../../test-utils/define-tts-service-test'
import { readConfiguredEnvVar } from '../../../../test-utils/test-helpers'
import { ELEVENLABS_DEFAULT_VOICE_ID } from '~/cli/commands/models/model-options'

defineTTSServiceTest({
  models: ['eleven_v3', 'eleven_flash_v2_5', 'eleven_turbo_v2_5'],
  cliFlag: '--elevenlabs-tts',
  ttsService: 'elevenlabs',
  envVarKey: 'ELEVENLABS_API_KEY',
  envVarDescription: 'ElevenLabs TTS',
  resolveExpectedSpeaker: async () => {
    const voiceId = await readConfiguredEnvVar('ELEVENLABS_VOICE_ID')
    return voiceId ?? ELEVENLABS_DEFAULT_VOICE_ID
  },
})
