import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { MistralOcrModel } from '~/types'
export type { MistralOcrModel } from '~/types'

export const SUPPORTED_MISTRAL_OCR_MODELS = [
  'mistral-ocr-latest',
  'mistral-ocr-2512'
] as const satisfies readonly string[]

export const validateMistralOcrModel = createModelValidator<MistralOcrModel>(SUPPORTED_MISTRAL_OCR_MODELS, 'mistral-ocr')
