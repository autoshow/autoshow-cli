import {
  getTtsCost,
  getTtsPricing
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeBilledSttCost } from '~/utils/pricing/stt-billing'

export const parseDurationToSeconds = (duration: string): number => {
  if (!duration || duration === 'Unknown') return 0
  const parts = duration.split(':').map(Number)
  if (parts.length === 3) return (parts[0]! * 3600) + (parts[1]! * 60) + parts[2]!
  if (parts.length === 2) return (parts[0]! * 60) + parts[1]!
  return 0
}

export const computeTtsCost = (
  service: string,
  model: string,
  characterCount: number
): {
  cost: number
  costPer1kCharactersCents?: number
  characterBillingBlockSize?: number
  characterBillingBlockCostCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
} => {
  const pricing = getTtsPricing(service, model)
  if (
    pricing.characterBillingBlockSize !== undefined
    && pricing.characterBillingBlockCostCents !== undefined
  ) {
    const blockSize = Math.max(1, pricing.characterBillingBlockSize)
    return {
      cost: Math.ceil(Math.max(0, characterCount) / blockSize) * pricing.characterBillingBlockCostCents,
      ...(pricing.costPer1kCharsCents !== undefined ? { costPer1kCharactersCents: pricing.costPer1kCharsCents } : {}),
      characterBillingBlockSize: blockSize,
      characterBillingBlockCostCents: pricing.characterBillingBlockCostCents
    }
  }

  if (
    pricing.inputCostPer1MCharsCents !== undefined
    && pricing.outputCostPer1MCharsCents !== undefined
  ) {
    return {
      cost: (characterCount / 1e6) * (pricing.inputCostPer1MCharsCents + pricing.outputCostPer1MCharsCents),
      inputCostPer1MCharactersCents: pricing.inputCostPer1MCharsCents,
      outputCostPer1MCharactersCents: pricing.outputCostPer1MCharsCents
    }
  }

  const costPer1kCharactersCents = pricing.costPer1kCharsCents ?? getTtsCost(service, model)
  return {
    cost: (characterCount / 1000) * costPer1kCharactersCents,
    costPer1kCharactersCents
  }
}

export const applyCostMultiplier = (cost: number, multiplier: number): number => cost * multiplier

export const computeSttCost = (service: string, model: string, durationSeconds: number): number =>
  computeBilledSttCost(service, model, durationSeconds).cost
