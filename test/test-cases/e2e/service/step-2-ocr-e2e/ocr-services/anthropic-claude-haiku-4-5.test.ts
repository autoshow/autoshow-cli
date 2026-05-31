import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { anthropicOcr } from './cases'

defineOCRServiceTest({
  ...anthropicOcr,
  models: ['claude-haiku-4-5'],
  expectedService: 'anthropic',
  imageInput: 'input/examples/document/1-document.jpg',
})

