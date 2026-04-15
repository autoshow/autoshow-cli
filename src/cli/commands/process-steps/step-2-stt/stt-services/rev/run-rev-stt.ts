import { basename } from 'node:path'
import type {
  DiarizationOptions,
  RetryClass,
  RevJob,
  RevTranscriptResponse,
  Step2Metadata,
  Step2RuntimeMetadata,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import {
  RevJobSchema,
  RevTranscriptResponseSchema
} from '~/types'
import * as l from '~/logger'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatSpeakerLabel,
  formatTranscriptText,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import {
  pollAsyncSttJobUntilComplete,
  readPersistedAsyncSttRuntime,
  writeAsyncSttProgressMetadata,
  type AsyncSttLifecycleHooks
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/async-stt-job-runner'
import { getRevBaseUrl } from './rev'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { readEnvFallback } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const INITIAL_POLL_INTERVAL_MS = 2000
const MAX_POLL_INTERVAL_MS = 10000
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

type RevHttpError = Error & {
  status: number
  headers: Headers
  stage?: 'create' | 'poll' | 'transcript'
  retryClass?: RetryClass
  rawResponse?: unknown
}

const buildRevUrl = (baseURL: string, path: string): string =>
  new URL(path.replace(/^\/+/, ''), baseURL.endsWith('/') ? baseURL : `${baseURL}/`).toString()

const getErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

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

const attachRevErrorContext = (
  error: unknown,
  stage: 'create' | 'poll' | 'transcript',
  retryClass: RetryClass
): never => {
  if (error instanceof Error && error.cause instanceof Error) {
    ;(error.cause as RevHttpError).stage = stage
    ;(error.cause as RevHttpError).retryClass = retryClass
    throw error.cause
  }

  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as RevHttpError).stage = stage
  ;(source as RevHttpError).retryClass = retryClass
  throw source
}

const attachRevValidationContext = (
  error: unknown,
  stage: 'create' | 'poll' | 'transcript',
  retryClass: RetryClass,
  rawResponse: unknown
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as RevHttpError).stage = stage
  ;(source as RevHttpError).retryClass = retryClass
  ;(source as RevHttpError).rawResponse = rawResponse
  throw source
}

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
          metrics?.onRetry?.(getErrorStatus(error))
        }
        return decision
      }
    )
  } catch (error) {
    attachRevErrorContext(error, 'transcript', 'runtime_http_read')
  }

  try {
    return validateData(RevTranscriptResponseSchema, rawPayload, 'Rev transcript response')
  } catch (error) {
    return attachRevValidationContext(error, 'transcript', 'runtime_http_read', rawPayload)
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
      l.warn(`Rev cleanup failed for job ${jobId} (${response.status})`)
      return false
    }

    return true
  } catch (error) {
    l.warn(`Rev cleanup failed for job ${jobId}: ${error instanceof Error ? error.message : String(error)}`)
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
  const accessToken = readEnvFallback('REVAI_ACCESS_TOKEN')
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
    transcriptionService: 'rev',
    transcriptionModel: modelName
  })
  let jobId = runtime?.remoteJobId
  let lastKnownJobStatus: RevJob | undefined
  let resumedExistingJob = false
  let jobReadyNotified = false
  let metadata: Step2Metadata | undefined

  const buildProgressMetadata = (nextRuntime: Step2RuntimeMetadata): Step2Metadata => ({
    transcriptionService: 'rev',
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
            operationName: 'rev-create-job',
            policy: { maxAttempts: 4 },
            timeoutMs: REQUEST_TIMEOUT_MS
          },
          async (signal) => {
            requestCount += 1
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
        attachRevErrorContext(error, 'create', 'runtime_http_create_conservative')
      }

      let createResponse!: RevJob
      try {
        createResponse = validateData(RevJobSchema, rawPayload, 'Rev create job response')
      } catch (error) {
        attachRevValidationContext(error, 'create', 'runtime_http_create_conservative', rawPayload)
      }

      jobId = createResponse.id
      lastKnownJobStatus = createResponse
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
      throw new Error('Rev job creation did not produce a job id')
    }

    const activeJobId = jobId
    l.info(`${resumedExistingJob ? 'Rev job resumed' : 'Rev job created'}: ${activeJobId}, polling for completion...`)

    const pollResult = await pollAsyncSttJobUntilComplete({
      jobId: activeJobId,
      initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
      maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
      audioDurationSeconds,
      envSpecificDeadlineKey: 'AUTOSHOW_STT_POLL_DEADLINE_MS_REV',
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
              operationName: 'rev-poll-job',
              policy: { maxAttempts: 6 },
              timeoutMs: POLL_REQUEST_TIMEOUT_MS
            },
            async (signal) => {
              requestCount += 1
              const response = await fetch(buildRevUrl(baseURL, `/jobs/${activeJobId}`), {
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
          attachRevErrorContext(error, 'poll', 'runtime_http_read')
        }

        let statusResponse!: RevJob
        try {
          statusResponse = validateData(RevJobSchema, result.payload, 'Rev job status response')
        } catch (error) {
          attachRevValidationContext(error, 'poll', 'runtime_http_read', result.payload)
        }

        return {
          status: statusResponse,
          retryAfterMs: result.retryAfterMs
        }
      },
      isComplete: (status) => status.status === 'transcribed',
      isFailed: (status) => status.status === 'failed' ? buildFailedJobMessage(status) : undefined,
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

    let transcript!: RevTranscriptResponse
    try {
      const transcriptStartedAt = Date.now()
      transcript = await getTranscript(baseURL, accessToken, activeJobId, {
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
      attachRevErrorContext(error, 'transcript', 'runtime_http_read')
    }

    const transcriptOutput = normalizeTranscriptOutput(transcript, offsetSeconds)
    const { finalSegments, finalText } = resolveTranscriptionOutput(
      transcriptOutput.segments,
      transcriptOutput.text,
      offsetSeconds
    )

    await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

    const processingTime = Date.now() - startTime
    const remoteProcessingMs = Math.max(0, processingTime - createMs - pollMs - transcriptMs)
    metadata = {
      transcriptionService: 'rev',
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
        segments: finalSegments
      },
      metadata
    }
  } finally {
    const cleanupStartedAt = Date.now()
    const shouldDeleteRemoteJob = jobId !== undefined
      && (metadata !== undefined || lastKnownJobStatus?.status === 'transcribed' || lastKnownJobStatus?.status === 'failed')
    const remoteJobDeleted = shouldDeleteRemoteJob && jobId ? await deleteJob(baseURL, accessToken, jobId) : false
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
