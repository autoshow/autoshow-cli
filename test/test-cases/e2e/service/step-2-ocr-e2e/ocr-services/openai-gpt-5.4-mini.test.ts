import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { hostedOcrImageInput, openaiOcr } from './cases'

defineOCRServiceTest({
  ...openaiOcr,
  models: ['gpt-5.4-mini'],
  expectedService: 'openai',
  inputMode: 'image-only',
  imageInput: hostedOcrImageInput,
  assertProviderMetadata: true,
})

