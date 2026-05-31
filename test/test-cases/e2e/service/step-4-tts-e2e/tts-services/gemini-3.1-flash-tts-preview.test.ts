import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { geminiTts } from './cases'

defineTTSServiceTest({
  ...geminiTts,
  models: ['gemini-3.1-flash-tts-preview'],
  ttsService: 'gemini',
})

