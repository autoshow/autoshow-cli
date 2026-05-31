import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { groqTts } from './cases'

defineTTSServiceTest({
  ...groqTts,
  models: ['canopylabs/orpheus-v1-english'],
  ttsService: 'groq',
})

