import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { sonioxAsyncV4 } from './cases'

defineSTTServiceTest({
  ...sonioxAsyncV4,
  models: ['stt-async-v4'],
  sttService: 'soniox',
})

