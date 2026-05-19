import { l } from '../utils/logger'
import {
  calculateGeminiImageCost,
  estimateGeminiImageOutputCost,
} from '../models/gemini-models'
import { isGeminiImageModel, isOpenAiImageModel } from '../models/model-registry'
import { IMAGE_MODEL_PRICING } from '../models/openai-models'
import type {
  ConcreteImageQuality,
  ImageGenerationModel,
  ImageGenerationQuality,
  ImageGenerationSize,
  ImageRunStats,
  ImageUsage,
  OpenAiImageGenerationModel,
  TokenBreakdown,
} from '../types'

type CommonOpenAiImageSize = '1024x1024' | '1024x1536' | '1536x1024'

export const createImageRunStats = (): ImageRunStats => ({
  imagesGenerated: 0,
  imagesSkipped: 0,
  totalInputTokens: 0,
  totalInputTextTokens: 0,
  totalInputImageTokens: 0,
  totalInputUnattributedTokens: 0,
  totalOutputTokens: 0,
  totalOutputTextTokens: 0,
  totalOutputImageTokens: 0,
  totalOutputUnattributedTokens: 0,
  totalCost: 0,
  totalDurationMs: 0,
})

export const formatCost = (dollars: number): string => {
  return dollars < 0.01
    ? `$${dollars.toFixed(4)}`
    : `$${dollars.toFixed(2)}`
}

const calculateOpenAiCost = (model: OpenAiImageGenerationModel, usage: ImageUsage): number => {
  const pricing = IMAGE_MODEL_PRICING[model]
  const inputTextTokens = usage.input_tokens_details?.text_tokens ?? usage.input_tokens
  const inputImageTokens = usage.input_tokens_details?.image_tokens ?? 0
  const outputTextTokens = usage.output_tokens_details?.text_tokens ?? 0
  const outputImageTokens = usage.output_tokens_details?.image_tokens ?? usage.output_tokens

  return (
    (inputTextTokens / 1_000_000) * pricing.textTokens.input +
    (inputImageTokens / 1_000_000) * pricing.imageTokens.input +
    (outputTextTokens / 1_000_000) * pricing.textTokens.output +
    (outputImageTokens / 1_000_000) * pricing.imageTokens.output
  )
}

const calculateImageCost = (
  model: ImageGenerationModel,
  usage: ImageUsage
): number | null => {
  if (isOpenAiImageModel(model)) {
    return calculateOpenAiCost(model, usage)
  }

  if (isGeminiImageModel(model)) {
    return calculateGeminiImageCost(model, usage)
  }

  throw new Error(`Unsupported image model "${model}"`)
}

const isCommonOpenAiImageSize = (value: string | undefined): value is CommonOpenAiImageSize => {
  return value === '1024x1024' || value === '1024x1536' || value === '1536x1024'
}

const isConcreteImageQuality = (value: string | undefined): value is ConcreteImageQuality => {
  return value === 'low' || value === 'medium' || value === 'high'
}

const estimateOpenAiOutputCost = (
  model: OpenAiImageGenerationModel,
  quality: string | undefined,
  size: string | undefined
): number | null => {
  if (!isConcreteImageQuality(quality) || !isCommonOpenAiImageSize(size)) {
    return null
  }

  return IMAGE_MODEL_PRICING[model].perImageOutput[quality][size]
}

export const estimateImageOutputCost = (
  model: ImageGenerationModel,
  quality: ImageGenerationQuality,
  size: ImageGenerationSize
): number | null => {
  if (isOpenAiImageModel(model)) {
    return estimateOpenAiOutputCost(model, quality, size)
  }

  if (isGeminiImageModel(model)) {
    return estimateGeminiImageOutputCost(model, size)
  }

  throw new Error(`Unsupported image model "${model}"`)
}

const getInputBreakdown = (
  model: ImageGenerationModel,
  usage: ImageUsage
): TokenBreakdown => {
  if (usage.input_tokens_details) {
    const textTokens = usage.input_tokens_details.text_tokens ?? 0
    const imageTokens = usage.input_tokens_details.image_tokens ?? 0
    return {
      textTokens,
      imageTokens,
      unattributedTokens: Math.max(0, usage.input_tokens - textTokens - imageTokens),
    }
  }

  if (isGeminiImageModel(model)) {
    return {
      textTokens: 0,
      imageTokens: 0,
      unattributedTokens: usage.input_tokens,
    }
  }

  return {
    textTokens: usage.input_tokens,
    imageTokens: 0,
    unattributedTokens: 0,
  }
}

const getOutputBreakdown = (
  model: ImageGenerationModel,
  usage: ImageUsage
): TokenBreakdown => {
  if (usage.output_tokens_details) {
    const textTokens = usage.output_tokens_details.text_tokens ?? 0
    const imageTokens = usage.output_tokens_details.image_tokens ?? 0
    return {
      textTokens,
      imageTokens,
      unattributedTokens: Math.max(0, usage.output_tokens - textTokens - imageTokens),
    }
  }

  if (isGeminiImageModel(model)) {
    return {
      textTokens: 0,
      imageTokens: 0,
      unattributedTokens: usage.output_tokens,
    }
  }

  return {
    textTokens: 0,
    imageTokens: usage.output_tokens,
    unattributedTokens: 0,
  }
}

const formatTokenBreakdown = (breakdown: TokenBreakdown): string => {
  const parts = [
    `${breakdown.textTokens.toLocaleString()} text`,
    `${breakdown.imageTokens.toLocaleString()} image`,
  ]

  if (breakdown.unattributedTokens > 0) {
    parts.push(`${breakdown.unattributedTokens.toLocaleString()} unattributed`)
  }

  return `(${parts.join(', ')})`
}

export const updateImageRunStatsFromUsage = (
  model: ImageGenerationModel,
  usage: ImageUsage | undefined,
  stats: ImageRunStats
): number | null => {
  if (!usage) {
    return null
  }

  const inputBreakdown = getInputBreakdown(model, usage)
  const outputBreakdown = getOutputBreakdown(model, usage)
  const cost = calculateImageCost(model, usage)

  stats.totalInputTokens += usage.input_tokens
  stats.totalInputTextTokens += inputBreakdown.textTokens
  stats.totalInputImageTokens += inputBreakdown.imageTokens
  stats.totalInputUnattributedTokens += inputBreakdown.unattributedTokens
  stats.totalOutputTokens += usage.output_tokens
  stats.totalOutputTextTokens += outputBreakdown.textTokens
  stats.totalOutputImageTokens += outputBreakdown.imageTokens
  stats.totalOutputUnattributedTokens += outputBreakdown.unattributedTokens

  if (cost !== null) {
    stats.totalCost += cost
  }

  return cost
}

export const updateImageRunStatsWithCostFallback = (
  model: ImageGenerationModel,
  usage: ImageUsage | undefined,
  stats: ImageRunStats,
  quality: ImageGenerationQuality,
  size: ImageGenerationSize
): { costLabel: string; estimated: boolean } => {
  const usageCost = updateImageRunStatsFromUsage(model, usage, stats)
  if (usageCost !== null) {
    return { costLabel: formatCost(usageCost), estimated: false }
  }

  const estimatedCost = estimateImageOutputCost(model, quality, size)
  if (estimatedCost !== null) {
    stats.totalCost += estimatedCost
    return { costLabel: `${formatCost(estimatedCost)} estimated`, estimated: true }
  }

  return { costLabel: 'unavailable', estimated: false }
}

export const logUsageAndUpdateStats = (
  model: ImageGenerationModel,
  usage: ImageUsage | undefined,
  stats: ImageRunStats
): number | null => {
  if (!usage) {
    return null
  }

  const inputBreakdown = getInputBreakdown(model, usage)
  const outputBreakdown = getOutputBreakdown(model, usage)
  const cost = updateImageRunStatsFromUsage(model, usage, stats)

  l.dim(
    `  Input tokens:     ${usage.input_tokens.toLocaleString()} ` +
    `${formatTokenBreakdown(inputBreakdown)}`
  )
  l.dim(
    `  Output tokens:    ${usage.output_tokens.toLocaleString()} ` +
    `${formatTokenBreakdown(outputBreakdown)}`
  )
  l.dim(`  Total tokens:     ${usage.total_tokens.toLocaleString()}`)

  if (cost !== null) {
    l.dim(`  Cost:             ${formatCost(cost)}`)
  }

  return cost
}
