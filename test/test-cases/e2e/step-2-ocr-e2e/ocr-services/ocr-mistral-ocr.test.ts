import { defineOCRServiceTest } from '../../../../test-utils/define-ocr-service-test'

defineOCRServiceTest({
  models: ['mistral-ocr-latest', 'mistral-ocr-2512'],
  cliFlag: '--mistral-ocr',
  extractionMethod: 'mistral-ocr',
  imageExtractionMethod: 'image+mistral-ocr',
  envVarKey: 'MISTRAL_API_KEY',
})
