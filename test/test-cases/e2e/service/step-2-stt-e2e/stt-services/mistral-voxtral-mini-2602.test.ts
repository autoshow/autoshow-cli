import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { mistralVoxtralMini } from './cases'

defineSTTServiceTest({
  ...mistralVoxtralMini,
  models: ['voxtral-mini-2602'],
  sttService: 'mistral',
})

