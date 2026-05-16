import { isGeminiImageModel, isOpenAiImageModel } from '../models/model-registry'
import { createImageGemini } from './gemini/gemini-image-service'
import { createImageOpenAi } from './openai/openai-image-service'
import { validateImageSizeForModels } from '../utils/image-size'
import type {
  GeneratedImageResponse,
  ImageGenerationModel,
  ImageGenerationQuality,
  ImageGenerationSize,
  ImageRequestTarget,
  ImageServiceRunners,
} from '../types'







const defaultImageServiceRunners: ImageServiceRunners = {
  openAi: createImageOpenAi,
  gemini: createImageGemini,
}

export const getImageRequestTarget = (model: ImageGenerationModel): ImageRequestTarget => {
  if (isOpenAiImageModel(model)) {
    return { provider: 'openai', model }
  }

  if (isGeminiImageModel(model)) {
    return { provider: 'gemini', model }
  }

  throw new Error(`Unsupported image model "${model}"`)
}

export const createImageWithRunners = async (
  normalizedPrompt: string,
  referenceImages: string[],
  model: ImageGenerationModel,
  size: ImageGenerationSize,
  quality: ImageGenerationQuality,
  runners: ImageServiceRunners = defaultImageServiceRunners
): Promise<GeneratedImageResponse> => {
  validateImageSizeForModels(size, [model])
  const target = getImageRequestTarget(model)

  if (target.provider === 'openai') {
    return runners.openAi(normalizedPrompt, referenceImages, target.model, size, quality)
  }

  return runners.gemini(normalizedPrompt, referenceImages, target.model, size)
}

export const createImage = async (
  normalizedPrompt: string,
  referenceImages: string[],
  model: ImageGenerationModel,
  size: ImageGenerationSize,
  quality: ImageGenerationQuality
): Promise<GeneratedImageResponse> => {
  return createImageWithRunners(
    normalizedPrompt,
    referenceImages,
    model,
    size,
    quality
  )
}
