import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'

defineSTTServiceTest({
  models: ['gpt-4o-transcribe-diarize'],
  cliFlag: '--openai-stt',
  sttService: 'openai',
  envVarKey: 'OPENAI_API_KEY',
  envVarDescription: 'OpenAI transcription',
  extraArgs: ['--speaker-count', '2'],
})
