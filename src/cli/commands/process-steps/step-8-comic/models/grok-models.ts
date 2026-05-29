import type {
  GrokLlmModel,
  GrokLlmUsageLike,
  TokenPricing,
} from '../types/comic-types'

export const GROK_LLM_MODELS = ['grok-4.3'] as const

export const GROK_LLM_PRICING: Record<GrokLlmModel, TokenPricing> = {
  'grok-4.3': {
    input: 1.25,
    cachedInput: 0.2,
    output: 2.5,
  },
}

export const calculateGrokLlmCost = (
  model: GrokLlmModel,
  usage: GrokLlmUsageLike
): number => {
  const pricing = GROK_LLM_PRICING[model]
  const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0
  const uncachedInputTokens = usage.input_tokens - cachedTokens

  return (
    (uncachedInputTokens / 1_000_000) * pricing.input +
    (cachedTokens / 1_000_000) * pricing.cachedInput +
    (usage.output_tokens / 1_000_000) * pricing.output
  )
}
