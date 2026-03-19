import { getTtsCost, getTtsPricing } from '~/cli/commands/models/model-loader'
import type { RuntimeOptions } from '~/types'
import type { TtsProvider } from '~/types'
import type { TtsRateEstimate, TtsCostEstimate } from '~/types'


const TTS_ENGINES: Array<{ service: TtsProvider, modelKey: keyof RuntimeOptions }> = [
  { service: 'kitten', modelKey: 'kittenTtsModel' },
  { service: 'elevenlabs', modelKey: 'elevenlabsTtsModel' },
  { service: 'minimax', modelKey: 'minimaxTtsModel' },
  { service: 'groq', modelKey: 'groqTtsModel' },
  { service: 'openai', modelKey: 'openaiTtsModel' },
  { service: 'gemini', modelKey: 'geminiTtsModel' },
]

export const estimateTtsRate = (opts: RuntimeOptions): TtsRateEstimate | null => {
  for (const { service, modelKey } of TTS_ENGINES) {
    const model = opts[modelKey]
    if (typeof model === 'string') {
      const pricing = getTtsPricing(service, model)
      const hasDualRates = pricing.inputCostPer1MCharsCents !== undefined && pricing.outputCostPer1MCharsCents !== undefined
      if (hasDualRates) {
        const inputRate = pricing.inputCostPer1MCharsCents as number
        const outputRate = pricing.outputCostPer1MCharsCents as number
        return {
          provider: service,
          model,
          inputCostPer1MCharactersCents: inputRate,
          outputCostPer1MCharactersCents: outputRate
        }
      }

      return {
        provider: service,
        model,
        costPer1kCharactersCents: pricing.costPer1kCharsCents ?? getTtsCost(service, model)
      }
    }
  }
  return null
}

export const estimateTtsCost = (opts: RuntimeOptions, characterCount: number): TtsCostEstimate | null => {
  const rate = estimateTtsRate(opts)
  if (!rate) return null
  const normalizedCharCount = Math.max(0, Math.floor(characterCount))
  const dualRateTotal = (
    rate.inputCostPer1MCharactersCents !== undefined
    && rate.outputCostPer1MCharactersCents !== undefined
  )
    ? (normalizedCharCount / 1e6) * (rate.inputCostPer1MCharactersCents + rate.outputCostPer1MCharactersCents)
    : undefined
  const per1kTotal = rate.costPer1kCharactersCents !== undefined
    ? (normalizedCharCount / 1000) * rate.costPer1kCharactersCents
    : undefined
  const totalCost = dualRateTotal ?? per1kTotal ?? 0
  return {
    provider: rate.provider,
    model: rate.model,
    characterCount: normalizedCharCount,
    ...(rate.costPer1kCharactersCents !== undefined ? { costPer1kCharactersCents: rate.costPer1kCharactersCents } : {}),
    ...(rate.inputCostPer1MCharactersCents !== undefined ? { inputCostPer1MCharactersCents: rate.inputCostPer1MCharactersCents } : {}),
    ...(rate.outputCostPer1MCharactersCents !== undefined ? { outputCostPer1MCharactersCents: rate.outputCostPer1MCharactersCents } : {}),
    totalCost
  }
}
