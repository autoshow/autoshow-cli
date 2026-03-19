import { CLIUsageError } from '~/utils/error-handler'
import type { MistralOcrModel } from '~/types'
export type { MistralOcrModel } from '~/types'

const formatAllowedValues = (values: readonly string[]): string => values.join(', ')

export const SUPPORTED_MISTRAL_OCR_MODELS = [
  'mistral-ocr-latest',
  'mistral-ocr-2512'
] as const satisfies readonly string[]

export const validateMistralOcrModel = (model: string): MistralOcrModel => {
  if (!SUPPORTED_MISTRAL_OCR_MODELS.includes(model as MistralOcrModel)) {
    throw CLIUsageError(
      `Invalid --mistral-ocr model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_MISTRAL_OCR_MODELS)}`
    )
  }
  return model as MistralOcrModel
}
