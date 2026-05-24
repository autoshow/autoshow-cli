import { defineOCRServiceTest } from '../../../../../test-utils/define-ocr-service-test'

const HOSTED_OCR_IMAGE_INPUT = 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png'

defineOCRServiceTest({
  models: ['glm-ocr'],
  provider: 'glm',
  extractionMethod: 'glm-ocr',
  imageExtractionMethod: 'image+glm-ocr',
  envVarKey: 'GLM_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
})

defineOCRServiceTest({
  models: ['kimi-k2.6'],
  provider: 'kimi',
  extractionMethod: 'kimi-ocr',
  imageExtractionMethod: 'image+kimi-ocr',
  envVarKey: 'KIMI_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
  assertUsageMetadata: true,
})

defineOCRServiceTest({
  models: ['mistral-ocr-2512'],
  provider: 'mistral',
  extractionMethod: 'mistral-ocr',
  imageExtractionMethod: 'image+mistral-ocr',
  envVarKey: 'MISTRAL_API_KEY',
})

defineOCRServiceTest({
  models: ['gpt-5.4-nano'],
  provider: 'openai',
  extractionMethod: 'openai-ocr',
  imageExtractionMethod: 'image+openai-ocr',
  envVarKey: 'OPENAI_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
})

defineOCRServiceTest({
  models: ['claude-haiku-4-5'],
  provider: 'anthropic',
  extractionMethod: 'anthropic-ocr',
  imageExtractionMethod: 'image+anthropic-ocr',
  envVarKey: 'ANTHROPIC_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
})

defineOCRServiceTest({
  models: ['gemini-3.1-flash-lite-preview'],
  provider: 'gemini',
  extractionMethod: 'gemini-ocr',
  imageExtractionMethod: 'image+gemini-ocr',
  envVarKey: 'GEMINI_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
})

defineOCRServiceTest({
  models: ['Qwen/Qwen3-VL-30B-A3B-Instruct'],
  provider: 'deepinfra',
  extractionMethod: 'deepinfra-ocr',
  imageExtractionMethod: 'image+deepinfra-ocr',
  envVarKey: 'DEEPINFRA_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
  assertUsageMetadata: true,
})

defineOCRServiceTest({
  models: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini'],
  provider: 'openai',
  extractionMethod: 'openai-ocr',
  imageExtractionMethod: 'image+openai-ocr',
  envVarKey: 'OPENAI_API_KEY',
  inputMode: 'image-only',
  imageInput: HOSTED_OCR_IMAGE_INPUT,
  assertProviderMetadata: true,
})

defineOCRServiceTest({
  models: ['grok-4.3'],
  provider: 'grok',
  extractionMethod: 'grok-ocr',
  imageExtractionMethod: 'image+grok-ocr',
  envVarKey: 'XAI_API_KEY',
  inputMode: 'image-only',
  imageInput: HOSTED_OCR_IMAGE_INPUT,
  assertProviderMetadata: true,
})

defineOCRServiceTest({
  models: ['claude-opus-4-7', 'claude-sonnet-4-6'],
  provider: 'anthropic',
  extractionMethod: 'anthropic-ocr',
  imageExtractionMethod: 'image+anthropic-ocr',
  envVarKey: 'ANTHROPIC_API_KEY',
  inputMode: 'image-only',
  imageInput: HOSTED_OCR_IMAGE_INPUT,
  assertProviderMetadata: true,
})

defineOCRServiceTest({
  models: ['gemini-3.1-pro-preview'],
  provider: 'gemini',
  extractionMethod: 'gemini-ocr',
  imageExtractionMethod: 'image+gemini-ocr',
  envVarKey: 'GEMINI_API_KEY',
  inputMode: 'image-only',
  imageInput: HOSTED_OCR_IMAGE_INPUT,
  assertProviderMetadata: true,
})

defineOCRServiceTest({
  models: ['hi_res_and_enrichment'],
  provider: 'unstructured',
  extractionMethod: 'unstructured-ocr',
  imageExtractionMethod: 'image+unstructured-ocr',
  envVarKey: 'UNSTRUCTURED_API_KEY',
  inputMode: 'image-only',
  imageInput: HOSTED_OCR_IMAGE_INPUT,
  assertProviderMetadata: true,
})
