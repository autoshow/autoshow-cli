import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { deepgramNova3 } from './cases'

defineSTTServiceTest({
  ...deepgramNova3,
  models: ['nova-3'],
  sttService: 'deepgram',
})

