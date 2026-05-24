import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { elevenlabsScribeV2 } from './cases'

defineSTTServiceTest({
  ...elevenlabsScribeV2,
  models: ['scribe_v2'],
  sttService: 'elevenlabs',
})

