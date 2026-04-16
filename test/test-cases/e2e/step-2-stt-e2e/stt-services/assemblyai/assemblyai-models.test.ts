import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'

defineSTTServiceTest({
  models: ['universal-2', 'universal-3-pro'],
  cliFlag: '--assemblyai-stt',
  sttService: 'assemblyai',
  envVarKey: 'ASSEMBLYAI_API_KEY',
  envVarDescription: 'AssemblyAI transcription',
})
