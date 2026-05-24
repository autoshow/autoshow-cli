import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { openaiTts } from './cases'

defineTTSServiceTest({
  ...openaiTts,
  models: ['gpt-4o-mini-tts'],
  ttsService: 'openai',
})

