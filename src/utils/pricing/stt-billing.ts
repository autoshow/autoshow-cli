import { getSttBilling, getSttCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import type { BilledSttCost, SttBilling } from '~/types'

const normalizeDurationSeconds = (durationSeconds: number): number =>
  Number.isFinite(durationSeconds) ? Math.max(0, durationSeconds) : 0

const normalizePositiveValue = (value: number | undefined): number | undefined =>
  Number.isFinite(value) && (value as number) > 0 ? value : undefined

const resolveBilledSttDurationSeconds = (
  durationSeconds: number,
  billing: SttBilling = {}
): number => {
  const normalizedDurationSeconds = normalizeDurationSeconds(durationSeconds)
  if (normalizedDurationSeconds <= 0) {
    return 0
  }

  const roundingIncrementSeconds = normalizePositiveValue(billing.roundingIncrementSeconds)
  const minimumSeconds = normalizePositiveValue(billing.minimumSeconds)
  const roundedDurationSeconds = roundingIncrementSeconds === undefined
    ? normalizedDurationSeconds
    : Math.ceil(normalizedDurationSeconds / roundingIncrementSeconds) * roundingIncrementSeconds

  return minimumSeconds === undefined
    ? roundedDurationSeconds
    : Math.max(minimumSeconds, roundedDurationSeconds)
}

export const computeBilledSttCost = (
  service: string,
  model: string,
  durationSeconds: number
): BilledSttCost => {
  const requestedDurationSeconds = normalizeDurationSeconds(durationSeconds)
  const billedDurationSeconds = resolveBilledSttDurationSeconds(
    requestedDurationSeconds,
    getSttBilling(service, model)
  )
  const sttCost = getSttCost(service, model)

  return {
    requestedDurationSeconds,
    billedDurationSeconds,
    cost: (billedDurationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
  }
}
