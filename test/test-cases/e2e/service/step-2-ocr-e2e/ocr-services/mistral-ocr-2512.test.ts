import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { mistralOcr } from './cases'

defineOCRServiceTest({
  ...mistralOcr,
  models: ['mistral-ocr-2512'],
  expectedService: 'mistral',
})

