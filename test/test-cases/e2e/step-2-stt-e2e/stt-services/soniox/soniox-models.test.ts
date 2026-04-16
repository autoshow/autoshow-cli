import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'

defineSTTServiceTest({
  models: ['stt-async-v4'],
  cliFlag: '--soniox-stt',
  sttService: 'soniox',
  envVarKey: 'SONIOX_API_KEY',
  envVarDescription: 'Soniox transcription',
})
