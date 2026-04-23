import type { HumanLogTableRow } from '~/utils/logger/types'
import type { SttBatchProviderProfile, SttBatchSchedulerSnapshot, SttTarget } from '~/types'
import { formatSttTargetLabel, getSttTargetKey } from '../stt-targets'

const DEFAULT_PROVIDER_SLOT_LIMIT = 2
const DEFAULT_DEEPGRAM_SLOT_LIMIT = 4
const DEFAULT_ELEVENLABS_SLOT_LIMIT = 2
const DEFAULT_ASYNC_CREATE_SLOT_LIMIT = 2
const DEFAULT_MISTRAL_SLOT_LIMIT = 1
const MAX_PROVIDER_SLOT_LIMIT = 8
const MAX_POLL_SLOT_LIMIT = 8

const normalizeEnvSegment = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()

const parsePositiveIntegerEnv = (key: string): number | undefined => {
  const raw = process.env[key]?.trim()
  if (!raw) {
    return undefined
  }

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined
  }

  return Math.min(MAX_PROVIDER_SLOT_LIMIT, parsed)
}

export const isAsyncSttBatchProvider = (
  target: Pick<SttTarget, 'service'>
): boolean =>
  target.service === 'aws'
  || target.service === 'assemblyai'
  || target.service === 'gladia'
  || target.service === 'deapi'
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

export const resolveSttBatchProviderSlotLimit = (
  target: Pick<SttTarget, 'service' | 'model' | 'local'>
): number => {
  if (target.local) {
    return 1
  }

  if (target.service === 'mistral') {
    return DEFAULT_MISTRAL_SLOT_LIMIT
  }

  const serviceKey = normalizeEnvSegment(target.service)
  const modelKey = normalizeEnvSegment(target.model)
  const modelScoped = parsePositiveIntegerEnv(`AUTOSHOW_STT_PROVIDER_SLOT_LIMIT_${serviceKey}_${modelKey}`)
  if (modelScoped !== undefined) {
    return modelScoped
  }

  const serviceScoped = parsePositiveIntegerEnv(`AUTOSHOW_STT_PROVIDER_SLOT_LIMIT_${serviceKey}`)
  if (serviceScoped !== undefined) {
    return serviceScoped
  }

  const globalScoped = parsePositiveIntegerEnv('AUTOSHOW_STT_PROVIDER_SLOT_LIMIT')
  if (globalScoped !== undefined) {
    return globalScoped
  }

  return getDefaultProviderSlotLimit(target)
}

export const resolveSttBatchPollSlotLimit = (
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

export const describeSttBatchProviderSlotLimits = (
  targets: Array<Pick<SttTarget, 'service' | 'model' | 'local'>>,
  batchConcurrency = 1
): string => {
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
      if (profile.kind !== 'async') {
        return `${formatSttTargetLabel(target)}:launch=${profile.launchSlotLimit}`
      }

      return `${formatSttTargetLabel(target)}:create=${profile.launchSlotLimit},poll=${profile.pollSlotLimit}`
    })
    .join(', ')
}

export const formatSttBatchSchedulerSummary = (
  snapshot: SttBatchSchedulerSnapshot
): string | undefined => {
  if (snapshot.providers.length === 0) {
    return undefined
  }

  return snapshot.providers
    .map((provider) => {
      const parts = [
        `${formatSttTargetLabel(provider)}`,
        provider.kind === 'async'
          ? `create=${provider.launchSlotLimit},poll=${provider.pollSlotLimit}`
          : `launch=${provider.launchSlotLimit}`,
        `launched=${provider.launchedCount}`,
        `completed=${provider.completedCount}`,
        `queueWait=${provider.queueWaitMs}ms`,
        provider.kind === 'async' ? `polls=${provider.pollCount}` : undefined,
        provider.blockedCount > 0 ? `blocked=${provider.blockedCount}` : undefined,
        provider.degradedCount > 0 ? `degraded=${provider.degradedCount}` : undefined,
        provider.backfillCount > 0 ? `backfill=${provider.backfillCount}` : undefined,
        provider.warmupComplete ? 'warm=true' : 'warm=false'
      ].filter((entry): entry is string => typeof entry === 'string')

      return parts.join(' ')
    })
    .join(' | ')
}

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
