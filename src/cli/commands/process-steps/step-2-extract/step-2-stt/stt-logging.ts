import { createHumanTable, createKeyValueTable, createSingleRowTable } from '~/utils/logger/human-table'
import type { HumanLogTable, LogLevel, TableLogger } from '~/types'
import type {
  AudioSegmentDescriptor,
  DiarizationOptions,
  EffectiveSttProviderConcurrency,
  ProviderFailure,
  SplitPolicyTarget,
  SttCompletionStatus,
  SttProviderState,
  SttSplitDecision,
  SttSplitDecisionReason
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

const formatBytes = (bytes: number | undefined): string => {
  if (bytes === undefined) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < (1024 * 1024)) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < (1024 * 1024 * 1024)) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const formatSeconds = (seconds: number | undefined): string => {
  if (seconds === undefined) return ''
  return Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1)}s`
}

const formatMinutes = (minutes: number | undefined): string => {
  if (minutes === undefined) return ''
  const rounded = Number.isInteger(minutes) ? String(minutes) : String(Number(minutes.toFixed(3)))
  return `${rounded}m`
}

type SttSplitRetryReason = Exclude<SttSplitDecisionReason['kind'], 'explicit'>

const describeSplitReason = (reason: SttSplitDecisionReason | { kind: SttSplitRetryReason }): string => {
  if (reason.kind === 'explicit') {
    return 'explicit'
  }

  return reason.kind
}

const getSplitReasonCap = (reason: SttSplitDecisionReason | { kind: SttSplitRetryReason }): string => {
  if (reason.kind === 'attachment_cap' && 'attachmentCapBytes' in reason) {
    return formatBytes(reason.attachmentCapBytes)
  }
  if (reason.kind === 'duration_cap' && 'maxDurationSeconds' in reason) {
    return formatSeconds(reason.maxDurationSeconds)
  }
  if (reason.kind === 'request_budget' && 'requestBudgetSeconds' in reason) {
    return formatSeconds(reason.requestBudgetSeconds)
  }
  return ''
}

const getSplitReasonInputSize = (reason: SttSplitDecisionReason): string =>
  reason.kind === 'attachment_cap' ? formatBytes(reason.audioFileSizeBytes) : ''

const getSplitReasonInputDuration = (reason: SttSplitDecisionReason): string =>
  reason.kind === 'duration_cap' || reason.kind === 'request_budget'
    ? formatSeconds(reason.audioDurationSeconds)
    : ''

export const buildSttDiarizationConfigTable = (
  summary: {
    provider: string
    model?: string | undefined
    enabled?: boolean | undefined
    speakerCount?: number | undefined
    maxSpeakers?: number | undefined
    detail?: string | undefined
  }
): HumanLogTable =>
  createKeyValueTable([
    ['provider', summary.provider],
    ...(summary.model ? [['model', summary.model] as const] : []),
    ...(summary.enabled !== undefined ? [['enabled', summary.enabled] as const] : []),
    ...(summary.speakerCount !== undefined ? [['speakerCount', summary.speakerCount] as const] : []),
    ...(summary.maxSpeakers !== undefined ? [['maxSpeakers', summary.maxSpeakers] as const] : []),
    ...(summary.detail ? [['detail', summary.detail] as const] : [])
  ])

export const logSttDiarizationConfig = (
  logger: TableLogger,
  summary: {
    provider: string
    model?: string | undefined
    enabled?: boolean | undefined
    speakerCount?: number | undefined
    maxSpeakers?: number | undefined
    detail?: string | undefined
  },
  level: LogLevel = 'info'
): void => {
  logger.write(level, 'STT Diarization', {
    category: 'pipeline',
    humanTable: buildSttDiarizationConfigTable(summary),
    metadata: summary
  })
}

export const buildSttPromptDiarizationTable = (
  summary: {
    detectedSpeakers: number
    requestedSpeakerCount?: number | undefined
    sourceProvider?: string | undefined
  }
): HumanLogTable =>
  createKeyValueTable([
    ['detectedSpeakers', summary.detectedSpeakers],
    ...(summary.requestedSpeakerCount !== undefined ? [['requestedSpeakerCount', summary.requestedSpeakerCount] as const] : []),
    ...(summary.sourceProvider ? [['sourceProvider', summary.sourceProvider] as const] : [])
  ])

export const buildSttSplitDecisionTable = (
  target: SplitPolicyTarget,
  decision: Pick<SttSplitDecision, 'reasons' | 'segmentDurationMinutes'>,
  options: {
    trigger?: 'auto' | 'retry' | 'explicit' | undefined
    retryReason?: SttSplitRetryReason | undefined
    audioFileSizeBytes?: number | undefined
    audioDurationSeconds?: number | undefined
  } = {}
): HumanLogTable => {
  const reasons = decision.reasons.length > 0
    ? decision.reasons
    : options.retryReason
      ? [{ kind: options.retryReason }]
      : [{ kind: 'explicit' as const }]

  return createHumanTable(
    reasons.map((reason) => ({
      provider: target.service,
      model: target.model,
      trigger: options.trigger ?? (reason.kind === 'explicit' ? 'explicit' : 'auto'),
      reason: describeSplitReason(reason),
      cap: getSplitReasonCap(reason),
      inputSize: reason.kind === 'attachment_cap'
        ? getSplitReasonInputSize(reason as SttSplitDecisionReason)
        : formatBytes(options.audioFileSizeBytes),
      inputDuration: reason.kind === 'duration_cap' || reason.kind === 'request_budget'
        ? getSplitReasonInputDuration(reason as SttSplitDecisionReason)
        : formatSeconds(options.audioDurationSeconds),
      segmentDuration: formatMinutes(decision.segmentDurationMinutes)
    })),
    ['provider', 'model', 'trigger', 'reason', 'cap', 'inputSize', 'inputDuration', 'segmentDuration']
  )
}

export const logSttSplitDecision = (
  logger: TableLogger,
  target: SplitPolicyTarget,
  decision: Pick<SttSplitDecision, 'reasons' | 'segmentDurationMinutes'>,
  options: {
    trigger?: 'auto' | 'retry' | 'explicit' | undefined
    retryReason?: SttSplitRetryReason | undefined
    audioPath?: string | undefined
    audioFileSizeBytes?: number | undefined
    audioDurationSeconds?: number | undefined
    level?: LogLevel | undefined
  } = {}
): void => {
  logger.write(options.level ?? 'warn', 'STT Split', {
    category: 'pipeline',
    humanTable: buildSttSplitDecisionTable(target, decision, options),
    metadata: {
      target,
      decision,
      trigger: options.trigger,
      retryReason: options.retryReason,
      audioPath: options.audioPath,
      audioFileSizeBytes: options.audioFileSizeBytes,
      audioDurationSeconds: options.audioDurationSeconds
    }
  })
}

export const buildSttSplitSummaryTable = (
  summary: {
    input: string
    segmentDurationMinutes: number
    totalDurationSeconds: number
    totalSegments: number
  }
): HumanLogTable =>
  createKeyValueTable([
    ['input', summary.input],
    ['segmentDuration', formatMinutes(summary.segmentDurationMinutes)],
    ['totalDuration', formatSeconds(summary.totalDurationSeconds)],
    ['totalSegments', summary.totalSegments]
  ])

export const buildSttSplitSegmentsTable = (
  segments: readonly AudioSegmentDescriptor[]
): HumanLogTable =>
  createHumanTable(
    segments.map((segment) => ({
      segment: `${segment.segmentNumber}/${segment.totalSegments}`,
      start: formatSeconds(segment.startSeconds),
      duration: formatSeconds(segment.durationSeconds),
      path: segment.path
    })),
    ['segment', 'start', 'duration', 'path']
  )

export const logSttSplitSummary = (
  logger: TableLogger,
  summary: {
    input: string
    segmentDurationMinutes: number
    totalDurationSeconds: number
    totalSegments: number
  }
): void => {
  logger.write('info', 'STT Split Plan', {
    category: 'pipeline',
    humanTable: buildSttSplitSummaryTable(summary),
    metadata: summary
  })
}

export const logSttSplitSegments = (
  logger: TableLogger,
  segments: readonly AudioSegmentDescriptor[]
): void => {
  logger.write('success', 'STT Split Segments', {
    category: 'artifact',
    humanTable: buildSttSplitSegmentsTable(segments),
    metadata: { segments }
  })
}

export const buildSttTranscriptOutputTable = (
  summary: {
    provider: string
    path: string
    characters: number
    speakers?: number | undefined
  }
): HumanLogTable =>
  createKeyValueTable([
    ['provider', summary.provider],
    ['path', summary.path],
    ['characters', summary.characters],
    ...(summary.speakers !== undefined ? [['speakers', summary.speakers] as const] : [])
  ])

export const logSttTranscriptOutput = (
  logger: TableLogger,
  summary: {
    provider: string
    path: string
    characters: number
    speakers?: number | undefined
  }
): void => {
  logger.write('info', 'Transcript Output', {
    category: 'artifact',
    humanTable: buildSttTranscriptOutputTable(summary),
    metadata: summary
  })
}

export const buildSttCleanupArtifactsTable = (
  rows: ReadonlyArray<{ artifact: string, path: string }>
): HumanLogTable =>
  createHumanTable(rows, ['artifact', 'path'])

export const logSttCleanupArtifacts = (
  logger: TableLogger,
  message: string,
  rows: ReadonlyArray<{ artifact: string, path: string }>,
  level: LogLevel = 'info'
): void => {
  if (rows.length === 0) {
    return
  }

  logger.write(level, message, {
    category: 'artifact',
    humanTable: buildSttCleanupArtifactsTable(rows),
    metadata: { artifacts: rows }
  })
}

export const buildSttCleanupFailureTable = (
  summary: {
    provider: string
    artifact: string
    id: string
    detail: string
  }
): HumanLogTable =>
  createHumanTable([summary], ['provider', 'artifact', 'id', 'detail'])

export const logSttCleanupFailure = (
  logger: TableLogger,
  summary: {
    provider: string
    artifact: string
    id: string
    detail: string
  }
): void => {
  logger.write('warn', 'STT Cleanup', {
    category: 'artifact',
    humanTable: buildSttCleanupFailureTable(summary),
    metadata: summary
  })
}

export const buildSttProviderSpeakerCountHintsTable = (
  rows: ReadonlyArray<{ provider: string, speakerCount: number, support: 'honored' | 'ignored' }>
): HumanLogTable =>
  createHumanTable(rows, ['provider', 'speakerCount', 'support'])

export const logSttProviderSpeakerCountHints = (
  logger: TableLogger,
  rows: ReadonlyArray<{ provider: string, speakerCount: number, support: 'honored' | 'ignored' }>
): void => {
  if (rows.length === 0) {
    return
  }

  logger.write('warn', 'Provider Speaker Count Hints', {
    category: 'pipeline',
    humanTable: buildSttProviderSpeakerCountHintsTable(rows),
    metadata: { rows }
  })
}

export const buildSttRecoveryPassTable = (
  summary: {
    pass: number
    maxPasses: number
    retryableFailures: number
    providers: string
  }
): HumanLogTable =>
  createHumanTable([summary], ['pass', 'maxPasses', 'retryableFailures', 'providers'])

export const logSttRecoveryPass = (
  logger: TableLogger,
  summary: {
    pass: number
    maxPasses: number
    retryableFailures: number
    providers: string
  }
): void => {
  logger.write('warn', 'STT Recovery Pass', {
    category: 'pipeline',
    humanTable: buildSttRecoveryPassTable(summary),
    metadata: summary
  })
}

export const buildSttProviderDiarizationHintTable = (
  provider: string,
  model: string,
  diarizationOptions: DiarizationOptions | undefined
): HumanLogTable =>
  buildSttDiarizationConfigTable({
    provider,
    model,
    enabled: diarizationOptions?.enabled !== false,
    ...(diarizationOptions?.speakerCount !== undefined ? { speakerCount: diarizationOptions.speakerCount } : {})
  })

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
