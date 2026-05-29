import * as l from '~/utils/logger'
import { basename } from 'node:path'
import type {
  AsyncSttLifecycleHooks,
  DiarizationOptions,
  RetryClass,
  RevHttpError,
  RevJob,
  RevTranscriptResponse,
  Step2Metadata,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import {
  RevJobSchema,
  RevTranscriptResponseSchema
} from '~/types'
import {
  logSttCleanupFailure,
  logSttSegmentLifecycle
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatSpeakerLabel,
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
import { getRevBaseUrl } from './rev'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const INITIAL_POLL_INTERVAL_MS = 2000
const MAX_POLL_INTERVAL_MS = 10000
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

const buildRevUrl = (baseURL: string, path: string): string =>
  new URL(path.replace(/^\/+/, ''), baseURL.endsWith('/') ? baseURL : `${baseURL}/`).toString()

const toRevHttpError = (
  stage: 'create' | 'poll' | 'transcript',
  retryClass: RetryClass,
  response: Response,
  errText: string
): RevHttpError => Object.assign(
  new Error(`Rev ${stage} failed (${response.status}): ${errText}`),
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
  form.append('media', Bun.file(audioPath), basename(audioPath))
  form.append('options', JSON.stringify({
    transcriber: modelName,
    remove_disfluencies: true
  }))
  return form
}

const buildPollingDeadlineError = (
  jobId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`Rev timed out waiting for transcription completion for ${jobId} (deadline exceeded after ${pollDeadlineMs}ms)`),
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
    new Error(`Rev job ${jobId} is still pending after ${probeCount} resume status checks (${totalWaitMs}ms total backoff). Retry the command later.`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const buildFailedJobMessage = (job: RevJob): string => {
  if (typeof job.failure_detail === 'string' && job.failure_detail.length > 0) {
    return `Rev transcription failed: ${job.failure_detail}`
  }

  if (typeof job.failure === 'string' && job.failure.length > 0) {
    return `Rev transcription failed: ${job.failure}`
  }

  return 'Rev transcription failed: job entered failed state'
}

const getTranscript = async (
  baseURL: string,
  accessToken: string,
  jobId: string,
  metrics?: {
    onRequest?: (() => void) | undefined
    onRetry?: ((status: number | undefined) => void) | undefined
  } | undefined
): Promise<RevTranscriptResponse> => {
  let rawPayload: unknown
  try {
    rawPayload = await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'rev-get-transcript',
        policy: { maxAttempts: 6 },
        timeoutMs: POLL_REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        metrics?.onRequest?.()
        const response = await fetch(buildRevUrl(baseURL, `/jobs/${jobId}/transcript`), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.rev.transcript.v1.0+json'
          },
          signal: signal ?? null
        })

        if (!response.ok) {
          throw toRevHttpError('transcript', 'runtime_http_read', response, await response.text())
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
    attachAsyncSttErrorContext<RevHttpError>(error, 'transcript', 'runtime_http_read')
  }

  try {
    return validateData(RevTranscriptResponseSchema, rawPayload, 'Rev transcript response')
  } catch (error) {
    return attachAsyncSttValidationContext<RevHttpError>(error, 'transcript', 'runtime_http_read', rawPayload)
  }
}

const deleteJob = async (
  baseURL: string,
  accessToken: string,
  jobId: string
): Promise<boolean> => {
  try {
    const response = await fetch(buildRevUrl(baseURL, `/jobs/${jobId}`), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })

    if (!response.ok && response.status !== 404) {
      logSttCleanupFailure(l, {
        provider: 'rev',
        artifact: 'job',
        id: jobId,
        detail: String(response.status)
      })
      return false
    }

    return true
  } catch (error) {
    logSttCleanupFailure(l, {
      provider: 'rev',
      artifact: 'job',
      id: jobId,
      detail: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}

const normalizeTranscriptOutput = (
  transcript: RevTranscriptResponse,
  offsetSeconds: number
): { text: string, segments: TranscriptionSegment[] } => {
  const segments: TranscriptionSegment[] = []
  const texts: string[] = []

  for (const monologue of transcript.monologues) {
    let currentText = ''
    let segmentStart: number | null = null
    let segmentEnd: number | null = null

    for (const element of monologue.elements) {
      if (element.type !== 'text' && element.type !== 'punct') {
        continue
      }

      currentText += element.value

      if (segmentStart === null && typeof element.ts === 'number') {
        segmentStart = element.ts
      }
      if (typeof element.end_ts === 'number') {
        segmentEnd = element.end_ts
      }
    }

    const text = currentText.replace(/\s+/g, ' ').trim()
    if (text.length === 0) {
      continue
    }

    texts.push(text)

    const start = segmentStart ?? segmentEnd ?? 0
    const end = segmentEnd ?? segmentStart ?? start
    const speaker = formatSpeakerLabel(monologue.speaker)
    segments.push({
      start: toTimestamp(start + offsetSeconds),
      end: toTimestamp(end + offsetSeconds),
      text,
      ...(speaker ? { speaker } : {})
    })
  }

  return {
    text: texts.join(' ').trim(),
    segments
  }
}

const evidenceWordsFromTranscript = (
  transcript: RevTranscriptResponse,
  offsetSeconds: number
) => transcript.monologues
  .flatMap((monologue) => monologue.elements.map((element) => {
    if ((element.type !== 'text' && element.type !== 'punct') || typeof element.ts !== 'number' || typeof element.end_ts !== 'number') {
      return null
    }

    const text = element.value.trim()
    if (text.length === 0) {
      return null
    }

    return {
      startSeconds: element.ts + offsetSeconds,
      endSeconds: element.end_ts + offsetSeconds,
      text,
      normalized: text.toLowerCase(),
      ...(formatSpeakerLabel(monologue.speaker) ? { speaker: formatSpeakerLabel(monologue.speaker) } : {}),
      ...(typeof element.confidence === 'number' ? { confidence: element.confidence } : {}),
      timingSource: 'native' as const
    }
  }))
  .filter((word): word is NonNullable<typeof word> => word !== null)

const createRevJob = async (
  baseURL: string,
  accessToken: string,
  audioPath: string,
  modelName: string,
  metrics: AsyncSttLifecycleMetrics
): Promise<{ jobId: string, status: RevJob }> => {
  let rawPayload: unknown
  try {
    rawPayload = await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'rev-create-job',
        policy: { maxAttempts: 4 },
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        metrics.requestCount += 1
        const response = await fetch(buildRevUrl(baseURL, '/jobs'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          body: buildCreateForm(audioPath, modelName),
          signal: signal ?? null
        })

        if (!response.ok) {
          throw toRevHttpError('create', 'runtime_http_create_conservative', response, await response.text())
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
    return attachAsyncSttErrorContext<RevHttpError>(error, 'create', 'runtime_http_create_conservative')
  }

  try {
    const createResponse = validateData(RevJobSchema, rawPayload, 'Rev create job response')
    return { jobId: createResponse.id, status: createResponse }
  } catch (error) {
    return attachAsyncSttValidationContext<RevHttpError>(error, 'create', 'runtime_http_create_conservative', rawPayload)
  }
}

const pollRevJob = async (
  baseURL: string,
  accessToken: string,
  jobId: string,
  metrics: AsyncSttLifecycleMetrics
): Promise<{ status: RevJob, retryAfterMs: number | null }> => {
  let result!: { payload: unknown, retryAfterMs: number | null }
  try {
    result = await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'rev-poll-job',
        policy: { maxAttempts: 6 },
        timeoutMs: POLL_REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        metrics.requestCount += 1
        const response = await fetch(buildRevUrl(baseURL, `/jobs/${jobId}`), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          signal: signal ?? null
        })

        if (!response.ok) {
          throw toRevHttpError('poll', 'runtime_http_read', response, await response.text())
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
    return attachAsyncSttErrorContext<RevHttpError>(error, 'poll', 'runtime_http_read')
  }

  try {
    const statusResponse = validateData(RevJobSchema, result.payload, 'Rev job status response')
    return {
      status: statusResponse,
      retryAfterMs: result.retryAfterMs
    }
  } catch (error) {
    return attachAsyncSttValidationContext<RevHttpError>(error, 'poll', 'runtime_http_read', result.payload)
  }
}

export const runRevStt = async (
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
  const accessToken = readEnv('REVAI_ACCESS_TOKEN')
  if (!accessToken) {
    throw new Error('REVAI_ACCESS_TOKEN environment variable is required for Rev transcription')
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
  const baseURL = getRevBaseUrl()
  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  return await runAsyncSttJobLifecycle<RevJob, RevTranscriptResponse>({
    outputDir,
    providerService: 'rev',
    providerLogLabel: 'rev',
    providerDisplayName: 'Rev',
    modelName,
    startTime,
    runMode,
    lifecycle,
    audioDurationSeconds,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    createJob: async (metrics) => await createRevJob(baseURL, accessToken, audioPath, modelName, metrics),
    pollJob: async (jobId, metrics) => await pollRevJob(baseURL, accessToken, jobId, metrics),
    getTranscript: async (jobId, metrics) => await getTranscript(baseURL, accessToken, jobId, {
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
    isComplete: (status) => status.status === 'transcribed',
    isFailed: (status) => status.status === 'failed' ? buildFailedJobMessage(status) : undefined,
    buildDeadlineError: (jobId, pollDeadlineMs) => buildPollingDeadlineError(jobId, pollDeadlineMs),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs) => buildResumeProbeError(jobId, probeCount, totalWaitMs),
    deleteJob: async (jobId) => await deleteJob(baseURL, accessToken, jobId),
    shouldDeleteRemoteJob: ({ metadata, lastKnownStatus }) =>
      metadata !== undefined || lastKnownStatus?.status === 'transcribed' || lastKnownStatus?.status === 'failed',
    buildResult: async ({ transcript, runtime, processingTime, timings }) => {
      const transcriptOutput = normalizeTranscriptOutput(transcript, offsetSeconds)
      const evidenceWords = evidenceWordsFromTranscript(transcript, offsetSeconds)
      const { finalSegments, finalText } = resolveTranscriptionOutput(
        transcriptOutput.segments,
        transcriptOutput.text,
        offsetSeconds
      )

      await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

      const metadata: Step2Metadata = {
        transcriptionService: 'rev',
        transcriptionModel: modelName,
        processingTime,
        tokenCount: countTokens(finalText),
        runtime,
        ...(timings ? { timings } : {})
      }

      if (segmentNumber && totalSegments) {
        logSttSegmentLifecycle(l, { provider: 'rev', action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
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
