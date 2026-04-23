import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { isNativeGeminiImage } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { GeminiImageModel, OpenAIImageModel, MinimaxImageModel } from '../setup-and-utilities-types'
export type { GeminiImageModel, OpenAIImageModel, MinimaxImageModel } from '../setup-and-utilities-types'

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

export const validateGeminiImageModel = createModelValidator<GeminiImageModel>(SUPPORTED_GEMINI_IMAGE_MODELS, 'gemini-image')

export const isNativeGeminiImageModel = (model: GeminiImageModel): boolean =>
  isNativeGeminiImage(model)

export const supportsGeminiImageSize = (model: GeminiImageModel): boolean =>
  isNativeGeminiImageModel(model) || GEMINI_IMAGE_SIZE_IMAGEN_MODELS.includes(model)

export const SUPPORTED_OPENAI_IMAGE_MODELS = [
  'gpt-image-1-mini',
  'gpt-image-1',
  'gpt-image-1.5',
] as const satisfies readonly string[]

export const validateOpenAIImageModel = createModelValidator<OpenAIImageModel>(SUPPORTED_OPENAI_IMAGE_MODELS, 'openai-image')

export const SUPPORTED_MINIMAX_IMAGE_MODELS = [
  'image-01'
] as const satisfies readonly string[]

export const validateMinimaxImageModel = createModelValidator<MinimaxImageModel>(SUPPORTED_MINIMAX_IMAGE_MODELS, 'minimax-image')
