import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { speechifyTts } from './cases'

defineTTSServiceTest({
  ...speechifyTts,
  models: ['simba-multilingual'],
  ttsService: 'speechify',
})

