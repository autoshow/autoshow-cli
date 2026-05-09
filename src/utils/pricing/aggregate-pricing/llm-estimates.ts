import type { LlmStepEstimate, RuntimeOptions } from '~/types'
import { resolveLLMDefaults } from '~/cli/commands/process-steps/step-1-download/targets/llm-defaults'
import { estimateLlmRates } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-pricing'
import { estimatePromptTokensFromText, readPromptFileText } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { getLlmEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolvePromptTokenEstimate } from '~/prompts/prompt-loader'
import { applyCostMultiplier } from '~/utils/pricing/cost-helpers'

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
    const totalCost = applyCostMultiplier(
      (estimatedInputTokens / 1_000_000) * r.inputCostPer1MCents +
      (estimatedOutputTokens / 1_000_000) * r.outputCostPer1MCents,
      estimation.costMultiplier
    )

    return {
      step: 'llm' as const,
      provider: r.provider,
      model: r.model,
      inputCostPer1MCents: r.inputCostPer1MCents,
      outputCostPer1MCents: r.outputCostPer1MCents,
      estimatedInputTokens,
      estimatedOutputTokens,
      totalCost,
      costMultiplier: estimation.costMultiplier,
    }
  })
}
