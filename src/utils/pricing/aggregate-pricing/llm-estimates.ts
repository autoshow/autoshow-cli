import type { LlmStepEstimate, RuntimeOptions } from '~/types'
import { resolveLLMDefaults } from '~/cli/commands/process-steps/step-1-download/targets/llm-defaults'
import { estimateLlmRates } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-pricing'
import { estimatePromptTokensFromText, readPromptFileText } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { getLlmCost, getLlmEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolvePromptTokenEstimate } from '~/prompts/prompt-loader'
import { computeTokenCost } from '~/utils/pricing/token-pricing'

export const buildLlmEstimates = async (
  opts: RuntimeOptions,
  skipLLM: boolean
): Promise<LlmStepEstimate[]> => {
  if (skipLLM) return []
  const llmConfig = resolveLLMDefaults(opts)
  const rates = estimateLlmRates(llmConfig)
  const promptFileOnly = typeof opts.promptFile === 'string' && opts.promptFile.length > 0 && opts.prompts.length === 0
  const promptTokenEstimate = await resolvePromptTokenEstimate(opts.prompts, {
    fallbackToDefault: !promptFileOnly
  })
  const promptFileText = await readPromptFileText(opts.promptFile)
  const extraPromptTokens = promptFileText ? estimatePromptTokensFromText(promptFileText) : 0

  return rates.map(r => {
    const registryService = r.provider === 'llama.cpp' ? 'llama' : r.provider
    const estimation = getLlmEstimation(registryService, r.model)
    const estimatedInputTokens = promptTokenEstimate.estimatedInputTokens + extraPromptTokens
    const estimatedOutputTokens = promptTokenEstimate.estimatedOutputTokens
    const cost = computeTokenCost(
      getLlmCost(registryService, r.model) ?? r,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimation.costMultiplier
    )

    return {
      step: 'llm' as const,
      provider: r.provider,
      model: r.model,
      inputCostPer1MCents: cost.inputCostPer1MCents,
      outputCostPer1MCents: cost.outputCostPer1MCents,
      estimatedInputTokens,
      estimatedOutputTokens,
      totalCost: cost.totalCost,
      costMultiplier: estimation.costMultiplier,
      ...(typeof cost.pricingBand === 'string' ? { pricingBand: cost.pricingBand } : {}),
      ...(typeof cost.pricingNote === 'string' ? { pricingNote: cost.pricingNote } : {})
    }
  })
}
