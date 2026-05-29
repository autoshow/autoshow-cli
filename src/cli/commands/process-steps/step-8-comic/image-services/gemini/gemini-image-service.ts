import { extname } from 'node:path'
import {
  geminiGenerateContent,
  geminiUserContent,
  type GeminiGenerateContentUsageMetadata,
  type GeminiPart,
} from '~/utils/gemini/gemini-rest'
import { getGeminiApiKey } from '../../utils/gemini-client'
import { mapCliSizeToGeminiImageConfig } from '../../models/gemini-models'
import { SUPPORTED_GENERATED_IMAGE_MIME_TYPES } from '../image-types'
import type {
  GeminiImageGenerationModel,
  GeneratedImageResponse,
  ImageGenerationSize,
  ImageUsage,
} from '../../types/comic-types'


const getGeminiModalityTokenCount = (
  details: GeminiGenerateContentUsageMetadata['promptTokensDetails'] | undefined,
  modality: 'TEXT' | 'IMAGE'
): number | undefined => {
  return details?.find(detail => detail.modality === modality)?.tokenCount
}

const normalizeGeminiImageUsage = (
  usageMetadata: GeminiGenerateContentUsageMetadata | undefined
): ImageUsage | undefined => {
  if (!usageMetadata) {
    return undefined
  }

  const inputTextTokens = getGeminiModalityTokenCount(usageMetadata.promptTokensDetails, 'TEXT')
  const inputImageTokens = getGeminiModalityTokenCount(usageMetadata.promptTokensDetails, 'IMAGE')
  const candidateTextTokens = getGeminiModalityTokenCount(usageMetadata.candidatesTokensDetails, 'TEXT') ?? 0
  const candidateImageTokens = getGeminiModalityTokenCount(usageMetadata.candidatesTokensDetails, 'IMAGE') ?? 0
  const reasoningTokens = usageMetadata.thoughtsTokenCount ?? 0
  const inputTokens = usageMetadata.promptTokenCount ?? 0
  const outputTokens = (usageMetadata.candidatesTokenCount ?? 0) + reasoningTokens

  return {
    input_tokens: inputTokens,
    ...(usageMetadata.promptTokensDetails
      ? {
          input_tokens_details: {
            text_tokens: inputTextTokens ?? 0,
            image_tokens: inputImageTokens ?? 0,
          },
        }
      : {}),
    output_tokens: outputTokens,
    ...(usageMetadata.candidatesTokensDetails || reasoningTokens > 0
      ? {
          output_tokens_details: {
            text_tokens: candidateTextTokens + reasoningTokens,
            ...(usageMetadata.candidatesTokensDetails
              ? { image_tokens: candidateImageTokens }
              : {}),
          },
        }
      : {}),
    total_tokens: usageMetadata.totalTokenCount
      ?? inputTokens + outputTokens + (usageMetadata.toolUsePromptTokenCount ?? 0),
  }
}

const mimeTypeFromExtension = (extension: string): string => {
  switch (extension.toLowerCase()) {
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    default:
      throw new Error(`Unsupported reference image extension "${extension}"`)
  }
}

const createGeminiContents = async (
  normalizedPrompt: string,
  referenceImages: string[]
): Promise<GeminiPart[]> => {
  return [
    { text: normalizedPrompt },
    ...await Promise.all(referenceImages.map(async path => {
      const mimeType = mimeTypeFromExtension(extname(path))
      const data = Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')

      return {
        inlineData: {
          mimeType,
          data,
        },
      } satisfies GeminiPart
    })),
  ]
}

export const createImageGemini = async (
  normalizedPrompt: string,
  referenceImages: string[],
  model: GeminiImageGenerationModel,
  size: ImageGenerationSize
): Promise<GeneratedImageResponse> => {
  const apiKey = getGeminiApiKey()
  const imageConfig = mapCliSizeToGeminiImageConfig(size)
  const response = await geminiGenerateContent(apiKey, {
    model,
    contents: geminiUserContent(await createGeminiContents(normalizedPrompt, referenceImages)),
    generationConfig: {
      responseModalities: ['IMAGE'],
      ...(imageConfig ? { imageConfig } : {}),
    },
  })

  const imagePart = response.candidates?.[0]?.content?.parts?.find(part => {
    return !part.thought && part.inlineData?.data
  })
  const imageBase64 = imagePart?.inlineData?.data
  if (!imageBase64) {
    const blockedReason = response.promptFeedback?.blockReason
      ? ` (${response.promptFeedback.blockReason})`
      : ''
    throw new Error(`Gemini response did not include image data${blockedReason}`)
  }

  const mimeType = imagePart.inlineData?.mimeType
  if (mimeType && !SUPPORTED_GENERATED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(`Gemini returned unsupported image MIME type "${mimeType}"`)
  }
  const normalizedUsage = normalizeGeminiImageUsage(response.usageMetadata)

  return {
    mode: 'generate',
    result: {
      imageBase64,
      ...(mimeType ? { mimeType } : {}),
      ...(normalizedUsage ? { usage: normalizedUsage } : {}),
      providerSizeLabel: imageConfig
        ? `${imageConfig.aspectRatio} @ ${imageConfig.imageSize} (mapped from ${size})`
        : 'auto (Gemini default)',
      providerQualityLabel: 'ignored by Gemini (--quality accepted for compatibility)',
    },
  }
}
