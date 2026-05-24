import type {
  AsyncSttPollLoopOptions,
  Step2Metadata,
  Step2RuntimeMetadata
} from '~/types'
import { readProviderResultEntry } from '../../manifest-utils'
import { readSttProviderCheckpoint, writeSttProviderCheckpoint } from './manifest'

const DEFAULT_POLL_DEADLINE_MS = 10 * 60 * 1000
const MAX_POLL_DEADLINE_MS = 30 * 60 * 1000
const POLL_DEADLINE_AUDIO_MULTIPLIER_MS = 250
export const ASYNC_STT_RESUME_PROBE_DELAYS_MS = [0, 30_000, 60_000, 120_000, 240_000] as const

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

export const writeAsyncSttProgressMetadata = async (
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

export const resolveAsyncSttPollDeadlineMs = (
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
