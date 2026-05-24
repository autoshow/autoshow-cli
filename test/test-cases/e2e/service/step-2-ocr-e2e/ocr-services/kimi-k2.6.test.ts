import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { kimiOcr } from './cases'

defineOCRServiceTest({
  ...kimiOcr,
  models: ['kimi-k2.6'],
  expectedService: 'kimi',
})

