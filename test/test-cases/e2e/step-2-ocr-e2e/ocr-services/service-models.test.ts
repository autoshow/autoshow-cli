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

defineOCRServiceTest({
  models: ['mistral-ocr-2512'],
  cliFlag: '--mistral-ocr',
  extractionMethod: 'mistral-ocr',
  imageExtractionMethod: 'image+mistral-ocr',
  envVarKey: 'MISTRAL_API_KEY',
})

defineOCRServiceTest({
  models: ['gpt-5.4-nano'],
  cliFlag: '--openai-ocr',
  extractionMethod: 'openai-ocr',
  imageExtractionMethod: 'image+openai-ocr',
  envVarKey: 'OPENAI_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
  timeoutMs: 30000,
})

defineOCRServiceTest({
  models: ['claude-haiku-4-5'],
  cliFlag: '--anthropic-ocr',
  extractionMethod: 'anthropic-ocr',
  imageExtractionMethod: 'image+anthropic-ocr',
  envVarKey: 'ANTHROPIC_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
  timeoutMs: 30000,
})

defineOCRServiceTest({
  models: ['gemini-3.1-flash-lite-preview'],
  cliFlag: '--gemini-ocr',
  extractionMethod: 'gemini-ocr',
  imageExtractionMethod: 'image+gemini-ocr',
  envVarKey: 'GEMINI_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
  timeoutMs: 30000,
})
