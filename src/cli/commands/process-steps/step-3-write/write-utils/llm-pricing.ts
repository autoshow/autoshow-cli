import { getLlmCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { ResolvedLLMConfig } from '~/cli/commands/process-steps/step-1-download/targets/llm-defaults'
import type { LlmRateEstimate } from '~/types'


const SERVICE_ORDER: Array<{ service: string, modelKey: keyof ResolvedLLMConfig }> = [
  { service: 'openai', modelKey: 'openaiModel' },
  { service: 'groq', modelKey: 'groqModel' },
  { service: 'gemini', modelKey: 'geminiModel' },
  { service: 'anthropic', modelKey: 'anthropicModel' },
  { service: 'minimax', modelKey: 'minimaxModel' },
]

export const estimateLlmRates = (llmConfig: ResolvedLLMConfig): LlmRateEstimate[] => {
  const estimates: LlmRateEstimate[] = []

  for (const { service, modelKey } of SERVICE_ORDER) {
    const model = llmConfig[modelKey]
    if (typeof model === 'string') {
      const cost = getLlmCost(service, model)
      estimates.push({
        provider: service,
        model,
        inputCostPer1MCents: cost?.inputCostPer1MCents ?? 0,
        outputCostPer1MCents: cost?.outputCostPer1MCents ?? 0
      })
    }
  }

  if (llmConfig.grokModel) {
    const cost = getLlmCost('grok', llmConfig.grokModel)
    estimates.push({
      provider: 'grok',
      model: llmConfig.grokModel,
      inputCostPer1MCents: cost?.inputCostPer1MCents ?? 0,
      outputCostPer1MCents: cost?.outputCostPer1MCents ?? 0
    })
  }

  if (llmConfig.llamaModel) {
    const cost = getLlmCost('llama', llmConfig.llamaModel)
    estimates.push({
      provider: 'llama',
      model: llmConfig.llamaModel,
      inputCostPer1MCents: cost?.inputCostPer1MCents ?? 0,
      outputCostPer1MCents: cost?.outputCostPer1MCents ?? 0
    })
  }

  return estimates
}
