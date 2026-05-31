import { defineTTSServiceTest } from '../../../../../test-utils/define-tts-service-test'
import { humeTts } from './cases'

defineTTSServiceTest({
  ...humeTts,
  models: ['octave-2'],
  ttsService: 'hume',
})

