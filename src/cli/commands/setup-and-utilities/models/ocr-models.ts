import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { GlmOcrModel, MistralOcrModel, OpenAIOcrModel } from '~/types'
export type { GlmOcrModel, MistralOcrModel, OpenAIOcrModel } from '~/types'

export const SUPPORTED_MISTRAL_OCR_MODELS = [
  'mistral-ocr-2512'
] as const satisfies readonly string[]

export const validateMistralOcrModel = createModelValidator<MistralOcrModel>(SUPPORTED_MISTRAL_OCR_MODELS, 'mistral-ocr')

export const SUPPORTED_GLM_OCR_MODELS = [
  'glm-ocr'
] as const satisfies readonly string[]

export const validateGlmOcrModel = createModelValidator<GlmOcrModel>(SUPPORTED_GLM_OCR_MODELS, 'glm-ocr')

export const SUPPORTED_OPENAI_OCR_MODELS = [
  'gpt-5.4',
  'gpt-5.4-pro',
  'gpt-5.4-mini',
  'gpt-5.4-nano'
] as const satisfies readonly string[]

export const validateOpenAIOcrModel = createModelValidator<OpenAIOcrModel>(SUPPORTED_OPENAI_OCR_MODELS, 'openai-ocr')
