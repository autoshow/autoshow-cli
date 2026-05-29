import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { isNativeGeminiImage } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { BflImageModel, GeminiImageModel, GrokImageModel, OpenAIImageModel, ReveImageModel } from '~/types'

export const SUPPORTED_GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-image-preview'
] as const satisfies readonly string[]

export const validateGeminiImageModel = createModelValidator<GeminiImageModel>(SUPPORTED_GEMINI_IMAGE_MODELS, 'gemini-image')

const isNativeGeminiImageModel = (model: GeminiImageModel): boolean =>
  isNativeGeminiImage(model)

export const supportsGeminiImageSize = (model: GeminiImageModel): boolean =>
  isNativeGeminiImageModel(model)

export const SUPPORTED_OPENAI_IMAGE_MODELS = [
  'gpt-image-1.5',
  'gpt-image-2',
] as const satisfies readonly string[]

export const validateOpenAIImageModel = createModelValidator<OpenAIImageModel>(SUPPORTED_OPENAI_IMAGE_MODELS, 'openai-image')

export const SUPPORTED_GROK_IMAGE_MODELS = [
  'grok-imagine-image-quality',
  'grok-imagine-image'
] as const satisfies readonly string[]

export const validateGrokImageModel = createModelValidator<GrokImageModel>(SUPPORTED_GROK_IMAGE_MODELS, 'grok-image')

export const SUPPORTED_BFL_IMAGE_MODELS = [
  'flux-2-pro',
  'flux-2-max',
  'flux-2-flex'
] as const satisfies readonly string[]

export const validateBflImageModel = createModelValidator<BflImageModel>(SUPPORTED_BFL_IMAGE_MODELS, 'bfl-image')

export const SUPPORTED_REVE_IMAGE_MODELS = [
  'latest',
  'reve-create@20250915'
] as const satisfies readonly string[]

export const validateReveImageModel = createModelValidator<ReveImageModel>(SUPPORTED_REVE_IMAGE_MODELS, 'reve-image')
