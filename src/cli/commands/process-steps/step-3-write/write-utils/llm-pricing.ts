import { getLlmCost } from '~/cli/commands/models/model-loader'
import type { ResolvedLLMConfig } from '~/cli/commands/process-steps/step-1-download/targets/llm-defaults'
import type { LlmRateEstimate } from '~/types'


const SERVICE_ORDER: Array<{ key: keyof ResolvedLLMConfig, service: string, modelKey: keyof ResolvedLLMConfig }> = [
  { key: 'useOpenAI', service: 'openai', modelKey: 'openaiModel' },
  { key: 'useGroq', service: 'groq', modelKey: 'groqModel' },
  { key: 'useGemini', service: 'gemini', modelKey: 'geminiModel' },
  { key: 'useAnthropic', service: 'anthropic', modelKey: 'anthropicModel' },
  { key: 'useMinimax', service: 'minimax', modelKey: 'minimaxModel' },
]

export const estimateLlmRates = (llmConfig: ResolvedLLMConfig): LlmRateEstimate[] => {
  const estimates: LlmRateEstimate[] = []

  for (const { key, service, modelKey } of SERVICE_ORDER) {
    const model = llmConfig[modelKey]
    if (llmConfig[key] && typeof model === 'string') {
      const cost = getLlmCost(service, model)
      estimates.push({
        provider: service,
        model,
        inputCostPer1MCents: cost?.inputCostPer1MCents ?? 0,
        outputCostPer1MCents: cost?.outputCostPer1MCents ?? 0
      })
    }
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
