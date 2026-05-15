import type {
  AsyncSttLifecycleHooks,
  DiarizationOptions,
  Step2Metadata,
  Step2RuntimeMetadata,
  TranscriptionResult
} from '~/types'
import * as l from '~/utils/logger'
import {
  logSttAsyncJobLifecycle,
  logSttSegmentLifecycle
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import {
  pollAsyncSttJobUntilComplete,
  readPersistedAsyncSttRuntime,
  writeAsyncSttProgressMetadata
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { readEnv } from '~/utils/validate/env-utils'
import {
  createTranscription,
  deleteFile,
  deleteTranscription,
  getTranscriptionTranscript,
  pollTranscription,
  uploadAudio
} from './soniox-api'
import {
  buildSonioxPollingDeadlineError,
  buildSonioxResumeProbeError
} from './soniox-utils'
import { normalizeSonioxTranscript } from './parse-soniox-transcript'

const INITIAL_POLL_INTERVAL_MS = 1000
const MAX_POLL_INTERVAL_MS = 10000

export const runSonioxStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    diarizationOptions?: DiarizationOptions | undefined
    audioDurationSeconds?: number | undefined
    runMode?: 'initial' | 'backfill' | undefined
    lifecycle?: AsyncSttLifecycleHooks | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const apiKey = readEnv('SONIOX_API_KEY')
  if (!apiKey) {
    throw new Error('SONIOX_API_KEY environment variable is required for Soniox transcription')
  }

  const {
    model: modelName,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    diarizationOptions,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options
  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'soniox', action: 'started', segmentNumber, totalSegments, model: modelName })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const baseURL = readEnv('SONIOX_BASE_URL') ?? 'https://api.soniox.com'
  let uploadMs = 0
  let createMs = 0
  let pollMs = 0
  let pollSleepMs = 0
  let createCount = 0
  let pollCount = 0
  let transcriptMs = 0
  let requestCount = 0
  let retryCount = 0
  let rateLimitCount = 0
  let metadata: Step2Metadata | undefined
  const backfillCount = runMode === 'backfill' ? 1 : 0
  const requestMetrics = {
    onRequest: () => {
      requestCount += 1
    },
    onRetry: (status: number | undefined) => {
      retryCount += 1
      if (status === 429) {
        rateLimitCount += 1
      }
    }
  }

  let runtime = await readPersistedAsyncSttRuntime(outputDir, {
    transcriptionService: 'soniox',
    transcriptionModel: modelName
  })
  let fileId = runtime?.remoteAssetId
  let transcriptionId = runtime?.remoteJobId
  let resumedExistingTranscription = false
  let jobReadyNotified = false

  const buildProgressMetadata = (nextRuntime: Step2RuntimeMetadata): Step2Metadata => ({
    transcriptionService: 'soniox',
    transcriptionModel: modelName,
    processingTime: Date.now() - startTime,
    tokenCount: 0,
    timings: {
      ...(uploadMs > 0 ? { uploadMs } : {}),
      ...(createMs > 0 ? { createMs } : {}),
      ...(createCount > 0 ? { createCount } : {}),
      ...(pollMs > 0 ? { pollMs } : {}),
      ...(pollSleepMs > 0 ? { pollSleepMs } : {}),
      ...(pollCount > 0 ? { pollCount } : {}),
      ...(transcriptMs > 0 ? { transcriptMs } : {}),
      ...(requestCount > 0 ? { requestCount } : {}),
      ...(retryCount > 0 ? { retryCount } : {}),
      ...(rateLimitCount > 0 ? { rateLimitCount } : {}),
      ...(backfillCount > 0 ? { backfillCount } : {})
    },
    runtime: nextRuntime
  })

  const persistProgressMetadata = async (nextRuntime: Step2RuntimeMetadata): Promise<void> => {
    runtime = nextRuntime
    await writeAsyncSttProgressMetadata(outputDir, buildProgressMetadata(nextRuntime))
  }

  const notifyJobReady = async (nextRuntime: Step2RuntimeMetadata): Promise<void> => {
    if (jobReadyNotified) {
      return
    }
    jobReadyNotified = true
    await lifecycle?.onJobReady?.(nextRuntime)
  }

  try {
    if (runtime && (runtime.stage === 'created' || runtime.stage === 'polling')) {
      resumedExistingTranscription = true
      runtime = {
        ...runtime,
        mode: 'resumed',
        stage: 'polling'
      }
      transcriptionId = runtime.remoteJobId
      fileId = runtime.remoteAssetId
      await persistProgressMetadata(runtime)
      await notifyJobReady(runtime)
    } else {
      const uploadStartedAt = Date.now()
      fileId = await uploadAudio(baseURL, apiKey, audioPath, requestMetrics)
      uploadMs += Date.now() - uploadStartedAt
      const createStartedAt = Date.now()
      transcriptionId = await createTranscription(baseURL, apiKey, modelName, fileId, diarizationOptions, requestMetrics)
      createMs += Date.now() - createStartedAt
      createCount += 1

      const createdRuntime: Step2RuntimeMetadata = {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: transcriptionId,
        remoteAssetId: fileId,
        createCompletedAt: new Date().toISOString()
      }
      await persistProgressMetadata(createdRuntime)
      await notifyJobReady(createdRuntime)
    }

    if (!transcriptionId) {
      throw new Error('Soniox transcription creation did not produce a transcription id')
    }
    const activeTranscriptionId = transcriptionId
    logSttAsyncJobLifecycle(l, {
      provider: `soniox/${modelName}`,
      action: resumedExistingTranscription ? 'resumed' : 'created',
      remoteId: activeTranscriptionId,
      state: 'polling'
    })

    const pollResult = await pollAsyncSttJobUntilComplete({
      jobId: activeTranscriptionId,
      initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
      maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
      audioDurationSeconds,
      envSpecificDeadlineKey: 'AUTOSHOW_STT_POLL_DEADLINE_MS_SONIOX',
      pollMode: resumedExistingTranscription ? 'resume-probe' : 'fresh',
      buildDeadlineError: (jobId, pollDeadlineMs) => buildSonioxPollingDeadlineError(jobId, pollDeadlineMs),
      buildResumeProbeError: (jobId, probeCount, totalWaitMs) => buildSonioxResumeProbeError(jobId, probeCount, totalWaitMs),
      poll: async () => {
        const pollStartedAt = Date.now()
        const result = await pollTranscription(baseURL, apiKey, activeTranscriptionId, requestMetrics)
        pollMs += Date.now() - pollStartedAt
        return {
          status: result.status,
          retryAfterMs: result.retryAfterMs
        }
      },
      isComplete: (status) => status.status === 'completed',
      isFailed: (status) =>
        status.status === 'error'
          ? `Soniox transcription failed: ${status.error_message ?? status.error_type ?? 'unknown error'}`
          : undefined,
      onProgress: async () => {
        await persistProgressMetadata({
          ...(runtime ?? {
            mode: 'fresh',
            stage: 'polling',
            remoteJobId: activeTranscriptionId
          }),
          mode: runtime?.mode ?? 'fresh',
          stage: 'polling',
          remoteJobId: activeTranscriptionId,
          ...(fileId ? { remoteAssetId: fileId } : {}),
          ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
          lastPollAt: new Date().toISOString()
        })
      },
      withPollSlot: lifecycle?.withPollSlot
    })

    pollSleepMs += pollResult.pollSleepMs
    pollCount += pollResult.pollCount

    const transcriptStartedAt = Date.now()
    const transcript = await getTranscriptionTranscript(baseURL, apiKey, transcriptionId, requestMetrics)
    transcriptMs += Date.now() - transcriptStartedAt
    const result = normalizeSonioxTranscript(transcript, offsetSeconds)

    await Bun.write(`${outputBase}.txt`, formatTranscriptText(result.segments))

    const processingTime = Date.now() - startTime
    const remoteProcessingMs = Math.max(0, processingTime - uploadMs - createMs - pollMs - transcriptMs)
    const completedRuntime: Step2RuntimeMetadata = {
      ...(runtime ?? {
        mode: 'fresh',
        stage: 'completed',
        remoteJobId: activeTranscriptionId
      }),
      mode: runtime?.mode ?? 'fresh',
      stage: 'completed',
      remoteJobId: activeTranscriptionId,
      ...(fileId ? { remoteAssetId: fileId } : {}),
      ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
      ...(runtime?.lastPollAt ? { lastPollAt: runtime.lastPollAt } : {}),
      completedAt: new Date().toISOString()
    }
    metadata = {
      transcriptionService: 'soniox',
      transcriptionModel: modelName,
      processingTime,
      tokenCount: countTokens(result.text),
      runtime: completedRuntime,
      ...((uploadMs > 0 || createMs > 0 || pollMs > 0 || pollSleepMs > 0 || transcriptMs > 0 || remoteProcessingMs > 0 || requestCount > 0 || retryCount > 0 || rateLimitCount > 0)
        ? {
            timings: {
              ...(uploadMs > 0 ? { uploadMs } : {}),
              ...(createMs > 0 ? { createMs } : {}),
              ...(createCount > 0 ? { createCount } : {}),
              ...(pollMs > 0 ? { pollMs } : {}),
              ...(pollSleepMs > 0 ? { pollSleepMs } : {}),
              ...(pollCount > 0 ? { pollCount } : {}),
              ...(transcriptMs > 0 ? { transcriptMs } : {}),
              ...(remoteProcessingMs > 0 ? { remoteProcessingMs } : {}),
              ...(requestCount > 0 ? { requestCount } : {}),
              ...(retryCount > 0 ? { retryCount } : {}),
              ...(rateLimitCount > 0 ? { rateLimitCount } : {}),
              ...(backfillCount > 0 ? { backfillCount } : {})
            }
          }
        : {})
    }

    if (segmentNumber && totalSegments) {
      logSttSegmentLifecycle(l, { provider: 'soniox', action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
    }

    return { result, metadata }
  } finally {
    const cleanupStartedAt = Date.now()
    let remoteJobDeleted = false
    let remoteAssetDeleted = false
    if (transcriptionId) {
      remoteJobDeleted = await deleteTranscription(baseURL, apiKey, transcriptionId)
    }
    if (fileId) {
      remoteAssetDeleted = await deleteFile(baseURL, apiKey, fileId)
    }
    const cleanupMs = Date.now() - cleanupStartedAt
    if (metadata && cleanupMs > 0) {
      const processingTime = metadata.processingTime
      metadata.timings = {
        ...(metadata.timings ?? {}),
        cleanupMs,
        remoteProcessingMs: Math.max(0, processingTime
          - ((metadata.timings?.uploadMs ?? 0)
          + (metadata.timings?.createMs ?? 0)
          + (metadata.timings?.pollMs ?? 0)
          + (metadata.timings?.transcriptMs ?? 0)
          + cleanupMs))
      }
      metadata.runtime = {
        ...(metadata.runtime ?? {
          mode: runtime?.mode ?? 'fresh',
          stage: 'cleanup-complete',
          remoteJobId: transcriptionId ?? ''
        }),
        mode: metadata.runtime?.mode ?? runtime?.mode ?? 'fresh',
        stage: 'cleanup-complete',
        remoteJobId: metadata.runtime?.remoteJobId ?? transcriptionId ?? '',
        ...((metadata.runtime?.remoteAssetId ?? fileId) ? { remoteAssetId: metadata.runtime?.remoteAssetId ?? fileId } : {}),
        ...(metadata.runtime?.createCompletedAt ? { createCompletedAt: metadata.runtime.createCompletedAt } : {}),
        ...(metadata.runtime?.lastPollAt ? { lastPollAt: metadata.runtime.lastPollAt } : {}),
        ...(metadata.runtime?.completedAt ? { completedAt: metadata.runtime.completedAt } : {}),
        cleanupCompletedAt: new Date().toISOString(),
        cleanup: {
          ...(metadata.runtime?.cleanup ?? {}),
          ...(transcriptionId ? { remoteJobDeleted } : {}),
          ...(fileId ? { remoteAssetDeleted } : {})
        }
      }
    }
  }
}
