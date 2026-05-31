import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { minimaxTts } from './cases'

defineTTSServiceTest({
  ...minimaxTts,
  models: ['speech-2.8-hd'],
  ttsService: 'minimax',
})

