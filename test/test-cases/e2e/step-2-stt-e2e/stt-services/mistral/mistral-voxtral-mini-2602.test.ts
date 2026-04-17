import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'

defineSTTServiceTest({
  models: ['voxtral-mini-2602'],
  cliFlag: '--mistral-stt',
  sttService: 'mistral',
  envVarKey: 'MISTRAL_API_KEY',
  envVarDescription: 'Mistral transcription',
})
