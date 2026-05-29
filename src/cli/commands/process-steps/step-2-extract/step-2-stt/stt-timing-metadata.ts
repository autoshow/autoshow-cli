import type { Step2TimingMetadata } from '~/types'

const STT_TIMING_KEYS = [
  'queueWaitMs',
  'transcribeMs',
  'uploadMs',
  'createMs',
  'createCount',
  'pollMs',
  'pollSleepMs',
  'pollCount',
  'transcriptMs',
  'remoteProcessingMs',
  'cleanupMs',
  'requestCount',
  'retryCount',
  'rateLimitCount',
  'blockedCount',
  'degradedCount',
  'backfillCount'
] as const satisfies readonly (keyof Step2TimingMetadata)[]

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const mergeStep2TimingMetadata = (
  values: Array<Step2TimingMetadata | undefined>
): Step2TimingMetadata | undefined => {
  const merged: Step2TimingMetadata = {}

  for (const key of STT_TIMING_KEYS) {
    const total = values.reduce((sum, value) => sum + (value?.[key] ?? 0), 0)
    if (total > 0) {
      merged[key] = total
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined
}

export const parseStoredStep2TimingMetadata = (
  value: unknown
): Step2TimingMetadata | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const timings: Step2TimingMetadata = {}
  for (const key of STT_TIMING_KEYS) {
    if (typeof value[key] === 'number' && Number.isFinite(value[key])) {
      timings[key] = value[key]
    }
  }

  return Object.keys(timings).length > 0 ? timings : undefined
}
