import { createHumanTable, createSingleRowTable } from '~/utils/logger/human-table'
import type { HumanLogTable, LogLevel, TableLogger } from '~/types'
import type {
  EffectiveSttProviderConcurrency,
  ProviderFailure,
  SttCompletionStatus,
  SttProviderState
} from '~/types'
import { formatSttTargetLabel } from './stt-targets'
import type {
  SttAcquireSummary,
  SttAsyncJobLifecycle,
  SttCacheEvent,
  SttProviderConcurrencySummary,
  SttProviderSlotSummary,
  SttRunStatusSummary,
  SttSegmentLifecycle
} from '~/types'

export const buildSttCacheRows = (
  event: SttCacheEvent
): Array<{ artifact: string, status: string, key: string, detail: string }> => [{
  artifact: event.artifact,
  status: event.status,
  key: event.key,
  detail: event.detail ?? ''
}]

export const buildSttCacheTable = (
  event: SttCacheEvent
): HumanLogTable =>
  createHumanTable(buildSttCacheRows(event), ['artifact', 'status', 'key', 'detail'])

export const logSttCacheEvent = (
  logger: TableLogger,
  event: SttCacheEvent,
  level: LogLevel = 'info'
): void => {
  logger.write(level, 'STT Cache', {
    category: 'artifact',
    humanTable: buildSttCacheTable(event),
    metadata: event
  })
}

export const buildSttAcquireRows = (
  summary: SttAcquireSummary
): Array<{ item: string, sourceMedia: string, elapsedMs: number }> => [{
  item: summary.item,
  sourceMedia: summary.sourceMedia,
  elapsedMs: summary.elapsedMs
}]

export const buildSttAcquireTable = (
  summary: SttAcquireSummary
): HumanLogTable =>
  createHumanTable(buildSttAcquireRows(summary), ['item', 'sourceMedia', 'elapsedMs'])

export const logSttAcquireSummary = (
  logger: TableLogger,
  summary: SttAcquireSummary
): void => {
  logger.write('info', 'STT Acquire', {
    category: 'artifact',
    humanTable: buildSttAcquireTable(summary),
    metadata: summary
  })
}

export const buildSttAsyncJobRows = (
  lifecycle: SttAsyncJobLifecycle
): Array<{ provider: string, action: string, remoteId: string, state: string }> => [{
  provider: lifecycle.provider,
  action: lifecycle.action,
  remoteId: lifecycle.remoteId,
  state: lifecycle.state
}]

export const buildSttAsyncJobTable = (
  lifecycle: SttAsyncJobLifecycle
): HumanLogTable =>
  createHumanTable(buildSttAsyncJobRows(lifecycle), ['provider', 'action', 'remoteId', 'state'])

export const logSttAsyncJobLifecycle = (
  logger: TableLogger,
  lifecycle: SttAsyncJobLifecycle
): void => {
  logger.write('info', 'Async STT Job', {
    category: 'pipeline',
    humanTable: buildSttAsyncJobTable(lifecycle),
    metadata: lifecycle
  })
}

export const buildSttSegmentLifecycleRows = (
  lifecycle: SttSegmentLifecycle
): Array<{
  provider: string
  action: string
  segment: string
  model: string
  processingTimeMs: number | ''
  detail: string
}> => [{
  provider: lifecycle.provider,
  action: lifecycle.action,
  segment: lifecycle.segmentNumber !== undefined && lifecycle.totalSegments !== undefined
    ? `${lifecycle.segmentNumber}/${lifecycle.totalSegments}`
    : '',
  model: lifecycle.model ?? '',
  processingTimeMs: lifecycle.processingTimeMs ?? '',
  detail: lifecycle.detail ?? ''
}]

export const buildSttSegmentLifecycleTable = (
  lifecycle: SttSegmentLifecycle
): HumanLogTable =>
  createHumanTable(
    buildSttSegmentLifecycleRows(lifecycle),
    ['provider', 'action', 'segment', 'model', 'processingTimeMs', 'detail']
  )

export const logSttSegmentLifecycle = (
  logger: TableLogger,
  lifecycle: SttSegmentLifecycle,
  level: LogLevel = lifecycle.action === 'completed' ? 'success' : 'info'
): void => {
  logger.write(level, 'STT Segment', {
    category: 'pipeline',
    humanTable: buildSttSegmentLifecycleTable(lifecycle),
    metadata: lifecycle
  })
}

export const buildSttRunStatusRows = (
  summary: SttRunStatusSummary
): Array<{
  completionStatus: SttCompletionStatus
  requested: number
  succeeded: number
  failed: number
  missing: number
  skipped: number
}> => [{
  completionStatus: summary.completionStatus,
  requested: summary.requested,
  succeeded: summary.succeeded,
  failed: summary.failed,
  missing: summary.missing,
  skipped: summary.skipped
}]

export const buildSttRunStatusTable = (
  summary: SttRunStatusSummary
): HumanLogTable =>
  createHumanTable(
    buildSttRunStatusRows(summary),
    ['completionStatus', 'requested', 'succeeded', 'failed', 'missing', 'skipped']
  )

export const logSttRunStatus = (
  logger: TableLogger,
  summary: SttRunStatusSummary,
  level: LogLevel = 'warn'
): void => {
  logger.write(level, 'Run Status', {
    category: 'pipeline',
    humanTable: buildSttRunStatusTable(summary),
    metadata: summary
  })
}

export const buildSttProviderConcurrencyTable = (
  summary: SttProviderConcurrencySummary
): HumanLogTable =>
  createSingleRowTable({
    mode: summary.mode,
    requested: summary.requested,
    effective: summary.effective,
    batch: summary.batchConcurrency,
    providers: summary.hostedProviders
  }, [
    'mode',
    'requested',
    'effective',
    'batch',
    'providers'
  ])

export const buildSttProviderSlotsTable = (
  providerSlots: readonly SttProviderSlotSummary[]
): HumanLogTable =>
  createHumanTable(
    providerSlots.map((slot) => ({
      provider: slot.provider,
      kind: slot.kind,
      launch: slot.launchSlots,
      poll: slot.pollSlots ?? ''
    })),
    ['provider', 'kind', 'launch', 'poll']
  )

export const logSttProviderConcurrency = (
  logger: TableLogger,
  resolution: EffectiveSttProviderConcurrency,
  batchConcurrency: number,
  coordinatedAcrossBatch: boolean,
  providerSlots: string,
  providerSlotDetails: readonly SttProviderSlotSummary[]
): void => {
  const summary: SttProviderConcurrencySummary = {
    mode: coordinatedAcrossBatch ? 'batch_scheduler' : 'cloud_provider_concurrency',
    requested: resolution.requested,
    effective: resolution.effective,
    batchConcurrency,
    hostedProviders: resolution.hostedProviderCount,
    providerSlots
  }

  const metadata = {
    ...summary,
    providerSlotDetails
  }

  const message = coordinatedAcrossBatch ? 'STT Batch Scheduler' : 'STT Provider Concurrency'

  logger.write('info', message, {
    category: 'pipeline',
    humanTable: buildSttProviderConcurrencyTable(summary),
    metadata
  })

  logger.write('info', 'STT Provider Slots', {
    category: 'pipeline',
    humanTable: buildSttProviderSlotsTable(providerSlotDetails),
    metadata: {
      providerSlots,
      providerSlotDetails
    }
  })
}

export const buildSttProviderFailureTable = (
  failures: readonly ProviderFailure[]
): HumanLogTable =>
  createHumanTable(
    failures.map((failure) => ({
      provider: formatSttTargetLabel(failure),
      stage: failure.stage ?? '',
      status: failure.status ?? '',
      retryable: failure.retryable,
      detail: failure.message
    })),
    ['provider', 'stage', 'status', 'retryable', 'detail']
  )

export const logSttProviderFailures = (
  logger: TableLogger,
  failures: readonly ProviderFailure[],
  level: LogLevel = 'warn'
): void => {
  if (failures.length === 0) {
    return
  }

  logger.write(level, 'Provider Failures', {
    category: 'pipeline',
    humanTable: buildSttProviderFailureTable(failures),
    metadata: {
      failures: failures.map((failure) => ({
        provider: formatSttTargetLabel(failure),
        stage: failure.stage,
        status: failure.status,
        retryable: failure.retryable,
        detail: failure.message
      }))
    }
  })
}

export const buildSttProviderSkipTable = (
  skippedProviders: ReadonlyArray<Pick<SttProviderState, 'service' | 'model' | 'lastError'>>
): HumanLogTable =>
  createHumanTable(
    skippedProviders.map((state) => ({
      provider: formatSttTargetLabel(state),
      stage: state.lastError?.stage ?? '',
      status: state.lastError?.status ?? '',
      retryable: state.lastError?.retryable ?? false,
      detail: state.lastError?.message ?? 'skipped'
    })),
    ['provider', 'stage', 'status', 'retryable', 'detail']
  )

export const logSttProviderSkips = (
  logger: TableLogger,
  skippedProviders: ReadonlyArray<Pick<SttProviderState, 'service' | 'model' | 'lastError'>>,
  level: LogLevel = 'warn'
): void => {
  if (skippedProviders.length === 0) {
    return
  }

  logger.write(level, 'Provider Skips', {
    category: 'pipeline',
    humanTable: buildSttProviderSkipTable(skippedProviders),
    metadata: {
      skipped: skippedProviders.map((state) => ({
        provider: formatSttTargetLabel(state),
        stage: state.lastError?.stage,
        status: state.lastError?.status,
        retryable: state.lastError?.retryable ?? false,
        detail: state.lastError?.message ?? 'skipped'
      }))
    }
  })
}
