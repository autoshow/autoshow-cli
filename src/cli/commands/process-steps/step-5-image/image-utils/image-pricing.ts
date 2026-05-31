import {
  validateBflImageModel,
  validateGeminiImageModel,
  validateGrokImageModel,
  validateOpenAIImageModel,
  validateReveImageModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { getImageCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { ImageCostEstimate, EstimateImageCostOptions } from '~/types'
import * as l from '~/utils/logger'
import { createKeyValueTable } from '~/utils/logger/human-table'

type OpenAIImageQuality = 'low' | 'medium' | 'high'

type OpenAIImageOutputPricing = {
  defaultCostCents: number
  commonSizeCosts: Record<string, Record<OpenAIImageQuality, number>>
  label: string
  supportsFlexibleSizes?: boolean
}

const OPENAI_IMAGE_OUTPUT_PRICE_CENTS: Partial<Record<string, OpenAIImageOutputPricing>> = {
  'gpt-image-2': {
    label: 'GPT Image 2',
    defaultCostCents: 5.3,
    supportsFlexibleSizes: true,
    commonSizeCosts: {
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
  },
  'gpt-image-1.5': {
    label: 'GPT Image 1.5',
    defaultCostCents: 3.4,
    commonSizeCosts: {
      '1024x1024': {
        low: 0.9,
        medium: 3.4,
        high: 13.3
      },
      '1024x1536': {
        low: 1.3,
        medium: 5,
        high: 20
      },
      '1536x1024': {
        low: 1.3,
        medium: 5,
        high: 20
      }
    }
  }
}

const OPENAI_IMAGE_LATENCY_NOTE = 'Low quality is fastest; square images are typically fastest; JPEG is faster than PNG; complex prompts can take up to about 2 minutes.'
const OPENAI_IMAGE_INPUT_COST_NOTE = 'Estimate covers image output only; OpenAI also bills text and image input tokens when present.'

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
  const pricing = OPENAI_IMAGE_OUTPUT_PRICE_CENTS[model]
  if (!pricing) {
    return {
      costPerImageCents: getImageCost('openai', model) || 4,
      note: `Approximate cost; see OpenAI pricing for exact rates. ${OPENAI_IMAGE_INPUT_COST_NOTE}`
    }
  }

  const quality = normalizeOpenAIQualityForEstimate(options.imageQuality)
  const size = normalizeOpenAIImageSizeForEstimate(options.imageSize)
  const documentedCost = pricing.commonSizeCosts[size]?.[quality]

  if (typeof documentedCost === 'number') {
    return {
      costPerImageCents: documentedCost,
      note: `Approximate ${pricing.label} output estimate for ${size} ${quality} quality. ${OPENAI_IMAGE_INPUT_COST_NOTE} ${OPENAI_IMAGE_LATENCY_NOTE}`
    }
  }

  const sizeDescription = pricing.supportsFlexibleSizes
    ? 'a flexible size'
    : 'an unsupported size'
  return {
    costPerImageCents: pricing.defaultCostCents,
    note: `Approximate ${pricing.label} output estimate for ${sizeDescription}; using the 1024x1024 medium default. ${OPENAI_IMAGE_INPUT_COST_NOTE} Check OpenAI's calculator for this exact resolution. ${OPENAI_IMAGE_LATENCY_NOTE}`
  }
}

export const estimateImageCosts = (options: EstimateImageCostOptions): ImageCostEstimate[] => {
  const estimates: ImageCostEstimate[] = []
  const geminiModels = options.geminiImageModels ?? (options.geminiImageModel ? [options.geminiImageModel] : [])
  const openaiModels = options.openaiImageModels ?? (options.openaiImageModel ? [options.openaiImageModel] : [])
  const grokModels = options.grokImageModels ?? (options.grokImageModel ? [options.grokImageModel] : [])
  const bflModels = options.bflImageModels ?? (options.bflImageModel ? [options.bflImageModel] : [])
  const reveModels = options.reveImageModels ?? (options.reveImageModel ? [options.reveImageModel] : [])

  for (const rawModel of geminiModels) {
    const model = validateGeminiImageModel(rawModel)
    const costPerImageCents = getImageCost('gemini', model) || 4
    estimates.push({
      provider: 'gemini',
      model,
      imageCount: 1,
      costPerImageCents,
      totalCost: costPerImageCents,
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

  for (const rawModel of reveModels) {
    const model = validateReveImageModel(rawModel)
    const costPerImageCents = getImageCost('reve', model)
    estimates.push({
      provider: 'reve',
      model,
      imageCount: 1,
      costPerImageCents,
      totalCost: costPerImageCents,
      note: 'Approximate fallback based on $10 / 7500 Reve credits; provider usage headers are used when returned'
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
