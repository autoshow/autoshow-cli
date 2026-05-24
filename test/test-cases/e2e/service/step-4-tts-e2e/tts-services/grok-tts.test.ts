import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { grokTts } from './cases'

defineTTSServiceTest({
  ...grokTts,
  models: ['grok-tts'],
  ttsService: 'grok',
})

