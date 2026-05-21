import { defineOCRServiceTest } from '../../../../test-utils/define-ocr-service-test'
import { ensureAwsTextractSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/aws-textract/aws-textract'
import { ensureGcloudDocaiSetup } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/gcloud-docai/gcloud-docai'

const HOSTED_OCR_IMAGE_INPUT = 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png'

const requireAwsTextractReadiness = async (): Promise<boolean> => {
  await ensureAwsTextractSetup()
  return false
}

const requireGcloudDocaiReadiness = async (): Promise<boolean> => {
  await ensureGcloudDocaiSetup()
  return false
}

defineOCRServiceTest({
  models: ['glm-ocr'],
  cliFlag: '--glm',
  extractionMethod: 'glm-ocr',
  imageExtractionMethod: 'image+glm-ocr',
  envVarKey: 'GLM_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
})

defineOCRServiceTest({
  models: ['kimi-k2.6'],
  cliFlag: '--kimi',
  extractionMethod: 'kimi-ocr',
  imageExtractionMethod: 'image+kimi-ocr',
  envVarKey: 'KIMI_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
  assertUsageMetadata: true,
})

defineOCRServiceTest({
  models: ['mistral-ocr-2512'],
  cliFlag: '--mistral',
  extractionMethod: 'mistral-ocr',
  imageExtractionMethod: 'image+mistral-ocr',
  envVarKey: 'MISTRAL_API_KEY',
})

defineOCRServiceTest({
  models: ['gpt-5.4-nano'],
  cliFlag: '--openai',
  extractionMethod: 'openai-ocr',
  imageExtractionMethod: 'image+openai-ocr',
  envVarKey: 'OPENAI_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
})

defineOCRServiceTest({
  models: ['claude-haiku-4-5'],
  cliFlag: '--anthropic',
  extractionMethod: 'anthropic-ocr',
  imageExtractionMethod: 'image+anthropic-ocr',
  envVarKey: 'ANTHROPIC_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
})

defineOCRServiceTest({
  models: ['gemini-3.1-flash-lite-preview'],
  cliFlag: '--gemini',
  extractionMethod: 'gemini-ocr',
  imageExtractionMethod: 'image+gemini-ocr',
  envVarKey: 'GEMINI_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
})

defineOCRServiceTest({
  models: ['Qwen/Qwen3-VL-30B-A3B-Instruct'],
  cliFlag: '--deepinfra',
  extractionMethod: 'deepinfra-ocr',
  imageExtractionMethod: 'image+deepinfra-ocr',
  envVarKey: 'DEEPINFRA_API_KEY',
  imageInput: 'input/examples/document/1-document.jpg',
  assertUsageMetadata: true,
})

defineOCRServiceTest({
  models: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini'],
  cliFlag: '--openai',
  extractionMethod: 'openai-ocr',
  imageExtractionMethod: 'image+openai-ocr',
  envVarKey: 'OPENAI_API_KEY',
  inputMode: 'image-only',
  imageInput: HOSTED_OCR_IMAGE_INPUT,
  assertProviderMetadata: true,
})

defineOCRServiceTest({
  models: ['grok-4.3'],
  cliFlag: '--grok',
  extractionMethod: 'grok-ocr',
  imageExtractionMethod: 'image+grok-ocr',
  envVarKey: 'XAI_API_KEY',
  inputMode: 'image-only',
  imageInput: HOSTED_OCR_IMAGE_INPUT,
  assertProviderMetadata: true,
})

defineOCRServiceTest({
  models: ['claude-opus-4-7', 'claude-sonnet-4-6'],
  cliFlag: '--anthropic',
  extractionMethod: 'anthropic-ocr',
  imageExtractionMethod: 'image+anthropic-ocr',
  envVarKey: 'ANTHROPIC_API_KEY',
  inputMode: 'image-only',
  imageInput: HOSTED_OCR_IMAGE_INPUT,
  assertProviderMetadata: true,
})

defineOCRServiceTest({
  models: ['gemini-3.1-pro-preview'],
  cliFlag: '--gemini',
  extractionMethod: 'gemini-ocr',
  imageExtractionMethod: 'image+gemini-ocr',
  envVarKey: 'GEMINI_API_KEY',
  inputMode: 'image-only',
  imageInput: HOSTED_OCR_IMAGE_INPUT,
  assertProviderMetadata: true,
})

defineOCRServiceTest({
  models: ['detect-text'],
  cliFlag: '--aws',
  expectedService: 'aws-textract',
  extractionMethod: 'aws-textract',
  imageExtractionMethod: 'image+aws-textract',
  inputMode: 'image-only',
  imageInput: HOSTED_OCR_IMAGE_INPUT,
  shouldSkipReadiness: requireAwsTextractReadiness,
  assertProviderMetadata: true,
})

defineOCRServiceTest({
  models: ['ocr'],
  cliFlag: '--gcloud',
  expectedService: 'gcloud-docai',
  extractionMethod: 'gcloud-docai',
  imageExtractionMethod: 'image+gcloud-docai',
  inputMode: 'image-only',
  imageInput: HOSTED_OCR_IMAGE_INPUT,
  shouldSkipReadiness: requireGcloudDocaiReadiness,
  assertProviderMetadata: true,
})

defineOCRServiceTest({
  models: ['hi_res_and_enrichment'],
  cliFlag: '--unstructured',
  extractionMethod: 'unstructured-ocr',
  imageExtractionMethod: 'image+unstructured-ocr',
  envVarKey: 'UNSTRUCTURED_API_KEY',
  inputMode: 'image-only',
  imageInput: HOSTED_OCR_IMAGE_INPUT,
  assertProviderMetadata: true,
})
