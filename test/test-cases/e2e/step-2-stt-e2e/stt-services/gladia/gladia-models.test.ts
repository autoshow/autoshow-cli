import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'

defineSTTServiceTest({
  models: ['default'],
  cliFlag: '--gladia-stt',
  sttService: 'gladia',
  envVarKey: 'GLADIA_API_KEY',
  envVarDescription: 'Gladia transcription',
})
