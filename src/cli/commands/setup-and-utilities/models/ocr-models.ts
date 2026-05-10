import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { AnthropicOcrModel, AwsTextractModel, DeepinfraOcrModel, GcloudDocaiModel, GeminiOcrModel, GlmOcrModel, KimiOcrModel, MistralOcrModel, OpenAIOcrModel } from '~/types'

export const SUPPORTED_MISTRAL_OCR_MODELS = [
  'mistral-ocr-2512'
] as const satisfies readonly string[]

export const validateMistralOcrModel = createModelValidator<MistralOcrModel>(SUPPORTED_MISTRAL_OCR_MODELS, 'mistral-ocr')

export const SUPPORTED_GLM_OCR_MODELS = [
  'glm-ocr'
] as const satisfies readonly string[]

export const validateGlmOcrModel = createModelValidator<GlmOcrModel>(SUPPORTED_GLM_OCR_MODELS, 'glm-ocr')

export const SUPPORTED_KIMI_OCR_MODELS = [
  'kimi-k2.6'
] as const satisfies readonly string[]

export const validateKimiOcrModel = createModelValidator<KimiOcrModel>(SUPPORTED_KIMI_OCR_MODELS, 'kimi-ocr')

export const SUPPORTED_OPENAI_OCR_MODELS = [
  'gpt-5.4',
  'gpt-5.4-nano'
] as const satisfies readonly string[]

export const validateOpenAIOcrModel = createModelValidator<OpenAIOcrModel>(SUPPORTED_OPENAI_OCR_MODELS, 'openai-ocr')

export const SUPPORTED_ANTHROPIC_OCR_MODELS = [
  'claude-haiku-4-5'
] as const satisfies readonly string[]

export const validateAnthropicOcrModel = createModelValidator<AnthropicOcrModel>(SUPPORTED_ANTHROPIC_OCR_MODELS, 'anthropic-ocr')

export const SUPPORTED_GEMINI_OCR_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite-preview'
] as const satisfies readonly string[]

export const validateGeminiOcrModel = createModelValidator<GeminiOcrModel>(SUPPORTED_GEMINI_OCR_MODELS, 'gemini-ocr')

export const DEFAULT_DEEPINFRA_OCR_MODEL = 'Qwen/Qwen3-VL-30B-A3B-Instruct'

export const SUPPORTED_DEEPINFRA_OCR_MODELS = [
  'PaddlePaddle/PaddleOCR-VL-0.9B',
  'Qwen/Qwen3-VL-235B-A22B-Instruct',
  DEFAULT_DEEPINFRA_OCR_MODEL
] as const satisfies readonly string[]

export const validateDeepinfraOcrModel = createModelValidator<DeepinfraOcrModel>(SUPPORTED_DEEPINFRA_OCR_MODELS, 'deepinfra-ocr')

export const SUPPORTED_AWS_TEXTRACT_MODELS = [
  'detect-text',
  'analyze-document'
] as const satisfies readonly string[]

export const validateAwsTextractModel = createModelValidator<AwsTextractModel>(SUPPORTED_AWS_TEXTRACT_MODELS, 'aws-textract')

export const SUPPORTED_GCLOUD_DOCAI_MODELS = [
  'ocr'
] as const satisfies readonly string[]

export const validateGcloudDocaiModel = createModelValidator<GcloudDocaiModel>(SUPPORTED_GCLOUD_DOCAI_MODELS, 'gcloud-docai')
