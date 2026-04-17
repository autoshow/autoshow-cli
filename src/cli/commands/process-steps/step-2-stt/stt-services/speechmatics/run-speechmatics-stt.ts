import { basename } from 'node:path'
import type {
  AsyncSttLifecycleHooks,
  DiarizationOptions,
  RetryClass,
  SpeechmaticsHttpError,
  SpeechmaticsCreateJobResponse,
  SpeechmaticsJob,
  SpeechmaticsTranscriptResponse,
  Step2Metadata,
  Step2RuntimeMetadata,
  TranscriptionSegment,
  TranscriptionResult
} from '~/types'
import {
  SpeechmaticsCreateJobResponseSchema,
  SpeechmaticsJobResponseSchema,
  SpeechmaticsTranscriptResponseSchema
} from '~/types'
import * as l from '~/logger'
import {
  appendToken,
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/stt-utils'
import {
  pollAsyncSttJobUntilComplete,
  readPersistedAsyncSttRuntime,
  writeAsyncSttProgressMetadata
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/async-stt-job-runner'
import { getSpeechmaticsBaseUrl } from './speechmatics'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { readEnvFallback } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const INITIAL_POLL_INTERVAL_MS = 1000
const MAX_POLL_INTERVAL_MS = 10000
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

const buildSpeechmaticsUrl = (baseURL: string, path: string): string =>
  new URL(path, baseURL).toString()

const getErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

const toSpeechmaticsHttpError = (
  stage: 'create' | 'poll' | 'transcript',
  retryClass: RetryClass,
  response: Response,
  errText: string
): SpeechmaticsHttpError => Object.assign(
  new Error(`Speechmatics ${stage} failed (${response.status}): ${errText}`),
  {
    status: response.status,
    headers: response.headers,
    stage,
    retryClass
  }
)

const attachSpeechmaticsErrorContext = (
  error: unknown,
  stage: 'create' | 'poll' | 'transcript',
  retryClass: RetryClass
): never => {
  if (error instanceof Error && error.cause instanceof Error) {
    ;(error.cause as SpeechmaticsHttpError).stage = stage
    ;(error.cause as SpeechmaticsHttpError).retryClass = retryClass
    throw error.cause
  }

  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as SpeechmaticsHttpError).stage = stage
  ;(source as SpeechmaticsHttpError).retryClass = retryClass
  throw source
}

const attachSpeechmaticsValidationContext = (
  error: unknown,
  stage: 'create' | 'poll' | 'transcript',
  retryClass: RetryClass,
  rawResponse: unknown
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as SpeechmaticsHttpError).stage = stage
  ;(source as SpeechmaticsHttpError).retryClass = retryClass
  ;(source as SpeechmaticsHttpError).rawResponse = rawResponse
  throw source
}

const buildCreateForm = (
  audioPath: string,
  modelName: string
): FormData => {
  const form = new FormData()
  form.append('data_file', Bun.file(audioPath), basename(audioPath))
  form.append('config', JSON.stringify({
    type: 'transcription',
    transcription_config: {
      language: 'auto',
      operating_point: modelName,
      diarization: 'speaker'
    }
  }))
  return form
}

const buildPollingDeadlineError = (
  jobId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`Speechmatics timed out waiting for transcription completion for ${jobId} (deadline exceeded after ${pollDeadlineMs}ms)`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const buildResumeProbeError = (
  jobId: string,
  probeCount: number,
  totalWaitMs: number
): never => {
  const error = Object.assign(
    new Error(`Speechmatics job ${jobId} is still pending after ${probeCount} resume status checks (${totalWaitMs}ms total backoff). Retry the command later.`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const buildRejectedJobMessage = (job: SpeechmaticsJob): string => {
  if (typeof job.error === 'string' && job.error.length > 0) {
    return `Speechmatics transcription failed: ${job.error}`
  }

  const message = job.errors
    ?.map((entry) => entry.message)
    .find((value): value is string => typeof value === 'string' && value.length > 0)
  if (message) {
    return `Speechmatics transcription failed: ${message}`
  }

  return 'Speechmatics transcription failed: job was rejected'
}

const getTranscript = async (
  baseURL: string,
  apiKey: string,
  jobId: string,
  metrics?: {
    onRequest?: (() => void) | undefined
    onRetry?: ((status: number | undefined) => void) | undefined
  } | undefined
): Promise<SpeechmaticsTranscriptResponse> => {
  let rawPayload: unknown
  try {
    rawPayload = await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'speechmatics-get-transcript',
        policy: { maxAttempts: 6 },
        timeoutMs: POLL_REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        metrics?.onRequest?.()
        const response = await fetch(buildSpeechmaticsUrl(baseURL, `/v2/jobs/${jobId}/transcript?format=json-v2`), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`
          },
          signal: signal ?? null
        })

        if (!response.ok) {
          throw toSpeechmaticsHttpError('transcript', 'runtime_http_read', response, await response.text())
        }

        return await response.json()
      },
      (error) => {
        const decision = classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
        if (decision.shouldRetry) {
          metrics?.onRetry?.(getErrorStatus(error))
        }
        return decision
      }
    )
  } catch (error) {
    attachSpeechmaticsErrorContext(error, 'transcript', 'runtime_http_read')
  }

  try {
    return validateData(SpeechmaticsTranscriptResponseSchema, rawPayload, 'Speechmatics transcript response')
  } catch (error) {
    return attachSpeechmaticsValidationContext(error, 'transcript', 'runtime_http_read', rawPayload)
  }
}

const deleteJob = async (
  baseURL: string,
  apiKey: string,
  jobId: string
): Promise<boolean> => {
  try {
    const response = await fetch(buildSpeechmaticsUrl(baseURL, `/v2/jobs/${jobId}`), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok && response.status !== 404) {
      l.warn(`Speechmatics cleanup failed for job ${jobId} (${response.status})`)
      return false
    }

    return true
  } catch (error) {
    l.warn(`Speechmatics cleanup failed for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

const toTranscriptOutput = (
  transcript: SpeechmaticsTranscriptResponse,
  offsetSeconds: number
): { text: string, segments: TranscriptionSegment[] } => {
  const tokens = transcript.results.flatMap((result) => {
    if (result.type !== 'word' && result.type !== 'punctuation') {
      return []
    }

    const alternative = result.alternatives[0]
    if (!alternative || alternative.content.length === 0) {
      return []
    }

    return [{
      start: result.start_time,
      end: result.end_time,
      text: alternative.content,
      speaker: typeof alternative.speaker === 'string' && alternative.speaker.length > 0
        ? alternative.speaker
        : undefined,
      isEos: result.is_eos === true
    }]
  })

  const segments: TranscriptionSegment[] = []
  let text = ''
  let currentText = ''
  let currentSpeaker: string | undefined
  let segmentStart: number | null = null
  let segmentEnd: number | null = null

  const flush = (): void => {
    const trimmed = currentText.trim()
    if (trimmed.length === 0) {
      currentText = ''
      currentSpeaker = undefined
      segmentStart = null
      segmentEnd = null
      return
    }

    const start = segmentStart ?? 0
    const end = segmentEnd ?? start
    segments.push({
      start: toTimestamp(start + offsetSeconds),
      end: toTimestamp(end + offsetSeconds),
      text: trimmed,
      ...(currentSpeaker ? { speaker: currentSpeaker } : {})
    })

    currentText = ''
    currentSpeaker = undefined
    segmentStart = null
    segmentEnd = null
  }

  for (const token of tokens) {
    text = appendToken(text, token.text)

    if (currentText.trim().length > 0 && token.speaker && currentSpeaker && token.speaker !== currentSpeaker) {
      flush()
    }

    if (segmentStart === null) {
      segmentStart = token.start
    }
    segmentEnd = token.end

    if (currentSpeaker === undefined && token.speaker !== undefined) {
      currentSpeaker = token.speaker
    }

    currentText = appendToken(currentText, token.text)

    if (token.isEos) {
      flush()
    }
  }

  flush()

  return {
    text: text.trim(),
    segments
  }
}

const evidenceWordsFromTranscript = (
  transcript: SpeechmaticsTranscriptResponse,
  offsetSeconds: number
) => transcript.results
  .map((result) => {
    if (result.type !== 'word' && result.type !== 'punctuation') {
      return null
    }

    const alternative = result.alternatives[0]
    if (!alternative || alternative.content.trim().length === 0) {
      return null
    }

    return {
      startSeconds: result.start_time + offsetSeconds,
      endSeconds: result.end_time + offsetSeconds,
      text: alternative.content,
      normalized: alternative.content.toLowerCase(),
      ...(typeof alternative.speaker === 'string' && alternative.speaker.length > 0 ? { speaker: alternative.speaker } : {}),
      ...(typeof alternative.confidence === 'number' ? { confidence: alternative.confidence } : {}),
      timingSource: 'native' as const
    }
  })
  .filter((word): word is NonNullable<typeof word> => word !== null)

export const runSpeechmaticsStt = async (
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
  const apiKey = readEnvFallback('SPEECHMATICS_API_KEY')
  if (!apiKey) {
    throw new Error('SPEECHMATICS_API_KEY environment variable is required for Speechmatics transcription')
  }

  const {
    model: modelName,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options
  const baseURL = getSpeechmaticsBaseUrl()
  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  let createMs = 0
  let pollMs = 0
  let pollSleepMs = 0
  let transcriptMs = 0
  let createCount = 0
  let pollCount = 0
  let requestCount = 0
  let retryCount = 0
  let rateLimitCount = 0
  const backfillCount = runMode === 'backfill' ? 1 : 0

  let runtime = await readPersistedAsyncSttRuntime(outputDir, {
    transcriptionService: 'speechmatics',
    transcriptionModel: modelName
  })
  let jobId = runtime?.remoteJobId
  let lastKnownJobStatus: SpeechmaticsJob | undefined
  let resumedExistingJob = false
  let jobReadyNotified = false
  let metadata: Step2Metadata | undefined

  const buildProgressMetadata = (nextRuntime: Step2RuntimeMetadata): Step2Metadata => ({
    transcriptionService: 'speechmatics',
    transcriptionModel: modelName,
    transcriptionModelName: modelName,
    processingTime: Date.now() - startTime,
    tokenCount: 0,
    timings: {
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
      let rawPayload: unknown
      try {
        const createStartedAt = Date.now()
        rawPayload = await withRetry(
          {
            retryClass: 'runtime_http_create_conservative',
            operationName: 'speechmatics-create-job',
            policy: { maxAttempts: 4 },
            timeoutMs: REQUEST_TIMEOUT_MS
          },
          async (signal) => {
            requestCount += 1
            const response = await fetch(buildSpeechmaticsUrl(baseURL, '/v2/jobs'), {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${apiKey}`
              },
              body: buildCreateForm(audioPath, modelName),
              signal: signal ?? null
            })

            if (!response.ok) {
              throw toSpeechmaticsHttpError('create', 'runtime_http_create_conservative', response, await response.text())
            }

            return await response.json()
          },
          (error) => {
            const decision = classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
            if (decision.shouldRetry) {
              retryCount += 1
              if (getErrorStatus(error) === 429) {
                rateLimitCount += 1
              }
            }
            return decision
          }
        )
        createMs += Date.now() - createStartedAt
        createCount += 1
      } catch (error) {
        attachSpeechmaticsErrorContext(error, 'create', 'runtime_http_create_conservative')
      }

      let createResponse!: SpeechmaticsCreateJobResponse
      try {
        createResponse = validateData(SpeechmaticsCreateJobResponseSchema, rawPayload, 'Speechmatics create job response')
      } catch (error) {
        attachSpeechmaticsValidationContext(error, 'create', 'runtime_http_create_conservative', rawPayload)
      }

      jobId = 'job' in createResponse ? createResponse.job.id : createResponse.id
      lastKnownJobStatus = 'job' in createResponse ? createResponse.job : undefined
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
      throw new Error('Speechmatics job creation did not produce a job id')
    }

    const activeJobId = jobId
    l.info(`${resumedExistingJob ? 'Speechmatics job resumed' : 'Speechmatics job created'}: ${activeJobId}, polling for completion...`)

    const pollResult = await pollAsyncSttJobUntilComplete({
      jobId: activeJobId,
      initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
      maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
      audioDurationSeconds,
      envSpecificDeadlineKey: 'AUTOSHOW_STT_POLL_DEADLINE_MS_SPEECHMATICS',
      pollMode: resumedExistingJob ? 'resume-probe' : 'fresh',
      buildDeadlineError: (nextJobId, pollDeadlineMs) => buildPollingDeadlineError(nextJobId, pollDeadlineMs),
      buildResumeProbeError: (nextJobId, probeCount, totalWaitMs) => buildResumeProbeError(nextJobId, probeCount, totalWaitMs),
      poll: async () => {
        let result!: { payload: unknown, retryAfterMs: number | null }
        try {
          const pollStartedAt = Date.now()
          result = await withRetry(
            {
              retryClass: 'runtime_http_read',
              operationName: 'speechmatics-poll-job',
              policy: { maxAttempts: 6 },
              timeoutMs: POLL_REQUEST_TIMEOUT_MS
            },
            async (signal) => {
              requestCount += 1
              const response = await fetch(buildSpeechmaticsUrl(baseURL, `/v2/jobs/${activeJobId}`), {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${apiKey}`
                },
                signal: signal ?? null
              })

              if (!response.ok) {
                throw toSpeechmaticsHttpError('poll', 'runtime_http_read', response, await response.text())
              }

              return {
                payload: await response.json(),
                retryAfterMs: parseRetryAfterMs(response.headers) ?? null
              }
            },
            (error) => {
              const decision = classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
              if (decision.shouldRetry) {
                retryCount += 1
                if (getErrorStatus(error) === 429) {
                  rateLimitCount += 1
                }
              }
              return decision
            }
          )
          pollMs += Date.now() - pollStartedAt
        } catch (error) {
          attachSpeechmaticsErrorContext(error, 'poll', 'runtime_http_read')
        }

        let statusResponse!: { job: SpeechmaticsJob }
        try {
          statusResponse = validateData(SpeechmaticsJobResponseSchema, result.payload, 'Speechmatics job status response')
        } catch (error) {
          attachSpeechmaticsValidationContext(error, 'poll', 'runtime_http_read', result.payload)
        }

        return {
          status: statusResponse.job,
          retryAfterMs: result.retryAfterMs
        }
      },
      isComplete: (status) => status.status === 'done',
      isFailed: (status) => status.status === 'rejected' ? buildRejectedJobMessage(status) : undefined,
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
      withPollSlot: lifecycle?.withPollSlot
    })

    pollSleepMs += pollResult.pollSleepMs
    pollCount += pollResult.pollCount

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

    let transcript!: SpeechmaticsTranscriptResponse
    try {
      const transcriptStartedAt = Date.now()
      transcript = await getTranscript(baseURL, apiKey, activeJobId, {
        onRequest: () => {
          requestCount += 1
        },
        onRetry: (status) => {
          retryCount += 1
          if (status === 429) {
            rateLimitCount += 1
          }
        }
      })
      transcriptMs += Date.now() - transcriptStartedAt
    } catch (error) {
      attachSpeechmaticsErrorContext(error, 'transcript', 'runtime_http_read')
    }

    const transcriptOutput = toTranscriptOutput(transcript, offsetSeconds)
    const evidenceWords = evidenceWordsFromTranscript(transcript, offsetSeconds)
    const { finalSegments, finalText } = resolveTranscriptionOutput(
      transcriptOutput.segments,
      transcriptOutput.text,
      offsetSeconds
    )

    await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

    const processingTime = Date.now() - startTime
    const remoteProcessingMs = Math.max(0, processingTime - createMs - pollMs - transcriptMs)
    metadata = {
      transcriptionService: 'speechmatics',
      transcriptionModel: modelName,
      transcriptionModelName: modelName,
      processingTime,
      tokenCount: countTokens(finalText),
      runtime: completedRuntime,
      ...((createMs > 0 || pollMs > 0 || pollSleepMs > 0 || transcriptMs > 0 || remoteProcessingMs > 0 || requestCount > 0 || retryCount > 0 || rateLimitCount > 0)
        ? {
            timings: {
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
      l.success(`Segment ${segmentNumber}/${totalSegments} transcription completed in ${processingTime}ms`)
    }

    return {
      result: {
        text: finalText,
        segments: finalSegments,
        evidence: {
          ...(evidenceWords.length > 0 ? {
            words: evidenceWords
          } : {}),
          capabilities: {
            hasNativeWordTiming: evidenceWords.length > 0,
            hasConfidence: evidenceWords.some((word) => typeof word.confidence === 'number'),
            hasSpeakerLabels: evidenceWords.some((word) => word.speaker !== undefined) || finalSegments.some((segment) => segment.speaker !== undefined)
          },
          timingQuality: evidenceWords.length > 0 ? 'native_word' : 'segment_interpolated',
          rawResponse: transcript
        }
      },
      metadata
    }
  } finally {
    const cleanupStartedAt = Date.now()
    const shouldDeleteRemoteJob = jobId !== undefined
      && (metadata !== undefined || lastKnownJobStatus?.status === 'done' || lastKnownJobStatus?.status === 'rejected')
    const remoteJobDeleted = shouldDeleteRemoteJob && jobId ? await deleteJob(baseURL, apiKey, jobId) : false
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
      await writeAsyncSttProgressMetadata(outputDir, buildProgressMetadata(cleanupRuntime))
    }
  }
}
