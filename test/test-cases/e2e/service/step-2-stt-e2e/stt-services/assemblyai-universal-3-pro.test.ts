import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { assemblyaiUniversal3Pro } from './cases'

defineSTTServiceTest({
  ...assemblyaiUniversal3Pro,
  models: ['universal-3-pro'],
  sttService: 'assemblyai',
})

