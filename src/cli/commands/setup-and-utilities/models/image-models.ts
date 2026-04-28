import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { isNativeGeminiImage } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { DeapiImageModel, GeminiImageModel, GlmImageModel, GrokImageModel, MinimaxImageModel, OpenAIImageModel, RunwayImageModel } from '~/types'

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

export const SUPPORTED_GLM_IMAGE_MODELS = [
  'glm-image',
  'cogView-4-250304'
] as const satisfies readonly string[]

export const validateGlmImageModel = createModelValidator<GlmImageModel>(SUPPORTED_GLM_IMAGE_MODELS, 'glm-image')

export const SUPPORTED_GROK_IMAGE_MODELS = [
  'grok-imagine-image'
] as const satisfies readonly string[]

export const validateGrokImageModel = createModelValidator<GrokImageModel>(SUPPORTED_GROK_IMAGE_MODELS, 'grok-image')

export const SUPPORTED_RUNWAY_IMAGE_MODELS = [
  'gen4_image'
] as const satisfies readonly string[]

export const validateRunwayImageModel = createModelValidator<RunwayImageModel>(SUPPORTED_RUNWAY_IMAGE_MODELS, 'runway-image')

export const SUPPORTED_DEAPI_IMAGE_MODELS = [
  'Flux1schnell',
  'ZImageTurbo_INT8',
  'Flux_2_Klein_4B_BF16'
] as const satisfies readonly string[]

export const validateDeapiImageModel = createModelValidator<DeapiImageModel>(SUPPORTED_DEAPI_IMAGE_MODELS, 'deapi-image')
