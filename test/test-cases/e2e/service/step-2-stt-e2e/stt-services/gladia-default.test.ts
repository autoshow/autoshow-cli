import { defineSTTServiceTest } from '../../../../../test-utils/define-stt-service-test'
import { gladiaDefault } from './cases'

defineSTTServiceTest({
  ...gladiaDefault,
  models: ['default'],
  sttService: 'gladia',
})

