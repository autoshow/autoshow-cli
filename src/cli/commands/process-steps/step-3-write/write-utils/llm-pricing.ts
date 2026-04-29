import { getLlmCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { ResolvedLLMConfig } from '~/types'
import type { LlmRateEstimate } from '~/types'


const SERVICE_ORDER: Array<{ service: string, modelKey: keyof ResolvedLLMConfig }> = [
  { service: 'openai', modelKey: 'openaiModels' },
  { service: 'groq', modelKey: 'groqModels' },
  { service: 'gemini', modelKey: 'geminiModels' },
  { service: 'anthropic', modelKey: 'anthropicModels' },
  { service: 'minimax', modelKey: 'minimaxModels' },
  { service: 'grok', modelKey: 'grokModels' },
  { service: 'glm', modelKey: 'glmModels' },
]

export const estimateLlmRates = (llmConfig: ResolvedLLMConfig): LlmRateEstimate[] => {
  const estimates: LlmRateEstimate[] = []

  for (const { service, modelKey } of SERVICE_ORDER) {
    const models = llmConfig[modelKey]
    for (const model of Array.isArray(models) ? models : []) {
      const cost = getLlmCost(service, model)
      estimates.push({
        provider: service,
        model,
        inputCostPer1MCents: cost?.inputCostPer1MCents ?? 0,
        outputCostPer1MCents: cost?.outputCostPer1MCents ?? 0
      })
    }
  }

  for (const model of llmConfig.llamaModels ?? []) {
    const cost = getLlmCost('llama', model)
    estimates.push({
      provider: 'llama',
      model,
      inputCostPer1MCents: cost?.inputCostPer1MCents ?? 0,
      outputCostPer1MCents: cost?.outputCostPer1MCents ?? 0
    })
  }

  return estimates
}
