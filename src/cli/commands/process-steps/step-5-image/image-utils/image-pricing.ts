import {
  isNativeGeminiImageModel,
  validateBflImageModel,
  validateGeminiImageModel,
  validateDeapiImageModel,
  validateGlmImageModel,
  validateGrokImageModel,
  validateMinimaxImageModel,
  validateOpenAIImageModel,
  validateRunwayImageModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { getImageCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { ImageCostEstimate, EstimateImageCostOptions } from '~/types'
import * as l from '~/utils/logger'
import { createKeyValueTable } from '~/utils/logger/human-table'

type OpenAIImageQuality = 'low' | 'medium' | 'high'

const GPT_IMAGE_2_DEFAULT_COST_CENTS = 5.3
const GPT_IMAGE_2_COMMON_SIZE_COSTS: Record<string, Record<OpenAIImageQuality, number>> = {
  '1024x1024': {
    low: 0.6,
    medium: 5.3,
    high: 21.1
  },
  '1024x1536': {
    low: 0.5,
    medium: 4.1,
    high: 16.5
  },
  '1536x1024': {
    low: 0.5,
    medium: 4.1,
    high: 16.5
  }
}

const OPENAI_GPT_IMAGE_2_LATENCY_NOTE = 'Low quality is fastest; square images are typically fastest; JPEG is faster than PNG; complex prompts can take up to about 2 minutes.'

const normalizeOpenAIQualityForEstimate = (quality: string | undefined): OpenAIImageQuality => {
  const normalized = quality?.toLowerCase()
  if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
    return normalized
  }
  return 'medium'
}

const normalizeOpenAIImageSizeForEstimate = (size: string | undefined): string => {
  const normalized = size?.toLowerCase()
  if (!normalized || normalized === 'auto') {
    return '1024x1024'
  }
  return normalized
}

const estimateOpenAIImageCost = (
  model: string,
  options: Pick<EstimateImageCostOptions, 'imageSize' | 'imageQuality'>
): { costPerImageCents: number, note: string } => {
  if (model !== 'gpt-image-2') {
    return {
      costPerImageCents: getImageCost('openai', model) || 4,
      note: 'Approximate cost; see OpenAI pricing for exact rates'
    }
  }

  const quality = normalizeOpenAIQualityForEstimate(options.imageQuality)
  const size = normalizeOpenAIImageSizeForEstimate(options.imageSize)
  const documentedCost = GPT_IMAGE_2_COMMON_SIZE_COSTS[size]?.[quality]

  if (typeof documentedCost === 'number') {
    return {
      costPerImageCents: documentedCost,
      note: `Approximate OpenAI output estimate for ${size} ${quality} quality. ${OPENAI_GPT_IMAGE_2_LATENCY_NOTE}`
    }
  }

  return {
    costPerImageCents: GPT_IMAGE_2_DEFAULT_COST_CENTS,
    note: `Approximate OpenAI output estimate for a flexible gpt-image-2 size; using the 1024x1024 medium default. Check OpenAI's calculator for this exact resolution. ${OPENAI_GPT_IMAGE_2_LATENCY_NOTE}`
  }
}

export const estimateImageCosts = (options: EstimateImageCostOptions): ImageCostEstimate[] => {
  const estimates: ImageCostEstimate[] = []
  const geminiModels = options.geminiImageModels ?? (options.geminiImageModel ? [options.geminiImageModel] : [])
  const openaiModels = options.openaiImageModels ?? (options.openaiImageModel ? [options.openaiImageModel] : [])
  const minimaxModels = options.minimaxImageModels ?? (options.minimaxImageModel ? [options.minimaxImageModel] : [])
  const glmModels = options.glmImageModels ?? (options.glmImageModel ? [options.glmImageModel] : [])
  const grokModels = options.grokImageModels ?? (options.grokImageModel ? [options.grokImageModel] : [])
  const runwayModels = options.runwayImageModels ?? (options.runwayImageModel ? [options.runwayImageModel] : [])
  const bflModels = options.bflImageModels ?? (options.bflImageModel ? [options.bflImageModel] : [])
  const deapiModels = options.deapiImageModels ?? (options.deapiImageModel ? [options.deapiImageModel] : [])

  for (const rawModel of geminiModels) {
    const model = validateGeminiImageModel(rawModel)
    const imageCount = isNativeGeminiImageModel(model) ? 1 : Math.max(1, options.imageCount ?? 1)
    const costPerImageCents = getImageCost('gemini', model) || 4
    estimates.push({
      provider: 'gemini',
      model,
      imageCount,
      costPerImageCents,
      totalCost: costPerImageCents * imageCount,
      note: 'Approximate cost; see Google AI pricing for exact rates'
    })
  }

  for (const rawModel of openaiModels) {
    const model = validateOpenAIImageModel(rawModel)
    const { costPerImageCents, note } = estimateOpenAIImageCost(model, options)
    const imageCount = Math.max(1, options.imageCount ?? 1)
    estimates.push({
      provider: 'openai',
      model,
      imageCount,
      costPerImageCents,
      totalCost: costPerImageCents * imageCount,
      note
    })
  }

  for (const rawModel of minimaxModels) {
    const model = validateMinimaxImageModel(rawModel)
    const costPerImageCents = getImageCost('minimax', model)
    estimates.push({
      provider: 'minimax',
      model,
      imageCount: 1,
      costPerImageCents,
      totalCost: costPerImageCents,
      note: 'Approximate cost; see MiniMax pricing for exact rates'
    })
  }

  for (const rawModel of glmModels) {
    const model = validateGlmImageModel(rawModel)
    const costPerImageCents = getImageCost('glm', model)
    estimates.push({
      provider: 'glm',
      model,
      imageCount: 1,
      costPerImageCents,
      totalCost: costPerImageCents,
      note: 'Approximate cost; see Z.AI pricing for exact rates'
    })
  }

  for (const rawModel of grokModels) {
    const model = validateGrokImageModel(rawModel)
    const costPerImageCents = getImageCost('grok', model)
    const imageCount = Math.max(1, options.imageCount ?? 1)
    estimates.push({
      provider: 'grok',
      model,
      imageCount,
      costPerImageCents,
      totalCost: costPerImageCents * imageCount,
      note: 'Approximate cost; xAI publishes flat per-image billing and exact account pricing may vary'
    })
  }

  for (const rawModel of runwayModels) {
    const model = validateRunwayImageModel(rawModel)
    const normalizedSize = options.imageSize?.toLowerCase()
    const costPerImageCents = normalizedSize === '1080p' ? 8 : getImageCost('runway', model)
    estimates.push({
      provider: 'runway',
      model,
      imageCount: 1,
      costPerImageCents,
      totalCost: costPerImageCents,
      note: normalizedSize === '1080p'
        ? 'Approximate cost; Runway Gen-4 Image is estimated at 8 credits for 1080p'
        : 'Approximate cost; Runway Gen-4 Image defaults to 5 credits for 720p'
    })
  }

  for (const rawModel of bflModels) {
    const model = validateBflImageModel(rawModel)
    const costPerImageCents = getImageCost('bfl', model)
    estimates.push({
      provider: 'bfl',
      model,
      imageCount: 1,
      costPerImageCents,
      totalCost: costPerImageCents,
      note: 'Approximate from BFL published FLUX.2 starting prices; exact cost varies by output resolution and provider quote is used when returned'
    })
  }

  for (const rawModel of deapiModels) {
    const model = validateDeapiImageModel(rawModel)
    const costPerImageCents = getImageCost('deapi', model)
    estimates.push({
      provider: 'deapi',
      model,
      imageCount: 1,
      costPerImageCents,
      totalCost: costPerImageCents,
      note: 'Approximate cost; deAPI image pricing varies by model, resolution, and steps'
    })
  }

  return estimates
}

export const logImageEstimate = (estimate: ImageCostEstimate): void => {
  const entries: Array<readonly [string, string]> = [
    ['Provider', estimate.provider],
    ['Model', estimate.model],
    ['Image Count', String(estimate.imageCount)],
    ['Cost Per Image', `${estimate.costPerImageCents.toFixed(3)}¢`],
    ['Total Cost', `${estimate.totalCost.toFixed(3)}¢`],
    ...(estimate.note ? [['Note', estimate.note] as const] : [])
  ]
  l.write('info', `Estimated image cost for ${estimate.provider}/${estimate.model}`, {
    category: 'pricing',
    humanTable: createKeyValueTable(entries),
    metadata: estimate
  })
}
