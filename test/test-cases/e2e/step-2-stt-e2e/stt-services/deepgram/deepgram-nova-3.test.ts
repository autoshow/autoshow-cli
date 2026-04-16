import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'

defineSTTServiceTest({
  models: ['nova-3'],
  cliFlag: '--deepgram-stt',
  sttService: 'deepgram',
  envVarKey: 'DEEPGRAM_API_KEY',
  envVarDescription: 'Deepgram transcription',
})
