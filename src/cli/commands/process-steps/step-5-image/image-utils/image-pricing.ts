import {
  isNativeGeminiImageModel,
  validateGeminiImageModel,
  validateMinimaxImageModel,
  validateOpenAIImageModel
} from '~/cli/commands/models/model-options'
import { getImageCost } from '~/cli/commands/models/model-loader'
import type { ImageCostEstimate, EstimateImageCostOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

export const estimateImageCosts = (options: EstimateImageCostOptions): ImageCostEstimate[] => {
  const estimates: ImageCostEstimate[] = []

  if (options.geminiImageModel) {
    const model = validateGeminiImageModel(options.geminiImageModel)
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

  if (options.openaiImageModel) {
    const model = validateOpenAIImageModel(options.openaiImageModel)
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

  if (options.minimaxImageModel) {
    const model = validateMinimaxImageModel(options.minimaxImageModel)
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
