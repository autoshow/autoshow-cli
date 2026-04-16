import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { GlmOcrModel, MistralOcrModel } from '~/types'
export type { GlmOcrModel, MistralOcrModel } from '~/types'

export const SUPPORTED_MISTRAL_OCR_MODELS = [
  'mistral-ocr-latest',
  'mistral-ocr-2512'
] as const satisfies readonly string[]

export const validateMistralOcrModel = createModelValidator<MistralOcrModel>(SUPPORTED_MISTRAL_OCR_MODELS, 'mistral-ocr')

export const SUPPORTED_GLM_OCR_MODELS = [
  'glm-ocr'
] as const satisfies readonly string[]

export const validateGlmOcrModel = createModelValidator<GlmOcrModel>(SUPPORTED_GLM_OCR_MODELS, 'glm-ocr')
