import type {
  AsyncSttLifecycleHooks,
  Step2Metadata,
  Step2RuntimeMetadata,
  SupadataJobStatus,
  SupadataTranscriptPayload,
  TranscriptionResult
} from '~/types'
import * as l from '~/utils/logger'
import {
  logSttAsyncJobLifecycle,
  logSttSegmentLifecycle,
  logSttTranscriptOutput
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
import { readSttProviderCheckpoint } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/manifest'
import { getSupadataBaseUrl, isSupadataSupportedSourceUrl } from './supadata'
import { readEnv } from '~/utils/validate/env-utils'
import { getSupadataCreditRateCents } from '~/utils/pricing/supadata-pricing'
import {
  fetchSupadataTranscript,
  pollSupadataTranscriptJob
} from './supadata-api'
import {
  extractSupadataErrorMessage,
  parseSupadataJobPayload,
  parseSupadataTranscriptPayload
} from './supadata-response-parsers'
import {
  attachSupadataErrorContext,
  buildSupadataPollingDeadlineError,
  buildSupadataResumeProbeError,
  buildSupadataUnsupportedSourceError,
  parsePersistedSupadataBilling,
  parseSupadataBillableRequests
} from './supadata-utils'
import { normalizeSupadataTranscript } from './parse-supadata-transcript'

const INITIAL_POLL_INTERVAL_MS = 1_000
const MAX_POLL_INTERVAL_MS = 10_000

export const runSupadataStt = async (
  _audioPath: string,
  outputDir: string,
  options: {
    model: string
    sourceUrl?: string | undefined
    language?: string | undefined
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    audioDurationSeconds?: number | undefined
    runMode?: 'initial' | 'backfill' | undefined
    lifecycle?: AsyncSttLifecycleHooks | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const {
    model: modelName,
    sourceUrl,
    language,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options

  if (typeof sourceUrl !== 'string' || sourceUrl.length === 0 || sourceUrl.startsWith('file:')) {
    throw buildSupadataUnsupportedSourceError(sourceUrl)
  }

  if (!isSupadataSupportedSourceUrl(sourceUrl)) {
    throw buildSupadataUnsupportedSourceError(sourceUrl)
  }

  const apiKey = readEnv('SUPADATA_API_KEY')
  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY environment variable is required for Supadata transcription')
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'supadata', action: 'started', segmentNumber, totalSegments, model: modelName })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const baseURL = getSupadataBaseUrl()
  const backfillCount = runMode === 'backfill' ? 1 : 0
  let createMs = 0
  let pollMs = 0
  let pollSleepMs = 0
  let createCount = 0
  let pollCount = 0
  let requestCount = 0
  let retryCount = 0
  let rateLimitCount = 0
  const persistedCheckpointMetadata = await readSttProviderCheckpoint(outputDir)
  const persistedBilling = persistedCheckpointMetadata
    && persistedCheckpointMetadata['transcriptionService'] === 'supadata'
    && persistedCheckpointMetadata['transcriptionModel'] === modelName
      ? parsePersistedSupadataBilling(persistedCheckpointMetadata)
      : undefined
  let runtime = await readPersistedAsyncSttRuntime(outputDir, {
    transcriptionService: 'supadata',
    transcriptionModel: modelName
  })
  let billedCredits = persistedBilling?.creditsUsed
  let creditRateCents = persistedBilling?.creditRateCents ?? getSupadataCreditRateCents()
  let billingSource = persistedBilling?.source
  let jobId = runtime?.remoteJobId
  let jobReadyNotified = false
  let resumedExistingJob = false
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

  const buildBillingMetadata = (): Step2Metadata['billing'] | undefined => {
    if (typeof billedCredits !== 'number' && !billingSource) {
      return undefined
    }

    const billing: NonNullable<Step2Metadata['billing']> = {
      ...(typeof creditRateCents === 'number' ? { creditRateCents } : {}),
      ...(typeof billedCredits === 'number' ? { creditsUsed: billedCredits } : {}),
      ...(billingSource ? { source: billingSource } : {})
    }

    return Object.keys(billing).length > 0 ? billing : undefined
  }

  const captureCreateBilling = (headers: Headers): void => {
    const credits = parseSupadataBillableRequests(headers)
    if (credits === undefined) {
      return
    }

    billedCredits = credits
    creditRateCents = getSupadataCreditRateCents()
    billingSource = 'response-header'
  }

  const buildProgressMetadata = (nextRuntime: Step2RuntimeMetadata): Step2Metadata => ({
    transcriptionService: 'supadata',
    transcriptionModel: modelName,
    processingTime: Date.now() - startTime,
    tokenCount: 0,
    timings: {
      ...(createMs > 0 ? { createMs } : {}),
      ...(createCount > 0 ? { createCount } : {}),
      ...(pollMs > 0 ? { pollMs } : {}),
      ...(pollSleepMs > 0 ? { pollSleepMs } : {}),
      ...(pollCount > 0 ? { pollCount } : {}),
      ...(requestCount > 0 ? { requestCount } : {}),
      ...(retryCount > 0 ? { retryCount } : {}),
      ...(rateLimitCount > 0 ? { rateLimitCount } : {}),
      ...(backfillCount > 0 ? { backfillCount } : {})
    },
    runtime: nextRuntime,
    ...(buildBillingMetadata() ? { billing: buildBillingMetadata() } : {})
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

  let finalPayload: SupadataTranscriptPayload | undefined

  if (runtime && (runtime.stage === 'created' || runtime.stage === 'polling')) {
    resumedExistingJob = true
    const resumedRuntime: Step2RuntimeMetadata = {
      ...runtime,
      mode: 'resumed',
      stage: 'polling'
    }
    jobId = resumedRuntime.remoteJobId
    await persistProgressMetadata(resumedRuntime)
    await notifyJobReady(resumedRuntime)
    logSttAsyncJobLifecycle(l, {
      provider: `supadata/${modelName}`,
      action: 'resumed',
      remoteId: jobId,
      state: 'polling'
    })
  } else {
    let createResult: Awaited<ReturnType<typeof fetchSupadataTranscript>> | undefined
    try {
      const createStartedAt = Date.now()
      createResult = await fetchSupadataTranscript({
        baseURL,
        apiKey,
        sourceUrl,
        modelName,
        language,
        metrics: requestMetrics
      })
      createMs += Date.now() - createStartedAt
      createCount += 1
    } catch (error) {
      attachSupadataErrorContext(error, 'create', 'runtime_http_create_conservative')
    }
    if (!createResult) {
      throw new Error('Supadata transcript request did not return a response')
    }

    if (createResult.status === 202) {
      captureCreateBilling(createResult.headers)
      const jobPayload = parseSupadataJobPayload(createResult.payload)
      if (!jobPayload) {
        throw Object.assign(new Error('Supadata returned 202 without a jobId'), {
          stage: 'create',
          retryClass: 'runtime_http_create_conservative' as const,
          rawResponse: createResult.payload
        })
      }

      const nextRuntime: Step2RuntimeMetadata = {
        mode: 'fresh',
        stage: 'created',
        remoteJobId: jobPayload.jobId,
        createCompletedAt: new Date().toISOString()
      }
      jobId = jobPayload.jobId
      await persistProgressMetadata(nextRuntime)
      await notifyJobReady(nextRuntime)
      await persistProgressMetadata({
        ...nextRuntime,
        stage: 'polling'
      })
      logSttAsyncJobLifecycle(l, {
        provider: `supadata/${modelName}`,
        action: 'created',
        remoteId: jobPayload.jobId,
        state: 'polling'
      })
    } else {
      captureCreateBilling(createResult.headers)
      const transcriptPayload = parseSupadataTranscriptPayload(createResult.payload)
      if (!transcriptPayload) {
        throw Object.assign(new Error('Supadata returned an invalid transcript payload'), {
          stage: 'create',
          retryClass: 'runtime_http_create_conservative' as const,
          rawResponse: createResult.payload
        })
      }
      finalPayload = transcriptPayload
    }
  }

  if (jobId && finalPayload === undefined) {
    const pollMode = resumedExistingJob ? 'resume-probe' : 'fresh'

    let completedStatus: SupadataJobStatus | undefined
    try {
      const pollStartedAt = Date.now()
      const pollResult = await pollAsyncSttJobUntilComplete({
        jobId,
        initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
        maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
        audioDurationSeconds,
        pollMode,
        poll: async () => await pollSupadataTranscriptJob({
          baseURL,
          apiKey,
          jobId,
          metrics: requestMetrics
        }),
        isComplete: (status) => status.status === 'completed',
        isFailed: (status) => {
          if (status.status !== 'failed') {
            return undefined
          }
          return extractSupadataErrorMessage(status.error) ?? extractSupadataErrorMessage(status.message) ?? 'Supadata transcription failed'
        },
        buildDeadlineError: buildSupadataPollingDeadlineError,
        buildResumeProbeError: buildSupadataResumeProbeError,
        onProgress: async () => {
          if (!runtime || runtime.remoteJobId !== jobId) {
            return
          }

          await persistProgressMetadata({
            ...runtime,
            mode: runtime.mode === 'fresh' ? 'fresh' : 'resumed',
            stage: 'polling',
            lastPollAt: new Date().toISOString()
          })
        },
        withPollSlot: lifecycle?.withPollSlot
      })
      pollMs += Date.now() - pollStartedAt
      pollCount += pollResult.pollCount
      pollSleepMs += pollResult.pollSleepMs
      completedStatus = pollResult.status
    } catch (error) {
      attachSupadataErrorContext(error, 'poll', 'runtime_http_read')
    }

    if (!runtime) {
      throw new Error('Supadata runtime was not initialized before polling')
    }

    if (!completedStatus) {
      throw new Error('Supadata polling completed without a terminal status payload')
    }

    const transcriptPayload = parseSupadataTranscriptPayload({
      content: completedStatus.content ?? '',
      ...(completedStatus.lang ? { lang: completedStatus.lang } : {}),
      ...(completedStatus.availableLangs ? { availableLangs: completedStatus.availableLangs } : {})
    })
    if (!transcriptPayload) {
      throw Object.assign(new Error('Supadata completed job without transcript content'), {
        stage: 'poll',
        retryClass: 'runtime_http_read' as const,
        rawResponse: completedStatus
      })
    }

    const completedRuntime: Step2RuntimeMetadata = {
      ...runtime,
      stage: 'completed',
      completedAt: new Date().toISOString(),
      lastPollAt: new Date().toISOString()
    }
    await persistProgressMetadata(completedRuntime)
    finalPayload = transcriptPayload
    runtime = completedRuntime
  }

  if (!finalPayload) {
    throw new Error('Supadata did not return a transcript payload')
  }

  const result = normalizeSupadataTranscript(finalPayload, offsetSeconds)
  await Bun.write(`${outputBase}.txt`, formatTranscriptText(result.segments))
  logSttTranscriptOutput(l, {
    provider: 'supadata',
    path: `${outputBase}.txt`,
    characters: result.text.length
  })

  const processingTime = Date.now() - startTime
  const metadata: Step2Metadata = {
    transcriptionService: 'supadata',
    transcriptionModel: modelName,
    processingTime,
    tokenCount: countTokens(result.text),
    timings: {
      ...(createMs > 0 ? { createMs } : {}),
      ...(createCount > 0 ? { createCount } : {}),
      ...(pollMs > 0 ? { pollMs } : {}),
      ...(pollSleepMs > 0 ? { pollSleepMs } : {}),
      ...(pollCount > 0 ? { pollCount } : {}),
      ...(requestCount > 0 ? { requestCount } : {}),
      ...(retryCount > 0 ? { retryCount } : {}),
      ...(rateLimitCount > 0 ? { rateLimitCount } : {}),
      ...(backfillCount > 0 ? { backfillCount } : {})
    },
    ...(runtime ? { runtime } : {}),
    ...(buildBillingMetadata() ? { billing: buildBillingMetadata() } : {})
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'supadata', action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
  }

  return { result, metadata }
}
