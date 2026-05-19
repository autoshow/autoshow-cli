import type { RuntimeOptions, TtsStepEstimate } from '~/types'
import { estimateTtsCosts } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-pricing'
import { resolveDeapiTtsPrice } from '~/cli/commands/process-steps/step-4-tts/tts-services/deapi/deapi-tts-pricing'
import { getTtsEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { resolvePromptTokenEstimate } from '~/prompts/prompt-loader'
import { applyCostMultiplier } from '~/utils/pricing/cost-helpers'

const ESTIMATED_TTS_CHARACTERS_PER_TOKEN = 4

export const estimateTtsCharacterCountFromPrompts = async (opts: RuntimeOptions): Promise<number> => {
  const promptTokenEstimate = await resolvePromptTokenEstimate(opts.prompts)
  const estimatedOutputTokens = Math.max(0, promptTokenEstimate.estimatedOutputTokens)
  return Math.max(0, Math.round(estimatedOutputTokens * ESTIMATED_TTS_CHARACTERS_PER_TOKEN))
}

export const buildTtsEstimates = async (opts: RuntimeOptions, characterCount: number): Promise<TtsStepEstimate[]> => {
  const normalizedCharacterCount = Math.max(0, Math.floor(characterCount))
  const estimates: TtsStepEstimate[] = []
  for (const cost of estimateTtsCosts(opts, normalizedCharacterCount)) {
    const estimation = getTtsEstimation(cost.provider, cost.model)
    if (cost.provider === 'deapi') {
      const price = await resolveDeapiTtsPrice({
        model: cost.model as Parameters<typeof resolveDeapiTtsPrice>[0]['model'],
        characterCount: normalizedCharacterCount,
        voice: opts.deapiTtsVoice,
        mode: opts.deapiTtsRefAudio ? 'voice_clone' : 'custom_voice'
      })
      estimates.push({
        step: 'tts',
        provider: cost.provider,
        model: cost.model,
        characterCount: cost.characterCount,
        totalCost: price.source === 'provider_quote'
          ? price.totalCost
          : applyCostMultiplier(price.totalCost, estimation.costMultiplier),
        costMultiplier: price.source === 'provider_quote' ? 1 : estimation.costMultiplier,
        estimateType: price.estimateType,
        ...(price.warning ? { note: price.warning } : {})
      })
      continue
    }

    estimates.push({
      step: 'tts' as const,
      provider: cost.provider,
      model: cost.model,
      ...(cost.costPer1kCharactersCents !== undefined ? { costPer1kCharactersCents: cost.costPer1kCharactersCents } : {}),
      ...(cost.inputCostPer1MCharactersCents !== undefined ? { inputCostPer1MCharactersCents: cost.inputCostPer1MCharactersCents } : {}),
      ...(cost.outputCostPer1MCharactersCents !== undefined ? { outputCostPer1MCharactersCents: cost.outputCostPer1MCharactersCents } : {}),
      characterCount: cost.characterCount,
      ...(cost.setupCostCents !== undefined ? { setupCostCents: cost.setupCostCents } : {}),
      ...(cost.setupTimeMs !== undefined ? { setupTimeMs: cost.setupTimeMs } : {}),
      totalCost: applyCostMultiplier(cost.totalCost - (cost.setupCostCents ?? 0), estimation.costMultiplier) + (cost.setupCostCents ?? 0),
      costMultiplier: estimation.costMultiplier,
      ...(cost.setupNote ? { note: cost.setupNote } : {}),
    })
  }
  return estimates
}
