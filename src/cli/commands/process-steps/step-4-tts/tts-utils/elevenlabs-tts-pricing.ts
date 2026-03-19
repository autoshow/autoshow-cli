import { validateElevenlabsTtsModel } from '~/cli/commands/models/model-options'
import { getTtsCost } from '~/cli/commands/models/model-loader'
import type { ElevenlabsTtsCostEstimate, ElevenlabsTtsRateEstimate } from '~/types'


export const estimateElevenlabsTtsRate = (modelRaw: string): ElevenlabsTtsRateEstimate => {
  const model = validateElevenlabsTtsModel(modelRaw)
  const costPer1kCharactersCents = getTtsCost('elevenlabs', model) || 12
  return {
    provider: 'elevenlabs',
    model,
    costPer1kCharactersCents,
    sampleCostFor1kCharactersCents: costPer1kCharactersCents,
    note: 'Business tier starting price per 1K characters'
  }
}

export const estimateElevenlabsTtsCost = (modelRaw: string, characterCount: number): ElevenlabsTtsCostEstimate => {
  const estimate = estimateElevenlabsTtsRate(modelRaw)
  const normalizedCharCount = Math.max(0, Math.floor(characterCount))
  return {
    provider: estimate.provider,
    model: estimate.model,
    characterCount: normalizedCharCount,
    costPer1kCharactersCents: estimate.costPer1kCharactersCents,
    totalCost: (normalizedCharCount / 1000) * estimate.costPer1kCharactersCents,
    ...(estimate.note ? { note: estimate.note } : {})
  }
}
