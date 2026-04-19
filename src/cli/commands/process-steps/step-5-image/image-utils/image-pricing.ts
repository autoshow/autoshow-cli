import {
  isNativeGeminiImageModel,
  validateGeminiImageModel,
  validateMinimaxImageModel,
  validateOpenAIImageModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { getImageCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { ImageCostEstimate, EstimateImageCostOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

export const estimateImageCosts = (options: EstimateImageCostOptions): ImageCostEstimate[] => {
  const estimates: ImageCostEstimate[] = []
  const geminiModels = options.geminiImageModels ?? (options.geminiImageModel ? [options.geminiImageModel] : [])
  const openaiModels = options.openaiImageModels ?? (options.openaiImageModel ? [options.openaiImageModel] : [])
  const minimaxModels = options.minimaxImageModels ?? (options.minimaxImageModel ? [options.minimaxImageModel] : [])

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

  return estimates
}

export const estimateImageCost = (options: EstimateImageCostOptions): ImageCostEstimate => {
  const estimates = estimateImageCosts(options)
  if (estimates.length === 0) {
    throw CLIUsageError('No image provider specified. Use --gemini-image, --openai-image, or --minimax-image.')
  }

  return estimates[0] as ImageCostEstimate
}
