import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { geminiTranscription } from './cases'

defineSTTServiceTest({
  ...geminiTranscription,
  models: ['gemini-3-flash-preview'],
  sttService: 'gemini-stt',
})

