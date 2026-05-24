import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { revTranscription } from './cases'

defineSTTServiceTest({
  ...revTranscription,
  models: ['low_cost'],
  sttService: 'rev',
})

