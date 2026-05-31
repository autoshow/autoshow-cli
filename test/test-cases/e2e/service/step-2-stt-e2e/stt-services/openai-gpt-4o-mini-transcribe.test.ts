import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { openaiTranscription } from './cases'

defineSTTServiceTest({
  ...openaiTranscription,
  models: ['gpt-4o-mini-transcribe'],
  sttService: 'openai-stt',
})

