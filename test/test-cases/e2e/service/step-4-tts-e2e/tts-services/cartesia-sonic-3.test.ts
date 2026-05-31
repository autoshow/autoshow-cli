import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { cartesiaTts } from './cases'

defineTTSServiceTest({
  ...cartesiaTts,
  models: ['sonic-3'],
  ttsService: 'cartesia',
})

