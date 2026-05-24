import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { openaiOcr } from './cases'

defineOCRServiceTest({
  ...openaiOcr,
  models: ['gpt-5.4-nano'],
  expectedService: 'openai',
  imageInput: 'input/examples/document/1-document.jpg',
})

