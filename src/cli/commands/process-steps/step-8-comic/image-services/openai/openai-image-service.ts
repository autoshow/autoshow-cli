import { basename } from 'node:path'
import { createOpenAIImage, createOpenAIImageEdit } from '~/utils/openai/client'
import { getOpenAIClientConfig } from '../../utils/openai-client'
import { getImageEditInputFidelity } from '../../models/openai-models'
import type {
  GeneratedImageResponse,
  ImageGenerationQuality,
  ImageGenerationSize,
  ImageUsage,
  ImageEditInputFidelity,
  OpenAiImageGenerationModel,
} from '../../types'

export type OpenAiImageEditParams = {
  model: OpenAiImageGenerationModel
  image: string[]
  prompt: string
  input_fidelity?: ImageEditInputFidelity | undefined
  n: 1
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  output_format: 'png'
}

export type OpenAiImageGenerateParams = {
  model: OpenAiImageGenerationModel
  prompt: string
  n: 1
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  output_format: 'png'
}

export const buildOpenAiImageEditParams = (
  normalizedPrompt: string,
  referenceImages: string[],
  model: OpenAiImageGenerationModel,
  size: ImageGenerationSize,
  quality: ImageGenerationQuality
): OpenAiImageEditParams => {
  const inputFidelity = getImageEditInputFidelity(model)

  return {
    model,
    image: referenceImages,
    prompt: normalizedPrompt,
    ...(inputFidelity ? { input_fidelity: inputFidelity } : {}),
    n: 1,
    size,
    quality,
    output_format: 'png',
  }
}

export const buildOpenAiImageGenerateParams = (
  normalizedPrompt: string,
  model: OpenAiImageGenerationModel,
  size: ImageGenerationSize,
  quality: ImageGenerationQuality
): OpenAiImageGenerateParams => {
  return {
    model,
    prompt: normalizedPrompt,
    n: 1,
    size,
    quality,
    output_format: 'png',
  }
}

export const buildOpenAiImageEditForm = (params: OpenAiImageEditParams): FormData => {
  const form = new FormData()
  form.append('model', params.model)
  form.append('prompt', params.prompt)
  form.append('n', String(params.n))
  form.append('size', params.size)
  form.append('quality', params.quality)
  form.append('output_format', params.output_format)
  if (params.input_fidelity) {
    form.append('input_fidelity', params.input_fidelity)
  }
  for (const imagePath of params.image) {
    form.append('image[]', Bun.file(imagePath), basename(imagePath))
  }
  return form
}

const getProviderQualityLabel = (
  requestedQuality: ImageGenerationQuality,
  providerQuality: string | undefined
): string => {
  if (providerQuality) {
    return providerQuality
  }

  return requestedQuality
}

export const createImageOpenAi = async (
  normalizedPrompt: string,
  referenceImages: string[],
  model: OpenAiImageGenerationModel,
  size: ImageGenerationSize,
  quality: ImageGenerationQuality
): Promise<GeneratedImageResponse> => {
  const config = getOpenAIClientConfig()
  const inputFidelity = referenceImages.length > 0
    ? getImageEditInputFidelity(model)
    : undefined
  const mode: GeneratedImageResponse['mode'] = referenceImages.length > 0 ? 'edit' : 'generate'
  const response = referenceImages.length > 0
    ? await createOpenAIImageEdit(config, buildOpenAiImageEditForm(buildOpenAiImageEditParams(
      normalizedPrompt,
      referenceImages,
      model,
      size,
      quality
    )))
    : await createOpenAIImage(config, buildOpenAiImageGenerateParams(
        normalizedPrompt,
        model,
        size,
        quality
      ))

  const imageBase64 = response.data?.[0]?.b64_json
  if (!imageBase64) {
    throw new Error('Images API response did not include image data')
  }

  return {
    mode,
    ...(inputFidelity ? { inputFidelity } : {}),
    result: {
      imageBase64,
      ...(response.usage ? { usage: response.usage as ImageUsage } : {}),
      providerSizeLabel: response.size ?? size,
      providerQualityLabel: getProviderQualityLabel(quality, response.quality),
    },
  }
}
