import { defineSTTServiceTest } from '../../../../test-utils/define-stt-service-test'

defineSTTServiceTest({
  models: ['whisper-large-v3', 'whisper-large-v3-turbo'],
  cliFlag: '--groq-stt',
  sttService: 'groq',
  envVarKey: 'GROQ_API_KEY',
  envVarDescription: 'Groq whisper transcription',
})
