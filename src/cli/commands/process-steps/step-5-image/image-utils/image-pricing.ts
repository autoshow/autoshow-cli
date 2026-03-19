import {
  validateGeminiImageModel,
  validateMinimaxImageModel,
  validateOpenAIImageModel
} from '~/cli/commands/models/model-options'
import { getImageCost } from '~/cli/commands/models/model-loader'
import type { ImageCostEstimate, EstimateImageCostOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'


export const estimateImageCost = (options: EstimateImageCostOptions): ImageCostEstimate => {
  if (options.geminiImageModel) {
    const model = validateGeminiImageModel(options.geminiImageModel)
    const imageCount = model === 'imagen-4.0-generate-001' ? (options.imagenCount ?? 1) : 1
    const costPerImageCents = getImageCost('gemini', model) || 4
    return {
      provider: 'gemini',
      model,
      imageCount,
      costPerImageCents,
      totalCost: costPerImageCents * imageCount,
      note: 'Approximate cost; see Google AI pricing for exact rates'
    }
  }

  if (options.openaiImageModel) {
    const model = validateOpenAIImageModel(options.openaiImageModel)
    const costPerImageCents = getImageCost('openai', model) || 4
    return {
      provider: 'openai',
      model,
      imageCount: 1,
      costPerImageCents,
      totalCost: costPerImageCents,
      note: 'Approximate cost; see OpenAI pricing for exact rates'
    }
  }

  if (options.minimaxImageModel) {
    const model = validateMinimaxImageModel(options.minimaxImageModel)
    const costPerImageCents = getImageCost('minimax', model)
    return {
      provider: 'minimax',
      model,
      imageCount: 1,
      costPerImageCents,
      totalCost: costPerImageCents,
      note: 'Approximate cost; see MiniMax pricing for exact rates'
    }
  }

  throw CLIUsageError('No image provider specified. Use --gemini-image, --openai-image, or --minimax-image.')
}
