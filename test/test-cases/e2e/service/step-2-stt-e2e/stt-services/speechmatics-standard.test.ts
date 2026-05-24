import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { speechmaticsTranscription } from './cases'

defineSTTServiceTest({
  ...speechmaticsTranscription,
  models: ['standard'],
  sttService: 'speechmatics',
})

