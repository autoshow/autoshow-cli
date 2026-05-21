import type { RuntimeOptions, SttStepEstimate } from '~/types'
import { estimateElevenlabsSttRate } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/elevenlabs-stt-pricing'
import { resolveSttInputDurationSeconds } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-duration'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import {
  buildHappyScribeRegistryEstimate,
  resolveHappyScribePriceNotes
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/happyscribe/happyscribe-pricing'
import { resolveYoutubeCaptionEstimateTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/youtube-captions'
import {
  getSttCost,
  getSttEstimation
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import { applyCostMultiplier } from '~/utils/pricing/cost-helpers'
import { computeBilledSttCost } from '~/utils/pricing/stt-billing'
import { estimateSupadataCost } from '~/utils/pricing/supadata-pricing'
import { estimateScrapeCreatorsCost } from '~/utils/pricing/scrapecreators-pricing'

const buildCloudSttEstimate = async (
  provider: string,
  model: string,
  durationSeconds: number
): Promise<SttStepEstimate> => {
  const estimation = getSttEstimation(provider, model)
  const totalCost = applyCostMultiplier(computeBilledSttCost(provider, model, durationSeconds).cost, estimation.costMultiplier)
  return { step: 'stt', provider, model, durationSeconds, totalCost, costMultiplier: estimation.costMultiplier }
}

const buildSupadataSttEstimate = (
  model: string,
  durationSeconds: number,
  sourceUrl: string
): SttStepEstimate => {
  const estimation = getSttEstimation('supadata', model)
  const cost = estimateSupadataCost(model, durationSeconds, { sourceUrl })
  return {
    step: 'stt',
    provider: 'supadata',
    model,
    durationSeconds,
    totalCost: applyCostMultiplier(cost.totalCost, estimation.costMultiplier),
    costMultiplier: estimation.costMultiplier,
    note: cost.note
  }
}

const buildScrapeCreatorsSttEstimate = (
  model: string
): SttStepEstimate => {
  const estimation = getSttEstimation('scrapecreators', model)
  const cost = estimateScrapeCreatorsCost()
  return {
    step: 'stt',
    provider: 'scrapecreators',
    model,
    durationSeconds: 0,
    totalCost: applyCostMultiplier(cost.totalCost, estimation.costMultiplier),
    costMultiplier: estimation.costMultiplier,
    note: cost.note
  }
}

const buildHappyScribeSttEstimate = async (
  model: string,
  durationSeconds: number,
  preferredOrganizationId: string | undefined
): Promise<SttStepEstimate> => {
  const estimation = getSttEstimation('happyscribe', model)
  const totalCost = applyCostMultiplier(buildHappyScribeRegistryEstimate(model, durationSeconds), estimation.costMultiplier)
  const notes = await resolveHappyScribePriceNotes({ preferredOrganizationId })

  return {
    step: 'stt',
    provider: 'happyscribe',
    model,
    durationSeconds,
    totalCost,
    costMultiplier: estimation.costMultiplier,
    ...(notes.length > 0 ? { note: notes.join(' ') } : {})
  }
}

export const buildSttEstimates = async (
  resolvedTarget: string,
  opts: RuntimeOptions
): Promise<SttStepEstimate[]> => {
  const captionTargets = opts.youtubeCaptions && /^https?:\/\//i.test(resolvedTarget)
    ? await resolveYoutubeCaptionEstimateTargets(resolvedTarget)
    : null
  const targets = captionTargets
    ? captionTargets.map((target) => ({ ...target, local: false }))
    : collectSttTargets(opts)
  if (targets.length === 0) {
    return []
  }

  const needsDuration = targets.some((target) =>
    target.service !== 'whisper'
    && target.service !== 'reverb'
    && target.service !== 'scrapecreators'
  )
  const durationSeconds = needsDuration ? await resolveSttInputDurationSeconds(resolvedTarget, targets) : 0
  const estimates: SttStepEstimate[] = []

  for (const target of targets) {
    if (target.service === 'reverb') {
      estimates.push({ step: 'stt', provider: 'reverb', model: 'reverb', durationSeconds: 0, totalCost: 0, costMultiplier: 1 })
      continue
    }

    if (target.service === 'whisper') {
      const sttCost = getSttCost('whisper', target.model)
      const estimation = getSttEstimation('whisper', target.model)
      estimates.push({
        step: 'stt',
        provider: 'whisper',
        model: target.model,
        durationSeconds: 0,
        totalCost: applyCostMultiplier(sttCost.costPerHourCents ?? 0, estimation.costMultiplier),
        costMultiplier: estimation.costMultiplier,
      })
      continue
    }

    if (target.service === 'elevenlabs') {
      const rate = estimateElevenlabsSttRate(target.model)
      const estimation = getSttEstimation('elevenlabs', target.model)
      estimates.push({
        step: 'stt',
        provider: 'elevenlabs',
        model: rate.model,
        durationSeconds,
        totalCost: applyCostMultiplier((durationSeconds / 3600) * rate.costPerHourCents, estimation.costMultiplier),
        costMultiplier: estimation.costMultiplier
      })
      continue
    }

    if (target.service === 'supadata') {
      estimates.push(buildSupadataSttEstimate(target.model, durationSeconds, resolvedTarget))
      continue
    }

    if (target.service === 'scrapecreators') {
      estimates.push(buildScrapeCreatorsSttEstimate(target.model))
      continue
    }

    if (target.service === 'happyscribe') {
      estimates.push(await buildHappyScribeSttEstimate(target.model, durationSeconds, opts.happyscribeOrganizationId))
      continue
    }

    estimates.push(await buildCloudSttEstimate(target.service, target.model, durationSeconds))
  }

  return estimates
}
