import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { geminiOcr, hostedOcrImageInput } from './cases'

defineOCRServiceTest({
  ...geminiOcr,
  models: ['gemini-3.1-pro-preview'],
  expectedService: 'gemini',
  inputMode: 'image-only',
  imageInput: hostedOcrImageInput,
  assertProviderMetadata: true,
})

