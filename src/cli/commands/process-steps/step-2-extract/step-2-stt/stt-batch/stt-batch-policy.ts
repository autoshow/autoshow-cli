import type { HumanLogTableRow } from '~/types'
import type { SttBatchProviderProfile, SttBatchSchedulerSnapshot, SttProviderSlotSummary, SttTarget } from '~/types'
import { formatSttTargetLabel, getSttTargetKey } from '../stt-targets'

const DEFAULT_PROVIDER_SLOT_LIMIT = 2
const DEFAULT_DEEPGRAM_SLOT_LIMIT = 4
const DEFAULT_ELEVENLABS_SLOT_LIMIT = 2
const DEFAULT_ASYNC_CREATE_SLOT_LIMIT = 2
const DEFAULT_MISTRAL_SLOT_LIMIT = 1
const MAX_POLL_SLOT_LIMIT = 8


const isAsyncSttBatchProvider = (
  target: Pick<SttTarget, 'service'>
): boolean =>
  target.service === 'assemblyai'
  || target.service === 'gladia'
  || target.service === 'happyscribe'
  || target.service === 'supadata'
  || target.service === 'soniox'
  || target.service === 'speechmatics'
  || target.service === 'rev'

const getDefaultProviderSlotLimit = (
  target: Pick<SttTarget, 'service' | 'local'>
): number => {
  if (target.local) {
    return 1
  }

  if (target.service === 'deepgram') {
    return DEFAULT_DEEPGRAM_SLOT_LIMIT
  }

  if (target.service === 'elevenlabs') {
    return DEFAULT_ELEVENLABS_SLOT_LIMIT
  }

  if (target.service === 'mistral') {
    return DEFAULT_MISTRAL_SLOT_LIMIT
  }

  if (isAsyncSttBatchProvider(target)) {
    return DEFAULT_ASYNC_CREATE_SLOT_LIMIT
  }

  return DEFAULT_PROVIDER_SLOT_LIMIT
}

const resolveSttBatchProviderSlotLimit = (
  target: Pick<SttTarget, 'service' | 'model' | 'local'>
): number => getDefaultProviderSlotLimit(target)

const resolveSttBatchPollSlotLimit = (
  target: Pick<SttTarget, 'service' | 'local'>,
  batchConcurrency: number
): number => {
  if (target.local || !isAsyncSttBatchProvider(target)) {
    return 0
  }

  return Math.min(MAX_POLL_SLOT_LIMIT, Math.max(1, batchConcurrency))
}

export const getSttBatchProviderProfile = (
  target: Pick<SttTarget, 'service' | 'model' | 'local'>,
  batchConcurrency: number
): SttBatchProviderProfile => ({
  kind: isAsyncSttBatchProvider(target) ? 'async' : 'sync',
  launchSlotLimit: resolveSttBatchProviderSlotLimit(target),
  pollSlotLimit: resolveSttBatchPollSlotLimit(target, batchConcurrency)
})

export const buildSttProviderSlotSummaries = (
  targets: Array<Pick<SttTarget, 'service' | 'model' | 'local'>>,
  batchConcurrency = 1
): SttProviderSlotSummary[] => {
  const seen = new Set<string>()
  return targets
    .filter((target) => !target.local)
    .filter((target) => {
      const key = getSttTargetKey(target)
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .map((target) => {
      const profile = getSttBatchProviderProfile(target, batchConcurrency)
      return {
        service: target.service,
        model: target.model,
        provider: formatSttTargetLabel(target),
        kind: profile.kind,
        launchSlots: profile.launchSlotLimit,
        pollSlots: profile.kind === 'async' ? profile.pollSlotLimit : null
      }
    })
}

export const describeSttBatchProviderSlotLimits = (
  targets: Array<Pick<SttTarget, 'service' | 'model' | 'local'>>,
  batchConcurrency = 1
): string =>
  buildSttProviderSlotSummaries(targets, batchConcurrency)
    .map((slot) => {
      if (slot.kind !== 'async') {
        return `${slot.provider}:launch=${slot.launchSlots}`
      }

      return `${slot.provider}:create=${slot.launchSlots},poll=${slot.pollSlots ?? ''}`
    })
    .join(', ')

export const buildSttBatchSchedulerRows = (
  snapshot: SttBatchSchedulerSnapshot
): HumanLogTableRow[] =>
  snapshot.providers.map((provider) => ({
    provider: formatSttTargetLabel(provider),
    kind: provider.kind,
    launchSlots: provider.launchSlotLimit,
    pollSlots: provider.kind === 'async' ? provider.pollSlotLimit : '',
    launched: provider.launchedCount,
    completed: provider.completedCount,
    queueWaitMs: provider.queueWaitMs,
    polls: provider.kind === 'async' ? provider.pollCount : '',
    blocked: provider.blockedCount,
    degraded: provider.degradedCount,
    backfill: provider.backfillCount,
    warm: provider.warmupComplete
  }))
