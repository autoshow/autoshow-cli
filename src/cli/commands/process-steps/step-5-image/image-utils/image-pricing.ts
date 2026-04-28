import {
  isNativeGeminiImageModel,
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

export const estimateImageCosts = (options: EstimateImageCostOptions): ImageCostEstimate[] => {
  const estimates: ImageCostEstimate[] = []
  const geminiModels = options.geminiImageModels ?? (options.geminiImageModel ? [options.geminiImageModel] : [])
  const openaiModels = options.openaiImageModels ?? (options.openaiImageModel ? [options.openaiImageModel] : [])
  const minimaxModels = options.minimaxImageModels ?? (options.minimaxImageModel ? [options.minimaxImageModel] : [])
  const glmModels = options.glmImageModels ?? (options.glmImageModel ? [options.glmImageModel] : [])
  const grokModels = options.grokImageModels ?? (options.grokImageModel ? [options.grokImageModel] : [])
  const runwayModels = options.runwayImageModels ?? (options.runwayImageModel ? [options.runwayImageModel] : [])
  const deapiModels = options.deapiImageModels ?? (options.deapiImageModel ? [options.deapiImageModel] : [])

  for (const rawModel of geminiModels) {
    const model = validateGeminiImageModel(rawModel)
    const imageCount = isNativeGeminiImageModel(model) ? 1 : Math.max(1, options.imagenCount ?? 1)
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
    const costPerImageCents = getImageCost('openai', model) || 4
    estimates.push({
      provider: 'openai',
      model,
      imageCount: 1,
      costPerImageCents,
      totalCost: costPerImageCents,
      note: 'Approximate cost; see OpenAI pricing for exact rates'
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
    estimates.push({
      provider: 'grok',
      model,
      imageCount: 1,
      costPerImageCents,
      totalCost: costPerImageCents,
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
    ['Cost Per Image', `${estimate.costPerImageCents.toFixed(4)}¢`],
    ['Total Cost', `${estimate.totalCost.toFixed(5)}¢`],
    ...(estimate.note ? [['Note', estimate.note] as const] : [])
  ]
  l.write('info', `Estimated image cost for ${estimate.provider}/${estimate.model}`, {
    category: 'pricing',
    humanTable: createKeyValueTable(entries),
    metadata: estimate
  })
}
