import { CLIUsageError } from '~/utils/error-handler'
import { isNativeGeminiImage } from '~/cli/commands/models/model-loader'
import type { GeminiImageModel, OpenAIImageModel, MinimaxImageModel } from '~/types'
export type { GeminiImageModel, OpenAIImageModel, MinimaxImageModel } from '~/types'

const formatAllowedValues = (values: readonly string[]): string => values.join(', ')

export const SUPPORTED_GEMINI_IMAGE_MODELS = [
  'imagen-4.0-fast-generate-001',
  'gemini-3-pro-image-preview',
  'imagen-4.0-generate-001',
  'imagen-4.0-ultra-generate-001'
] as const satisfies readonly string[]

const GEMINI_IMAGE_SIZE_IMAGEN_MODELS: readonly string[] = [
  'imagen-4.0-generate-001',
  'imagen-4.0-ultra-generate-001'
] as const satisfies readonly string[]

export const validateGeminiImageModel = (model: string): GeminiImageModel => {
  if (!SUPPORTED_GEMINI_IMAGE_MODELS.includes(model as GeminiImageModel)) {
    throw CLIUsageError(
      `Invalid --gemini-image model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_GEMINI_IMAGE_MODELS)}`
    )
  }
  return model as GeminiImageModel
}

export const isNativeGeminiImageModel = (model: GeminiImageModel): boolean =>
  isNativeGeminiImage(model)

export const supportsGeminiImageSize = (model: GeminiImageModel): boolean =>
  isNativeGeminiImageModel(model) || GEMINI_IMAGE_SIZE_IMAGEN_MODELS.includes(model)

export const SUPPORTED_OPENAI_IMAGE_MODELS = [
  'gpt-image-1-mini',
  'gpt-image-1',
  'gpt-image-1.5',
] as const satisfies readonly string[]

export const validateOpenAIImageModel = (model: string): OpenAIImageModel => {
  if (!SUPPORTED_OPENAI_IMAGE_MODELS.includes(model as OpenAIImageModel)) {
    throw CLIUsageError(
      `Invalid --openai-image model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_OPENAI_IMAGE_MODELS)}`
    )
  }
  return model as OpenAIImageModel
}

export const SUPPORTED_MINIMAX_IMAGE_MODELS = [
  'image-01'
] as const satisfies readonly string[]

export const validateMinimaxImageModel = (model: string): MinimaxImageModel => {
  if (!SUPPORTED_MINIMAX_IMAGE_MODELS.includes(model as MinimaxImageModel)) {
    throw CLIUsageError(
      `Invalid --minimax-image model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_MINIMAX_IMAGE_MODELS)}`
    )
  }
  return model as MinimaxImageModel
}

