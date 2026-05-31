import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'
import { anthropicOcr, hostedOcrImageInput } from './cases'

defineOCRServiceTest({
  ...anthropicOcr,
  models: ['claude-opus-4-7'],
  expectedService: 'anthropic',
  inputMode: 'image-only',
  imageInput: hostedOcrImageInput,
  assertProviderMetadata: true,
})

