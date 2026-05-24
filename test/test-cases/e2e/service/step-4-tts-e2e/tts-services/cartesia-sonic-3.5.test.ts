import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { cartesiaTts } from './cases'

defineTTSServiceTest({
  ...cartesiaTts,
  models: ['sonic-3.5'],
  ttsService: 'cartesia',
})

