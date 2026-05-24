export const hostedOcrImageInput = 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png'

export const glmOcr = {
  provider: 'glm',
  extractionMethod: 'glm-ocr',
  imageExtractionMethod: 'image+glm-ocr',
  envVarKey: 'GLM_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
} as const

export const kimiOcr = {
  provider: 'kimi',
  extractionMethod: 'kimi-ocr',
  imageExtractionMethod: 'image+kimi-ocr',
  envVarKey: 'KIMI_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
  assertUsageMetadata: true,
} as const

export const mistralOcr = {
  provider: 'mistral',
  extractionMethod: 'mistral-ocr',
  imageExtractionMethod: 'image+mistral-ocr',
  envVarKey: 'MISTRAL_API_KEY',
} as const

export const openaiOcr = {
  provider: 'openai',
  extractionMethod: 'openai-ocr',
  imageExtractionMethod: 'image+openai-ocr',
  envVarKey: 'OPENAI_API_KEY',
} as const

export const anthropicOcr = {
  provider: 'anthropic',
  extractionMethod: 'anthropic-ocr',
  imageExtractionMethod: 'image+anthropic-ocr',
  envVarKey: 'ANTHROPIC_API_KEY',
} as const

export const geminiOcr = {
  provider: 'gemini',
  extractionMethod: 'gemini-ocr',
  imageExtractionMethod: 'image+gemini-ocr',
  envVarKey: 'GEMINI_API_KEY',
} as const

export const deepinfraOcr = {
  provider: 'deepinfra',
  extractionMethod: 'deepinfra-ocr',
  imageExtractionMethod: 'image+deepinfra-ocr',
  envVarKey: 'DEEPINFRA_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
  assertUsageMetadata: true,
} as const

export const grokOcr = {
  provider: 'grok',
  extractionMethod: 'grok-ocr',
  imageExtractionMethod: 'image+grok-ocr',
  envVarKey: 'XAI_API_KEY',
  inputMode: 'image-only',
  imageInput: hostedOcrImageInput,
  assertProviderMetadata: true,
} as const

export const unstructuredOcr = {
  provider: 'unstructured',
  extractionMethod: 'unstructured-ocr',
  imageExtractionMethod: 'image+unstructured-ocr',
  envVarKey: 'UNSTRUCTURED_API_KEY',
  inputMode: 'image-only',
  imageInput: hostedOcrImageInput,
  assertProviderMetadata: true,
} as const
