import * as l from '~/utils/logger'
import type {
  EffectiveSttProviderConcurrency,
  RuntimeOptions,
  SttTarget
} from '~/types'
import { getSttEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { buildSpeakerCountHintWarning } from '../step-2-shared/inactive-flag-warnings'
import { buildSttProviderSlotSummaries, describeSttBatchProviderSlotLimits } from './batch'
import { getSttEngineCapabilities } from './orchestrator'
import { formatSttTargetLabel } from './stt-targets'
import {
  logSttProviderConcurrency
} from './stt-logging'

const emittedInfoMessages = new Set<string>()
const emittedWarnMessages = new Set<string>()

const emitInfoOnce = (key: string, emit: () => void): void => {
  if (emittedInfoMessages.has(key)) {
    return
  }

  emittedInfoMessages.add(key)
  emit()
}

const logWarnOnce = (message: string): void => {
  if (emittedWarnMessages.has(message)) {
    return
  }

  emittedWarnMessages.add(message)
  l.warn(message)
}

export const resolveEffectiveSttProviderConcurrency = (
  options: Pick<RuntimeOptions, 'batchConcurrency' | 'sttProviderConcurrency'>,
  targets: Pick<SttTarget, 'local'>[]
): EffectiveSttProviderConcurrency => {
  const requested = Math.max(1, options.sttProviderConcurrency)
  const hostedProviderCount = targets.filter((target) => !target.local).length

  return {
    requested,
    effective: requested,
    hostedProviderCount
  }
}

export const logSpeakerCountHintSummary = (
  targets: SttTarget[],
  requestedSpeakerCount: number | undefined
): void => {
  const warning = buildSpeakerCountHintWarning(
    targets,
    requestedSpeakerCount,
    (target) => getSttEngineCapabilities(target.service).supportsSpeakerCountHint,
    formatSttTargetLabel
  )
  if (warning) {
    logWarnOnce(warning)
  }
}

export const logEffectiveProviderConcurrency = (
  resolution: EffectiveSttProviderConcurrency,
  batchConcurrency: number,
  coordinatedAcrossBatch: boolean,
  targets: SttTarget[]
): void => {
  if (resolution.hostedProviderCount <= 1) {
    return
  }

  const providerSlots = describeSttBatchProviderSlotLimits(targets, batchConcurrency)
  const providerSlotDetails = buildSttProviderSlotSummaries(targets, batchConcurrency)
  const dedupeKey = [
    coordinatedAcrossBatch ? 'batch_scheduler' : 'cloud_provider_concurrency',
    resolution.requested,
    resolution.effective,
    batchConcurrency,
    resolution.hostedProviderCount,
    providerSlots
  ].join(':')

  emitInfoOnce(dedupeKey, () => {
    logSttProviderConcurrency(
      l,
      resolution,
      batchConcurrency,
      coordinatedAcrossBatch,
      providerSlots,
      providerSlotDetails
    )
  })
}

export const prioritizeCloudSttTargetIndices = (targets: SttTarget[]): number[] =>
  targets
    .map((target, index) => ({ target, index }))
    .filter((entry) => !entry.target.local)
    .sort((left, right) => {
      const leftAssemblyPriority = left.target.service === 'assemblyai' ? 1 : 0
      const rightAssemblyPriority = right.target.service === 'assemblyai' ? 1 : 0
      if (leftAssemblyPriority !== rightAssemblyPriority) {
        return rightAssemblyPriority - leftAssemblyPriority
      }

      const leftEstimate = getSttEstimation(left.target.service, left.target.model).msPerSecond
      const rightEstimate = getSttEstimation(right.target.service, right.target.model).msPerSecond
      if (leftEstimate !== rightEstimate) {
        return rightEstimate - leftEstimate
      }

      return left.index - right.index
    })
    .map((entry) => entry.index)

export const runTargetPool = async (
  indices: number[],
  concurrency: number,
  worker: (index: number) => Promise<void>
): Promise<void> => {
  const normalizedConcurrency = Math.max(1, concurrency)
  let next = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const current = next
      next += 1
      if (current >= indices.length) {
        return
      }
      await worker(indices[current] as number)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(normalizedConcurrency, indices.length) }, async () => {
      await runWorker()
    })
  )
}
