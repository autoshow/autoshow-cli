import { defineOCRServiceTest } from '../../../../test-utils/define-ocr-service-test'

defineOCRServiceTest({
  models: ['glm-ocr'],
  cliFlag: '--glm-ocr',
  extractionMethod: 'glm-ocr',
  imageExtractionMethod: 'image+glm-ocr',
  envVarKey: 'GLM_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
})

defineOCRServiceTest({
  models: ['kimi-k2.6'],
  cliFlag: '--kimi-ocr',
  extractionMethod: 'kimi-ocr',
  imageExtractionMethod: 'image+kimi-ocr',
  envVarKey: 'KIMI_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
  assertUsageMetadata: true,
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
})

defineOCRServiceTest({
  models: ['claude-haiku-4-5'],
  cliFlag: '--anthropic-ocr',
  extractionMethod: 'anthropic-ocr',
  imageExtractionMethod: 'image+anthropic-ocr',
  envVarKey: 'ANTHROPIC_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
})

defineOCRServiceTest({
  models: ['gemini-3.1-flash-lite-preview'],
  cliFlag: '--gemini-ocr',
  extractionMethod: 'gemini-ocr',
  imageExtractionMethod: 'image+gemini-ocr',
  envVarKey: 'GEMINI_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
})

defineOCRServiceTest({
  models: ['allenai/olmOCR-2-7B-1025'],
  cliFlag: '--deepinfra-ocr',
  extractionMethod: 'deepinfra-ocr',
  imageExtractionMethod: 'image+deepinfra-ocr',
  envVarKey: 'DEEPINFRA_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
  assertUsageMetadata: true,
})
