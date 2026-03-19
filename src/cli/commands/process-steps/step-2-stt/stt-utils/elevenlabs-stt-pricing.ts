import { validateElevenlabsSttModel } from '~/cli/commands/models/model-options'
import { getSttCost } from '~/cli/commands/models/model-loader'
import type { ElevenlabsSttRateEstimate } from '~/types'


export const estimateElevenlabsSttRate = (modelRaw: string): ElevenlabsSttRateEstimate => {
  const model = validateElevenlabsSttModel(modelRaw)
  const sttCost = getSttCost('elevenlabs', model)
  const costPerHourCents = sttCost.costPerHourCents ?? 22
  return {
    provider: 'elevenlabs',
    model,
    costPerHourCents,
    costPerMinuteCents: costPerHourCents / 60,
    note: 'Business tier starting price per hour'
  }
}
