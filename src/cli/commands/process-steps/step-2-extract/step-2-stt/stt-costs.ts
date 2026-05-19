import type {
  AggregatedPriceEstimate,
  Step2Metadata,
  StepTimingCost,
  SttTarget
} from '~/types'
import type { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { preflightToEstimated } from '~/utils/pricing/compute-costs'
import { getSttTargetKey } from './stt-targets'
import { buildTimingProviderModelLabel } from './stt-prompt'

const filterSttPreflightEstimateByTargets = (
  estimate: AggregatedPriceEstimate,
  targets: SttTarget[]
): AggregatedPriceEstimate => {
  const targetKeys = new Set(targets.map(getSttTargetKey))
  const steps = estimate.steps.filter((step) =>
    step.step === 'stt' && targetKeys.has(`${step.provider}:${step.model}`)
  )

  return {
    steps,
    totalEstimatedCost: steps.reduce((sum, step) => sum + step.totalCost, 0),
    ...(estimate.notes && estimate.notes.length > 0 ? { notes: estimate.notes } : {})
  }
}

export const resolveSttEstimatedCosts = (
  preflightEstimate: AggregatedPriceEstimate | undefined,
  targets: SttTarget[],
  durationSeconds: number,
  sourceUrl?: string | undefined
) => preflightEstimate
  ? preflightToEstimated(filterSttPreflightEstimateByTargets(preflightEstimate, targets))
  : computeEstimatedCosts({
      applyCostMultipliers: false,
      sttTargets: targets.map((entry) => ({ service: entry.service, model: entry.model })),
      audioDurationSeconds: durationSeconds,
      sourceUrl
    })

export const buildSingleStepSummaries = (
  acquisitionTimeMs: number,
  step2Metadata: Step2Metadata,
  actualCost: ReturnType<typeof computeActualCosts>
): StepTimingCost[] => [
  {
    label: 'Download',
    processingTime: acquisitionTimeMs,
    cost: 0
  },
  {
    label: 'Transcribe',
    providerModel: buildTimingProviderModelLabel(step2Metadata),
    processingTime: step2Metadata.processingTime,
    cost: actualCost.steps.find((step) => step.step === 'stt')?.cost ?? 0
  }
]

export const filterEstimatedSttCosts = (
  estimate: ReturnType<typeof computeEstimatedCosts>
): ReturnType<typeof computeEstimatedCosts> => {
  const steps = estimate.steps.filter((step) => step.step === 'stt')
  return {
    totalCost: steps.reduce((sum, step) => sum + step.cost, 0),
    steps
  }
}
