import * as l from '~/utils/logger'
import type {
  AsyncSttLifecycleHooks,
  AsyncSttPollLoopOptions,
  RetryClass,
  Step2Metadata,
  Step2RuntimeMetadata,
  TranscriptionResult
} from '~/types'
import { readProviderResultEntry } from '../../manifest-utils'
import { readSttProviderCheckpoint, writeSttProviderCheckpoint } from './manifest'
import { logSttAsyncJobLifecycle } from './stt-logging'
import { buildStep2TimingMetadata } from './stt-timing-metadata'

const DEFAULT_POLL_DEADLINE_MS = 10 * 60 * 1000
const MAX_POLL_DEADLINE_MS = 30 * 60 * 1000
const POLL_DEADLINE_AUDIO_MULTIPLIER_MS = 250
const ASYNC_STT_RESUME_PROBE_DELAYS_MS = [0, 30_000, 60_000, 120_000, 240_000] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseCleanupState = (value: unknown): Step2RuntimeMetadata['cleanup'] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const cleanup: NonNullable<Step2RuntimeMetadata['cleanup']> = {}
  if (typeof value['remoteJobDeleted'] === 'boolean') {
    cleanup.remoteJobDeleted = value['remoteJobDeleted']
  }
  if (typeof value['remoteAssetDeleted'] === 'boolean') {
    cleanup.remoteAssetDeleted = value['remoteAssetDeleted']
  }

  return Object.keys(cleanup).length > 0 ? cleanup : undefined
}

export const parseStep2RuntimeMetadata = (
  value: unknown
): Step2RuntimeMetadata | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  if (
    (value['mode'] !== 'fresh' && value['mode'] !== 'resumed')
    || (value['stage'] !== 'created'
      && value['stage'] !== 'polling'
      && value['stage'] !== 'completed'
      && value['stage'] !== 'cleanup-pending'
      && value['stage'] !== 'cleanup-complete')
    || typeof value['remoteJobId'] !== 'string'
  ) {
    return undefined
  }

  return {
    mode: value['mode'],
    stage: value['stage'],
    remoteJobId: value['remoteJobId'],
    ...(typeof value['remoteAssetId'] === 'string' ? { remoteAssetId: value['remoteAssetId'] } : {}),
    ...(typeof value['remoteAssetUrl'] === 'string' ? { remoteAssetUrl: value['remoteAssetUrl'] } : {}),
    ...(typeof value['createCompletedAt'] === 'string' ? { createCompletedAt: value['createCompletedAt'] } : {}),
    ...(typeof value['lastPollAt'] === 'string' ? { lastPollAt: value['lastPollAt'] } : {}),
    ...(typeof value['completedAt'] === 'string' ? { completedAt: value['completedAt'] } : {}),
    ...(typeof value['cleanupCompletedAt'] === 'string' ? { cleanupCompletedAt: value['cleanupCompletedAt'] } : {}),
    ...(parseCleanupState(value['cleanup']) ? { cleanup: parseCleanupState(value['cleanup']) } : {})
  }
}

export const readPersistedAsyncSttRuntime = async (
  outputDir: string,
  expected: Pick<Step2Metadata, 'transcriptionService' | 'transcriptionModel'>
): Promise<Step2RuntimeMetadata | undefined> => {
  const readCheckpointRuntime = async (): Promise<Step2RuntimeMetadata | undefined> => {
    const checkpointMetadata = await readSttProviderCheckpoint(outputDir)
    if (
      checkpointMetadata
      && checkpointMetadata['transcriptionService'] === expected.transcriptionService
      && checkpointMetadata['transcriptionModel'] === expected.transcriptionModel
    ) {
      return parseStep2RuntimeMetadata(checkpointMetadata['runtime'])
    }

    return undefined
  }

  const providerResult = await readProviderResultEntry(outputDir)
  if (
    providerResult
    && providerResult.metadata['transcriptionService'] === expected.transcriptionService
    && providerResult.metadata['transcriptionModel'] === expected.transcriptionModel
  ) {
    return parseStep2RuntimeMetadata(providerResult.metadata['runtime'])
  }

  return await readCheckpointRuntime()
}

const writeAsyncSttProgressMetadata = async (
  outputDir: string,
  metadata: Step2Metadata
): Promise<void> => {
  await writeSttProviderCheckpoint(
    outputDir,
    metadata.transcriptionService,
    metadata.transcriptionModel,
    metadata as unknown as Record<string, unknown>
  )
}

export const createAsyncSttProgressMetadataPersister = (
  outputDir: string,
  buildProgressMetadata: (runtime: Step2RuntimeMetadata) => Step2Metadata,
  setRuntime: (runtime: Step2RuntimeMetadata) => void
): (runtime: Step2RuntimeMetadata) => Promise<void> =>
  async (runtime) => {
    setRuntime(runtime)
    await writeAsyncSttProgressMetadata(outputDir, buildProgressMetadata(runtime))
  }

export const createAsyncSttJobReadyNotifier = (
  onJobReady: ((runtime: Step2RuntimeMetadata) => Promise<void> | void) | undefined
): (runtime: Step2RuntimeMetadata) => Promise<void> => {
  let notified = false

  return async (runtime) => {
    if (notified) {
      return
    }
    notified = true
    await onJobReady?.(runtime)
  }
}

const resolveAsyncSttPollDeadlineMs = (
  audioDurationSeconds: number | undefined
): number => {
  const durationScaled = typeof audioDurationSeconds === 'number' && Number.isFinite(audioDurationSeconds) && audioDurationSeconds > 0
    ? Math.round(audioDurationSeconds * POLL_DEADLINE_AUDIO_MULTIPLIER_MS)
    : 0

  return Math.min(
    MAX_POLL_DEADLINE_MS,
    Math.max(DEFAULT_POLL_DEADLINE_MS, durationScaled)
  )
}

export const pollAsyncSttJobUntilComplete = async <TStatus>(
  options: AsyncSttPollLoopOptions<TStatus>
): Promise<{ status: TStatus, pollCount: number, pollSleepMs: number }> => {
  const pollOnce = async (): Promise<{ status: TStatus, retryAfterMs: number | null }> => {
    const runPoll = async (): Promise<{ status: TStatus, retryAfterMs: number | null }> =>
      await options.poll()
    const pollResult = options.withPollSlot
      ? await options.withPollSlot(runPoll)
      : await runPoll()
    await options.onProgress?.(pollResult.status)

    const failureReason = options.isFailed(pollResult.status)
    if (failureReason) {
      throw new Error(failureReason)
    }

    return pollResult
  }

  if (options.pollMode === 'resume-probe') {
    let pollCount = 0
    let pollSleepMs = 0

    for (const delayMs of ASYNC_STT_RESUME_PROBE_DELAYS_MS) {
      if (delayMs > 0) {
        const sleepStartedAt = Date.now()
        await Bun.sleep(delayMs)
        pollSleepMs += Date.now() - sleepStartedAt
      }

      const pollResult = await pollOnce()
      pollCount += 1

      if (options.isComplete(pollResult.status)) {
        return {
          status: pollResult.status,
          pollCount,
          pollSleepMs
        }
      }
    }

    const totalWaitMs = ASYNC_STT_RESUME_PROBE_DELAYS_MS.reduce<number>((sum, delayMs) => sum + delayMs, 0)
    if (options.buildResumeProbeError) {
      options.buildResumeProbeError(options.jobId, ASYNC_STT_RESUME_PROBE_DELAYS_MS.length, totalWaitMs)
    }
    options.buildDeadlineError(options.jobId, totalWaitMs)
  }

  const pollDeadlineMs = resolveAsyncSttPollDeadlineMs(options.audioDurationSeconds)
  const deadlineAt = Date.now() + pollDeadlineMs
  let pollDelayMs = options.initialPollIntervalMs
  let pollCount = 0
  let pollSleepMs = 0

  while (true) {
    const remainingBeforeSleep = deadlineAt - Date.now()
    if (remainingBeforeSleep <= 0) {
      options.buildDeadlineError(options.jobId, pollDeadlineMs)
    }

    const sleepStartedAt = Date.now()
    await Bun.sleep(Math.min(pollDelayMs, remainingBeforeSleep))
    pollSleepMs += Date.now() - sleepStartedAt

    const pollResult = await pollOnce()
    pollCount += 1

    if (options.isComplete(pollResult.status)) {
      return {
        status: pollResult.status,
        pollCount,
        pollSleepMs
      }
    }

    pollDelayMs = pollResult.retryAfterMs !== null
      ? Math.min(options.maxPollIntervalMs, Math.max(options.initialPollIntervalMs, pollResult.retryAfterMs))
      : Math.min(options.maxPollIntervalMs, pollDelayMs * 2)
  }
}

export type AsyncSttLifecycleMetrics = {
  createMs: number
  pollMs: number
  pollSleepMs: number
  transcriptMs: number
  createCount: number
  pollCount: number
  requestCount: number
  retryCount: number
  rateLimitCount: number
  backfillCount: number
}

type AsyncSttCreateJobResult<TStatus> = {
  jobId: string
  status?: TStatus | undefined
}

type AsyncSttLifecycleResultBuilderParams<TTranscript> = {
  transcript: TTranscript
  runtime: Step2RuntimeMetadata
  processingTime: number
  timings?: Step2Metadata['timings'] | undefined
}

type AsyncSttLifecycleOptions<TStatus, TTranscript> = {
  outputDir: string
  providerService: Step2Metadata['transcriptionService']
  providerLogLabel: string
  providerDisplayName: string
  modelName: string
  startTime: number
  runMode?: 'initial' | 'backfill' | undefined
  lifecycle?: AsyncSttLifecycleHooks | undefined
  audioDurationSeconds?: number | undefined
  initialPollIntervalMs: number
  maxPollIntervalMs: number
  createJob: (metrics: AsyncSttLifecycleMetrics) => Promise<AsyncSttCreateJobResult<TStatus>>
  pollJob: (jobId: string, metrics: AsyncSttLifecycleMetrics) => Promise<{ status: TStatus, retryAfterMs: number | null }>
  getTranscript: (jobId: string, metrics: AsyncSttLifecycleMetrics) => Promise<TTranscript>
  isComplete: (status: TStatus) => boolean
  isFailed: (status: TStatus) => string | undefined
  buildDeadlineError: (jobId: string, pollDeadlineMs: number) => never
  buildResumeProbeError: (jobId: string, probeCount: number, totalWaitMs: number) => never
  deleteJob: (jobId: string) => Promise<boolean>
  shouldDeleteRemoteJob: (context: {
    metadata: Step2Metadata | undefined
    lastKnownStatus: TStatus | undefined
  }) => boolean
  buildResult: (
    params: AsyncSttLifecycleResultBuilderParams<TTranscript>
  ) => Promise<{ result: TranscriptionResult, metadata: Step2Metadata }>
}

const createAsyncSttLifecycleMetrics = (
  runMode: 'initial' | 'backfill' | undefined
): AsyncSttLifecycleMetrics => ({
  createMs: 0,
  pollMs: 0,
  pollSleepMs: 0,
  transcriptMs: 0,
  createCount: 0,
  pollCount: 0,
  requestCount: 0,
  retryCount: 0,
  rateLimitCount: 0,
  backfillCount: runMode === 'backfill' ? 1 : 0
})

export const getAsyncSttErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

export const attachAsyncSttErrorContext = <TError extends Error & { stage?: string, retryClass?: RetryClass }>(
  error: unknown,
  stage: 'create' | 'poll' | 'transcript',
  retryClass: RetryClass
): never => {
  if (error instanceof Error && error.cause instanceof Error) {
    ;(error.cause as unknown as TError).stage = stage
    ;(error.cause as unknown as TError).retryClass = retryClass
    throw error.cause
  }

  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as unknown as TError).stage = stage
  ;(source as unknown as TError).retryClass = retryClass
  throw source
}

export const attachAsyncSttValidationContext = <TError extends Error & { stage?: string, retryClass?: RetryClass, rawResponse?: unknown }>(
  error: unknown,
  stage: 'create' | 'poll' | 'transcript',
  retryClass: RetryClass,
  rawResponse: unknown
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as unknown as TError).stage = stage
  ;(source as unknown as TError).retryClass = retryClass
  ;(source as unknown as TError).rawResponse = rawResponse
  throw source
}

export const runAsyncSttJobLifecycle = async <TStatus, TTranscript>(
  options: AsyncSttLifecycleOptions<TStatus, TTranscript>
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const metrics = createAsyncSttLifecycleMetrics(options.runMode)
  let runtime = await readPersistedAsyncSttRuntime(options.outputDir, {
    transcriptionService: options.providerService,
    transcriptionModel: options.modelName
  })
  let jobId = runtime?.remoteJobId
  let lastKnownJobStatus: TStatus | undefined
  let resumedExistingJob = false
  let metadata: Step2Metadata | undefined

  const buildTimingMetadata = (remoteProcessingMs = 0): Step2Metadata['timings'] =>
    buildStep2TimingMetadata({
      createMs: metrics.createMs,
      createCount: metrics.createCount,
      pollMs: metrics.pollMs,
      pollSleepMs: metrics.pollSleepMs,
      pollCount: metrics.pollCount,
      transcriptMs: metrics.transcriptMs,
      remoteProcessingMs,
      requestCount: metrics.requestCount,
      retryCount: metrics.retryCount,
      rateLimitCount: metrics.rateLimitCount,
      backfillCount: metrics.backfillCount
    })

  const buildProgressMetadata = (nextRuntime: Step2RuntimeMetadata): Step2Metadata => ({
    transcriptionService: options.providerService,
    transcriptionModel: options.modelName,
    processingTime: Date.now() - options.startTime,
    tokenCount: 0,
    timings: buildTimingMetadata() ?? {},
    runtime: nextRuntime
  })

  const persistProgressMetadata = createAsyncSttProgressMetadataPersister(
    options.outputDir,
    buildProgressMetadata,
    (nextRuntime) => { runtime = nextRuntime }
  )
  const notifyJobReady = createAsyncSttJobReadyNotifier(options.lifecycle?.onJobReady)

  try {
    if (runtime && (runtime.stage === 'created' || runtime.stage === 'polling')) {
      resumedExistingJob = true
      runtime = {
        ...runtime,
        mode: 'resumed',
        stage: 'polling'
      }
      jobId = runtime.remoteJobId
      await persistProgressMetadata(runtime)
      await notifyJobReady(runtime)
    } else {
      const createStartedAt = Date.now()
      const createResponse = await options.createJob(metrics)
      metrics.createMs += Date.now() - createStartedAt
      metrics.createCount += 1

      jobId = createResponse.jobId
      lastKnownJobStatus = createResponse.status
      const createdRuntime: Step2RuntimeMetadata = {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: jobId,
        createCompletedAt: new Date().toISOString()
      }
      await persistProgressMetadata(createdRuntime)
      await notifyJobReady(createdRuntime)
    }

    if (!jobId) {
      throw new Error(`${options.providerDisplayName} job creation did not produce a job id`)
    }

    const activeJobId = jobId
    logSttAsyncJobLifecycle(l, {
      provider: `${options.providerLogLabel}/${options.modelName}`,
      action: resumedExistingJob ? 'resumed' : 'created',
      remoteId: activeJobId,
      state: 'polling'
    })

    const pollResult = await pollAsyncSttJobUntilComplete({
      jobId: activeJobId,
      initialPollIntervalMs: options.initialPollIntervalMs,
      maxPollIntervalMs: options.maxPollIntervalMs,
      audioDurationSeconds: options.audioDurationSeconds,
      pollMode: resumedExistingJob ? 'resume-probe' : 'fresh',
      buildDeadlineError: options.buildDeadlineError,
      buildResumeProbeError: options.buildResumeProbeError,
      poll: async () => {
        const pollStartedAt = Date.now()
        const result = await options.pollJob(activeJobId, metrics)
        metrics.pollMs += Date.now() - pollStartedAt
        return result
      },
      isComplete: options.isComplete,
      isFailed: options.isFailed,
      onProgress: async (status) => {
        lastKnownJobStatus = status
        await persistProgressMetadata({
          ...(runtime ?? {
            mode: 'fresh',
            stage: 'polling',
            remoteJobId: activeJobId
          }),
          mode: runtime?.mode ?? 'fresh',
          stage: 'polling',
          remoteJobId: activeJobId,
          ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
          lastPollAt: new Date().toISOString()
        })
      },
      withPollSlot: options.lifecycle?.withPollSlot
    })

    metrics.pollSleepMs += pollResult.pollSleepMs
    metrics.pollCount += pollResult.pollCount

    const completedRuntime: Step2RuntimeMetadata = {
      ...(runtime ?? {
        mode: 'fresh',
        stage: 'completed',
        remoteJobId: activeJobId
      }),
      mode: runtime?.mode ?? 'fresh',
      stage: 'completed',
      remoteJobId: activeJobId,
      ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
      ...(runtime?.lastPollAt ? { lastPollAt: runtime.lastPollAt } : {}),
      completedAt: new Date().toISOString()
    }

    const transcriptStartedAt = Date.now()
    const transcript = await options.getTranscript(activeJobId, metrics)
    metrics.transcriptMs += Date.now() - transcriptStartedAt

    const processingTime = Date.now() - options.startTime
    const remoteProcessingMs = Math.max(0, processingTime - metrics.createMs - metrics.pollMs - metrics.transcriptMs)
    const timings = buildTimingMetadata(remoteProcessingMs)
    const built = await options.buildResult({
      transcript,
      runtime: completedRuntime,
      processingTime,
      timings
    })
    metadata = built.metadata
    return built
  } finally {
    const cleanupStartedAt = Date.now()
    const shouldDeleteRemoteJob = jobId !== undefined && options.shouldDeleteRemoteJob({
      metadata,
      lastKnownStatus: lastKnownJobStatus
    })
    const remoteJobDeleted = shouldDeleteRemoteJob && jobId ? await options.deleteJob(jobId) : false
    const cleanupMs = Date.now() - cleanupStartedAt

    if (metadata) {
      const processingTime = metadata.processingTime
      metadata.timings = {
        ...(metadata.timings ?? {}),
        ...(cleanupMs > 0 ? { cleanupMs } : {}),
        remoteProcessingMs: Math.max(0, processingTime
          - ((metadata.timings?.createMs ?? 0)
          + (metadata.timings?.pollMs ?? 0)
          + (metadata.timings?.transcriptMs ?? 0)
          + cleanupMs))
      }
      metadata.runtime = {
        ...(metadata.runtime ?? {
          mode: runtime?.mode ?? 'fresh',
          stage: 'cleanup-complete',
          remoteJobId: jobId ?? ''
        }),
        mode: metadata.runtime?.mode ?? runtime?.mode ?? 'fresh',
        stage: 'cleanup-complete',
        remoteJobId: metadata.runtime?.remoteJobId ?? jobId ?? '',
        ...(metadata.runtime?.createCompletedAt ? { createCompletedAt: metadata.runtime.createCompletedAt } : {}),
        ...(metadata.runtime?.lastPollAt ? { lastPollAt: metadata.runtime.lastPollAt } : {}),
        ...(metadata.runtime?.completedAt ? { completedAt: metadata.runtime.completedAt } : {}),
        cleanupCompletedAt: new Date().toISOString(),
        cleanup: {
          ...(metadata.runtime?.cleanup ?? {}),
          ...(jobId ? { remoteJobDeleted } : {})
        }
      }
    } else if (runtime && jobId) {
      const cleanupRuntime: Step2RuntimeMetadata = {
        ...runtime,
        stage: shouldDeleteRemoteJob ? 'cleanup-complete' : runtime.stage,
        remoteJobId: jobId,
        ...(shouldDeleteRemoteJob ? { cleanupCompletedAt: new Date().toISOString() } : {}),
        cleanup: {
          ...(runtime.cleanup ?? {}),
          ...(shouldDeleteRemoteJob ? { remoteJobDeleted } : {})
        }
      }
      await persistProgressMetadata(cleanupRuntime)
    }
  }
}
