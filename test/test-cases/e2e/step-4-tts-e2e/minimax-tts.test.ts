import { defineTTSServiceTest } from '../../../test-utils/define-tts-service-test'

defineTTSServiceTest({
  models: ['speech-2.8-turbo', 'speech-2.8-hd'],
  cliFlag: '--minimax-tts',
  ttsService: 'minimax',
  envVarKey: 'MINIMAX_API_KEY',
  envVarDescription: 'MiniMax TTS',
  extraArgs: ['--minimax-tts-voice', 'English_expressive_narrator'],
  resolveExpectedSpeaker: async () => 'English_expressive_narrator',
})
