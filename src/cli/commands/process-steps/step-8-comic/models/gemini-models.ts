import type {
  GeminiImageConfig,
  GeminiImageGenerationModel,
  GeminiImagePricing,
  GeminiImageUsageLike,
  GeminiLlmModel,
  GeminiLlmUsageLike,
  ImageGenerationSize,
  GeminiTieredTokenPricing,
  GeminiTokenPricing,
} from '../types'

export const GEMINI_LLM_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite-preview',
] as const
export const GEMINI_IMAGE_MODELS = ['gemini-3.1-flash-image-preview'] as const









export const GEMINI_REFERENCE_IMAGE_LIMIT = 10
export const GEMINI_PRIMARY_CHARACTER_REFERENCE_WARNING_LIMIT = 4

const GEMINI_LLM_PRICING: Record<GeminiLlmModel, GeminiTieredTokenPricing> = {
  'gemini-3.1-pro-preview': {
    standard: {
      input: 2.0,
      cachedInput: 0.2,
      output: 12.0,
    },
    largePrompt: {
      input: 4.0,
      cachedInput: 0.4,
      output: 18.0,
    },
  },
  'gemini-3.1-flash-lite-preview': {
    standard: {
      input: 0.25,
      cachedInput: 0.025,
      output: 1.5,
    },
  },
}

export const GEMINI_IMAGE_MODEL_PRICING: Record<GeminiImageGenerationModel, GeminiImagePricing> = {
  'gemini-3.1-flash-image-preview': {
    input: 0.5,
    textOutput: 3.0,
    imageOutput: 60.0,
    estimated1KImage: 0.067,
  },
}

export const getGeminiLlmPricing = (
  model: GeminiLlmModel,
  promptTokens: number
): GeminiTokenPricing => {
  const pricing = GEMINI_LLM_PRICING[model]

  if (pricing.largePrompt && promptTokens > 200_000) {
    return pricing.largePrompt
  }

  return pricing.standard
}

export const calculateGeminiLlmCost = (
  model: GeminiLlmModel,
  usage: GeminiLlmUsageLike
): number => {
  const pricing = getGeminiLlmPricing(model, usage.input_tokens)
  const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0
  const uncachedInputTokens = usage.input_tokens - cachedTokens

  return (
    (uncachedInputTokens / 1_000_000) * pricing.input +
    (cachedTokens / 1_000_000) * pricing.cachedInput +
    (usage.output_tokens / 1_000_000) * pricing.output
  )
}

export const calculateGeminiImageCost = (
  model: GeminiImageGenerationModel,
  usage: GeminiImageUsageLike
): number | null => {
  const outputTextTokens = usage.output_tokens_details?.text_tokens
  const outputImageTokens = usage.output_tokens_details?.image_tokens

  if (outputTextTokens === undefined || outputImageTokens === undefined) {
    return null
  }

  if (outputTextTokens + outputImageTokens !== usage.output_tokens) {
    return null
  }

  const pricing = GEMINI_IMAGE_MODEL_PRICING[model]

  return (
    (usage.input_tokens / 1_000_000) * pricing.input +
    (outputTextTokens / 1_000_000) * pricing.textOutput +
    (outputImageTokens / 1_000_000) * pricing.imageOutput
  )
}

export const estimateGeminiImageOutputCost = (
  model: GeminiImageGenerationModel,
  size: ImageGenerationSize | undefined
): number | null => {
  switch (size) {
    case '1536x1024':
    case '1024x1024':
    case '1024x1536':
      return GEMINI_IMAGE_MODEL_PRICING[model].estimated1KImage
    default:
      return null
  }
}

export const mapCliSizeToGeminiImageConfig = (
  size: ImageGenerationSize | undefined
): GeminiImageConfig | undefined => {
  switch (size) {
    case '1536x1024':
      return { aspectRatio: '3:2', imageSize: '1K' }
    case '1024x1024':
      return { aspectRatio: '1:1', imageSize: '1K' }
    case '1024x1536':
      return { aspectRatio: '2:3', imageSize: '1K' }
    default:
      return undefined
  }
}

export const truncateGeminiReferenceImages = <T>(
  references: readonly T[]
): { references: T[]; originalCount: number; wasTruncated: boolean } => {
  return {
    references: [...references].slice(0, GEMINI_REFERENCE_IMAGE_LIMIT),
    originalCount: references.length,
    wasTruncated: references.length > GEMINI_REFERENCE_IMAGE_LIMIT,
  }
}

export const geminiPrimaryCharacterRefsNeedWarning = (count: number): boolean => {
  return count > GEMINI_PRIMARY_CHARACTER_REFERENCE_WARNING_LIMIT
}
