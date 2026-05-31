import * as l from '~/utils/logger'
import { basename } from 'node:path'
import type {
  AsyncSttLifecycleHooks,
  DiarizationOptions,
  RetryClass,
  SpeechmaticsHttpError,
  SpeechmaticsJob,
  SpeechmaticsTranscriptResponse,
  Step2Metadata,
  TranscriptionSegment,
  TranscriptionResult
} from '~/types'
import {
  SpeechmaticsCreateJobResponseSchema,
  SpeechmaticsJobResponseSchema,
  SpeechmaticsTranscriptResponseSchema
} from '~/types'
import {
  logSttCleanupFailure,
  logSttSegmentLifecycle
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import {
  appendToken,
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { buildTranscriptionWordEvidence } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-evidence'
import {
  attachAsyncSttErrorContext,
  attachAsyncSttValidationContext,
  getAsyncSttErrorStatus,
  runAsyncSttJobLifecycle,
  type AsyncSttLifecycleMetrics
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { getSpeechmaticsBaseUrl } from './speechmatics'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const INITIAL_POLL_INTERVAL_MS = 1000
const MAX_POLL_INTERVAL_MS = 10000
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

const buildSpeechmaticsUrl = (baseURL: string, path: string): string =>
  new URL(path, baseURL).toString()

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
          metrics?.onRetry?.(getAsyncSttErrorStatus(error))
        }
        return decision
      }
    )
  } catch (error) {
    attachAsyncSttErrorContext<SpeechmaticsHttpError>(error, 'transcript', 'runtime_http_read')
  }

  try {
    return validateData(SpeechmaticsTranscriptResponseSchema, rawPayload, 'Speechmatics transcript response')
  } catch (error) {
    return attachAsyncSttValidationContext<SpeechmaticsHttpError>(error, 'transcript', 'runtime_http_read', rawPayload)
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
      logSttCleanupFailure(l, {
        provider: 'speechmatics',
        artifact: 'job',
        id: jobId,
        detail: String(response.status)
      })
      return false
    }

    return true
  } catch (error) {
    logSttCleanupFailure(l, {
      provider: 'speechmatics',
      artifact: 'job',
      id: jobId,
      detail: error instanceof Error ? error.message : String(error)
    })
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

const createSpeechmaticsJob = async (
  baseURL: string,
  apiKey: string,
  audioPath: string,
  modelName: string,
  metrics: AsyncSttLifecycleMetrics
): Promise<{ jobId: string, status?: SpeechmaticsJob | undefined }> => {
  let rawPayload: unknown
  try {
    rawPayload = await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'speechmatics-create-job',
        policy: { maxAttempts: 4 },
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        metrics.requestCount += 1
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
          metrics.retryCount += 1
          if (getAsyncSttErrorStatus(error) === 429) {
            metrics.rateLimitCount += 1
          }
        }
        return decision
      }
    )
  } catch (error) {
    return attachAsyncSttErrorContext<SpeechmaticsHttpError>(error, 'create', 'runtime_http_create_conservative')
  }

  try {
    const createResponse = validateData(SpeechmaticsCreateJobResponseSchema, rawPayload, 'Speechmatics create job response')
    return {
      jobId: 'job' in createResponse ? createResponse.job.id : createResponse.id,
      ...('job' in createResponse ? { status: createResponse.job } : {})
    }
  } catch (error) {
    return attachAsyncSttValidationContext<SpeechmaticsHttpError>(error, 'create', 'runtime_http_create_conservative', rawPayload)
  }
}

const pollSpeechmaticsJob = async (
  baseURL: string,
  apiKey: string,
  jobId: string,
  metrics: AsyncSttLifecycleMetrics
): Promise<{ status: SpeechmaticsJob, retryAfterMs: number | null }> => {
  let result!: { payload: unknown, retryAfterMs: number | null }
  try {
    result = await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'speechmatics-poll-job',
        policy: { maxAttempts: 6 },
        timeoutMs: POLL_REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        metrics.requestCount += 1
        const response = await fetch(buildSpeechmaticsUrl(baseURL, `/v2/jobs/${jobId}`), {
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
          metrics.retryCount += 1
          if (getAsyncSttErrorStatus(error) === 429) {
            metrics.rateLimitCount += 1
          }
        }
        return decision
      }
    )
  } catch (error) {
    return attachAsyncSttErrorContext<SpeechmaticsHttpError>(error, 'poll', 'runtime_http_read')
  }

  try {
    const statusResponse = validateData(SpeechmaticsJobResponseSchema, result.payload, 'Speechmatics job status response')
    return {
      status: statusResponse.job,
      retryAfterMs: result.retryAfterMs
    }
  } catch (error) {
    return attachAsyncSttValidationContext<SpeechmaticsHttpError>(error, 'poll', 'runtime_http_read', result.payload)
  }
}

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
  const apiKey = readEnv('SPEECHMATICS_API_KEY')
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

  return await runAsyncSttJobLifecycle<SpeechmaticsJob, SpeechmaticsTranscriptResponse>({
    outputDir,
    providerService: 'speechmatics',
    providerLogLabel: 'speechmatics',
    providerDisplayName: 'Speechmatics',
    modelName,
    startTime,
    runMode,
    lifecycle,
    audioDurationSeconds,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    createJob: async (metrics) => await createSpeechmaticsJob(baseURL, apiKey, audioPath, modelName, metrics),
    pollJob: async (jobId, metrics) => await pollSpeechmaticsJob(baseURL, apiKey, jobId, metrics),
    getTranscript: async (jobId, metrics) => await getTranscript(baseURL, apiKey, jobId, {
      onRequest: () => {
        metrics.requestCount += 1
      },
      onRetry: (status) => {
        metrics.retryCount += 1
        if (status === 429) {
          metrics.rateLimitCount += 1
        }
      }
    }),
    isComplete: (status) => status.status === 'done',
    isFailed: (status) => status.status === 'rejected' ? buildRejectedJobMessage(status) : undefined,
    buildDeadlineError: (jobId, pollDeadlineMs) => buildPollingDeadlineError(jobId, pollDeadlineMs),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs) => buildResumeProbeError(jobId, probeCount, totalWaitMs),
    deleteJob: async (jobId) => await deleteJob(baseURL, apiKey, jobId),
    shouldDeleteRemoteJob: ({ metadata, lastKnownStatus }) =>
      metadata !== undefined || lastKnownStatus?.status === 'done' || lastKnownStatus?.status === 'rejected',
    buildResult: async ({ transcript, runtime, processingTime, timings }) => {
      const transcriptOutput = toTranscriptOutput(transcript, offsetSeconds)
      const evidenceWords = evidenceWordsFromTranscript(transcript, offsetSeconds)
      const { finalSegments, finalText } = resolveTranscriptionOutput(
        transcriptOutput.segments,
        transcriptOutput.text,
        offsetSeconds
      )

      await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

      const metadata: Step2Metadata = {
        transcriptionService: 'speechmatics',
        transcriptionModel: modelName,
        processingTime,
        tokenCount: countTokens(finalText),
        runtime,
        ...(timings ? { timings } : {})
      }

      if (segmentNumber && totalSegments) {
        logSttSegmentLifecycle(l, { provider: 'speechmatics', action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
      }

      return {
        result: {
          text: finalText,
          segments: finalSegments,
          evidence: buildTranscriptionWordEvidence({ words: evidenceWords, segments: finalSegments, rawResponse: transcript })
        },
        metadata
      }
    }
  })
}
