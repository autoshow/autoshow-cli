import { defineOCRServiceTest } from '../../../../test-utils/define-ocr-service-test'

defineOCRServiceTest({
  models: ['glm-ocr'],
  cliFlag: '--glm-ocr',
  extractionMethod: 'glm-ocr',
  imageExtractionMethod: 'image+glm-ocr',
  envVarKey: 'GLM_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
  timeoutMs: 30000,
})
