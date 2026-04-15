import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'

defineSTTServiceTest({
  models: ['standard', 'enhanced'],
  cliFlag: '--speechmatics-stt',
  sttService: 'speechmatics',
  envVarKey: 'SPEECHMATICS_API_KEY',
  envVarDescription: 'Speechmatics transcription',
  timeoutMs: 30_000,
})
