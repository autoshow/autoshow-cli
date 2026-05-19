import { basename } from 'node:path'
import type {
  AsyncSttLifecycleHooks,
  DeapiHttpError,
  RetryClass,
  Step2Metadata,
  Step2RuntimeMetadata,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import * as l from '~/utils/logger'
import { logSttAsyncJobLifecycle, logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText,
  parseSeconds,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import {
  pollAsyncSttJobUntilComplete,
  readPersistedAsyncSttRuntime,
  writeAsyncSttProgressMetadata
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { readSttProviderCheckpoint } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/manifest'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { getDeapiBaseUrl, isDeapiSupportedSourceUrl } from './deapi'
import { logDeapiPricingFallbackWarning, resolveDeapiTranscriptionPrice } from './deapi-pricing'
import type { DeapiStatusPayload } from '~/types'
import {
  attachDeapiErrorContext,
  buildDeapiUrl,
  extractDeapiErrorMessage,
  fetchResultPayload,
  isRecord,
  normalizeParsedResult,
  parseRequestId,
  parseStatusPayload,
  readJsonOrText
} from '~/utils/deapi'
import { parseDeapiTimestampedTranscript } from './deapi-transcript-parser'

const INITIAL_POLL_INTERVAL_MS = 1_000
const MAX_POLL_INTERVAL_MS = 10_000
const REQUEST_TIMEOUT_MS = 70_000
const POLL_REQUEST_TIMEOUT_MS = 60_000

const getErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

const buildPollingDeadlineError = (
  requestId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`deAPI timed out waiting for transcription completion for ${requestId} (deadline exceeded after ${pollDeadlineMs}ms)`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const buildResumeProbeError = (
  requestId: string,
  probeCount: number,
  totalWaitMs: number
): never => {
  const error = Object.assign(
    new Error(`deAPI transcription ${requestId} is still pending after ${probeCount} resume status checks (${totalWaitMs}ms total backoff). Retry the command later.`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const parsePersistedDeapiBilling = (value: unknown): Step2Metadata['billing'] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const billing = isRecord(value['billing']) ? value['billing'] : undefined
  if (!billing) {
    return undefined
  }

  const parsed: NonNullable<Step2Metadata['billing']> = {}
  if (typeof billing['totalCost'] === 'number' && Number.isFinite(billing['totalCost']) && billing['totalCost'] >= 0) {
    parsed.totalCost = billing['totalCost']
  }
  if (billing['source'] === 'provider_quote' || billing['source'] === 'registry_fallback') {
    parsed.source = billing['source']
  }
  if (billing['mode'] === 'url' || billing['mode'] === 'duration' || billing['mode'] === 'segment_sum') {
    parsed.mode = billing['mode']
  }

  return Object.keys(parsed).length > 0 ? parsed : undefined
}

const timestampToSeconds = (timestamp: string): number =>
  timestamp.split(':').reduce<number>((total, part) => (total * 60) + Number.parseInt(part, 10), 0)

const toSegmentText = (value: unknown): string | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  for (const key of ['text', 'transcript', 'content'] as const) {
    const text = value[key]
    if (typeof text === 'string' && text.trim().length > 0) {
      return text.trim()
    }
  }

  return undefined
}

const toSegmentSpeaker = (value: unknown): string | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const speaker = value['speaker']
  if (typeof speaker === 'string' && speaker.trim().length > 0) {
    return speaker.trim()
  }
  if (typeof speaker === 'number' && Number.isFinite(speaker)) {
    return `speaker-${speaker}`
  }

  return undefined
}

const parseStructuredSegments = (
  value: unknown,
  offsetSeconds: number
): TranscriptionSegment[] => {
  const parseEntry = (entry: unknown): TranscriptionSegment | undefined => {
    if (!isRecord(entry)) {
      return undefined
    }

    const start = parseSeconds(entry['start'] ?? entry['start_time'] ?? entry['offset'] ?? entry['from'])
    const end = parseSeconds(entry['end'] ?? entry['end_time'] ?? entry['to'])
      ?? (start !== null ? parseSeconds(entry['duration']) : null)
    const text = toSegmentText(entry)
    if (start === null || end === null || !text) {
      return undefined
    }

    const resolvedEnd = end >= start ? end : start + end
    return {
      start: toTimestamp(start + offsetSeconds),
      end: toTimestamp(resolvedEnd + offsetSeconds),
      text,
      ...(toSegmentSpeaker(entry) ? { speaker: toSegmentSpeaker(entry) } : {})
    }
  }

  const candidateArrays: unknown[] = []
  if (Array.isArray(value)) {
    candidateArrays.push(value)
  }
  if (isRecord(value)) {
    for (const key of ['segments', 'chunks', 'utterances'] as const) {
      if (Array.isArray(value[key])) {
        candidateArrays.push(value[key])
      }
    }
    if (Array.isArray(value['result']) || isRecord(value['result'])) {
      candidateArrays.push(value['result'])
    }
    if (Array.isArray(value['data']) || isRecord(value['data'])) {
      candidateArrays.push(value['data'])
    }
  }

  for (const candidate of candidateArrays) {
    if (Array.isArray(candidate)) {
      const parsed = candidate.map(parseEntry).filter((entry): entry is TranscriptionSegment => entry !== undefined)
      if (parsed.length > 0) {
        return parsed
      }
      continue
    }

    const nestedSegments = parseStructuredSegments(candidate, offsetSeconds)
    if (nestedSegments.length > 0) {
      return nestedSegments
    }
  }

  return []
}

const parseStructuredText = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (!isRecord(value)) {
    return undefined
  }

  for (const key of ['text', 'transcript', 'full_text', 'content'] as const) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  for (const key of ['result', 'data'] as const) {
    const nested = parseStructuredText(value[key])
    if (nested) {
      return nested
    }
  }

  return undefined
}

const resolveResultPayload = async (
  status: DeapiStatusPayload
): Promise<{ payload: unknown, plainTextFallback?: string | undefined, source: 'inline' | 'inline_json_string' | 'result_url' | 'plain_text' }> => {
  const inlineResult = normalizeParsedResult(status.result)
  if (isRecord(inlineResult) || Array.isArray(inlineResult)) {
    return { payload: inlineResult, source: 'inline' }
  }

  if (typeof status.result === 'string') {
    const parsed = normalizeParsedResult(status.result)
    if (isRecord(parsed) || Array.isArray(parsed)) {
      return { payload: parsed, source: 'inline_json_string' }
    }
  }

  if (status.resultUrl) {
    const payload = await fetchResultPayload(status.resultUrl)
    return { payload, source: 'result_url' }
  }

  if (typeof status.result === 'string') {
    const plainText = status.result.trim()
    if (plainText.length > 0) {
      return { payload: plainText, plainTextFallback: plainText, source: 'plain_text' }
    }
  }

  const fallbackText = parseStructuredText(status.raw)
  if (fallbackText) {
    return { payload: fallbackText, plainTextFallback: fallbackText, source: 'plain_text' }
  }

  throw new Error('deAPI completed without an inline result or result_url')
}

export const runDeapiStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    sourceUrl?: string | undefined
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
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options
  const apiKey = readEnv('DEAPI_API_KEY')
  if (!apiKey) {
    throw new Error('DEAPI_API_KEY environment variable is required for deAPI transcription')
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'deapi', action: 'started', segmentNumber, totalSegments, model: modelName })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const baseURL = getDeapiBaseUrl()
  const authHeaders = {
    accept: 'application/json',
    authorization: `Bearer ${apiKey}`
  }
  const passthroughMode = segmentNumber === undefined && isDeapiSupportedSourceUrl(sourceUrl)
  let uploadMs = 0
  let createMs = 0
  let pollMs = 0
  let pollSleepMs = 0
  let createCount = 0
  let pollCount = 0
  let requestCount = 0
  let retryCount = 0
  let rateLimitCount = 0
  const backfillCount = runMode === 'backfill' ? 1 : 0

  const checkpointMetadata = await readSttProviderCheckpoint(outputDir)
  const persistedBilling = checkpointMetadata
    && checkpointMetadata['transcriptionService'] === 'deapi'
    && checkpointMetadata['transcriptionModel'] === modelName
      ? parsePersistedDeapiBilling(checkpointMetadata)
      : undefined

  let billing = persistedBilling
  let runtime = await readPersistedAsyncSttRuntime(outputDir, {
    transcriptionService: 'deapi',
    transcriptionModel: modelName
  })
  let requestId = runtime?.remoteJobId
  let resumedExistingJob = false
  let jobReadyNotified = false

  const buildProgressMetadata = (nextRuntime: Step2RuntimeMetadata): Step2Metadata => ({
    transcriptionService: 'deapi',
    transcriptionModel: modelName,
    processingTime: Date.now() - startTime,
    tokenCount: 0,
    ...(billing ? { billing } : {}),
    timings: {
      ...(uploadMs > 0 ? { uploadMs } : {}),
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

  if (runtime && (runtime.stage === 'created' || runtime.stage === 'polling')) {
    resumedExistingJob = true
    runtime = {
      ...runtime,
      mode: 'resumed',
      stage: 'polling'
    }
    requestId = runtime.remoteJobId
    await persistProgressMetadata(runtime)
    await notifyJobReady(runtime)
  } else {
    const resolvedPrice = await resolveDeapiTranscriptionPrice({
      model: modelName,
      ...(passthroughMode ? { sourceUrl } : {}),
      durationSeconds: audioDurationSeconds
    })
    logDeapiPricingFallbackWarning(resolvedPrice.warning)
    billing = {
      totalCost: resolvedPrice.totalCost,
      source: resolvedPrice.source,
      mode: resolvedPrice.mode
    }

    let createPayload: unknown
    const endpoint = passthroughMode ? '/api/v1/client/transcribe' : '/api/v1/client/audiofile2txt'
    const form = new FormData()
    form.append('include_ts', 'true')
    form.append('model', modelName)
    form.append('return_result_in_response', 'true')
    if (passthroughMode) {
      form.append('source_url', sourceUrl as string)
    } else {
      form.append('audio', Bun.file(audioPath), basename(audioPath))
    }

    try {
      const createStartedAt = Date.now()
      createPayload = await withRetry(
        {
          retryClass: 'runtime_http_create_conservative',
          operationName: passthroughMode ? 'deapi-create-url-transcription' : 'deapi-upload-audio-transcription',
          policy: { maxAttempts: 4 },
          timeoutMs: REQUEST_TIMEOUT_MS
        },
        async (signal) => {
          requestCount += 1
          const response = await fetch(buildDeapiUrl(baseURL, endpoint), {
            method: 'POST',
            headers: authHeaders,
            body: form,
            signal: signal ?? null
          })

          const payload = await readJsonOrText(response)
          if (!response.ok) {
            throw Object.assign(
              new Error(`deAPI transcription request failed (${response.status}): ${extractDeapiErrorMessage(payload) ?? 'Unknown error'}`),
              {
                status: response.status,
                headers: response.headers,
                stage: 'create',
                retryClass: 'runtime_http_create_conservative',
                rawResponse: payload
              } satisfies Pick<DeapiHttpError, 'status' | 'headers' | 'stage' | 'retryClass' | 'rawResponse'>
            )
          }

          return payload
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
      if (passthroughMode) {
        createMs += Date.now() - createStartedAt
      } else {
        uploadMs += Date.now() - createStartedAt
      }
      createCount += 1
    } catch (error) {
      attachDeapiErrorContext(error, 'create', 'runtime_http_create_conservative')
    }

    const parsedRequestId = parseRequestId(createPayload)
    if (!parsedRequestId) {
      attachDeapiErrorContext(
        Object.assign(new Error('deAPI transcription request did not return request_id'), {
          rawResponse: createPayload
        }),
        'create',
        'runtime_http_create_conservative',
        createPayload
      )
      throw new Error('Unreachable deAPI request-id state')
    }
    const createdRequestId: string = parsedRequestId
    requestId = createdRequestId

    const createdRuntime: Step2RuntimeMetadata = {
      mode: 'fresh',
      stage: 'polling',
      remoteJobId: createdRequestId,
      createCompletedAt: new Date().toISOString()
    }
    await persistProgressMetadata(createdRuntime)
    await notifyJobReady(createdRuntime)
  }

  if (!requestId) {
    throw new Error('deAPI transcription request did not produce a request id')
  }
  const activeRequestId = requestId

  logSttAsyncJobLifecycle(l, {
    provider: `deapi/${modelName}`,
    action: resumedExistingJob ? 'resumed' : 'created',
    remoteId: activeRequestId,
    state: 'polling'
  })

  const pollResult = await pollAsyncSttJobUntilComplete<DeapiStatusPayload>({
    jobId: activeRequestId,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    audioDurationSeconds,
    envSpecificDeadlineKey: 'AUTOSHOW_STT_POLL_DEADLINE_MS_DEAPI',
    pollMode: resumedExistingJob ? 'resume-probe' : 'fresh',
    buildDeadlineError: (jobId, pollDeadlineMs) => buildPollingDeadlineError(jobId, pollDeadlineMs),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs) => buildResumeProbeError(jobId, probeCount, totalWaitMs),
    poll: async (): Promise<{ status: DeapiStatusPayload, retryAfterMs: number | null }> => {
      let result!: { payload: unknown, retryAfterMs: number | null }
      try {
        const pollStartedAt = Date.now()
        result = await withRetry(
          {
            retryClass: 'runtime_http_read',
            operationName: 'deapi-poll-transcription',
            policy: { maxAttempts: 6 },
            timeoutMs: POLL_REQUEST_TIMEOUT_MS
          },
          async (signal) => {
            requestCount += 1
            const response = await fetch(buildDeapiUrl(baseURL, `/api/v1/client/request-status/${activeRequestId}`), {
              method: 'GET',
              headers: authHeaders,
              signal: signal ?? null
            })

            const payload = await readJsonOrText(response)
            if (!response.ok) {
              throw Object.assign(
                new Error(`deAPI polling failed (${response.status}): ${extractDeapiErrorMessage(payload) ?? 'Unknown error'}`),
                {
                  status: response.status,
                  headers: response.headers,
                  stage: 'poll',
                  retryClass: 'runtime_http_read',
                  rawResponse: payload
                } satisfies Pick<DeapiHttpError, 'status' | 'headers' | 'stage' | 'retryClass' | 'rawResponse'>
              )
            }

            return {
              payload,
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
        attachDeapiErrorContext(error, 'poll', 'runtime_http_read')
      }

      const maybeStatus = parseStatusPayload(result.payload)
      if (!maybeStatus) {
        attachDeapiErrorContext(
          new Error('Invalid deAPI status payload'),
          'poll',
          'runtime_http_read',
          result.payload
        )
        throw new Error('Unreachable deAPI status parsing state')
      }
      const status: DeapiStatusPayload = maybeStatus

      return {
        status,
        retryAfterMs: result.retryAfterMs
      }
    },
    isComplete: (status) => ['done', 'completed', 'success', 'succeeded'].includes(status.status.toLowerCase()),
    isFailed: (status) => {
      const normalized = status.status.toLowerCase()
      if (normalized === 'error' || normalized === 'failed' || normalized === 'canceled' || normalized === 'cancelled') {
        return `deAPI transcription failed: ${extractDeapiErrorMessage(status.raw) ?? 'unknown error'}`
      }
      return undefined
    },
    onProgress: async () => {
      await persistProgressMetadata({
        ...(runtime ?? {
          mode: 'fresh',
          stage: 'polling',
          remoteJobId: activeRequestId
        }),
        mode: runtime?.mode ?? 'fresh',
        stage: 'polling',
        remoteJobId: activeRequestId,
        ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
        lastPollAt: new Date().toISOString()
      })
    },
    withPollSlot: lifecycle?.withPollSlot
  })

  pollSleepMs += pollResult.pollSleepMs
  pollCount += pollResult.pollCount
  const completedStatus: DeapiStatusPayload = pollResult.status

  const completedRuntime: Step2RuntimeMetadata = {
    ...(runtime ?? {
      mode: 'fresh',
      stage: 'completed',
        remoteJobId: activeRequestId
      }),
      mode: runtime?.mode ?? 'fresh',
      stage: 'completed',
      remoteJobId: activeRequestId,
      ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
    ...(runtime?.lastPollAt ? { lastPollAt: runtime.lastPollAt } : {}),
    completedAt: new Date().toISOString()
  }
  await persistProgressMetadata(completedRuntime)
  runtime = completedRuntime

  let resolvedResultPayload: Awaited<ReturnType<typeof resolveResultPayload>> | undefined
  try {
    resolvedResultPayload = await resolveResultPayload(completedStatus)
  } catch (error) {
    attachDeapiErrorContext(error, 'result', 'runtime_http_read', completedStatus.raw)
  }
  if (!resolvedResultPayload) {
    throw new Error('deAPI result resolution failed without throwing an error')
  }

  const payload = resolvedResultPayload.payload
  const structuredSegments = typeof payload === 'string'
    ? []
    : parseStructuredSegments(payload, offsetSeconds)
  const rawText = typeof payload === 'string'
    ? payload.trim()
    : parseStructuredText(payload) ?? resolvedResultPayload.plainTextFallback ?? ''
  const parsedPlainText = parseDeapiTimestampedTranscript(rawText, {
    offsetSeconds,
    audioDurationSeconds
  })
  const segments = structuredSegments.length > 0 ? structuredSegments : parsedPlainText.segments
  const text = parsedPlainText.markerCount > 0 ? parsedPlainText.text : rawText
  const { finalSegments, finalText } = resolveTranscriptionOutput(segments, text, offsetSeconds)

  await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

  const processingTime = Date.now() - startTime
  const remoteProcessingMs = Math.max(0, processingTime - uploadMs - createMs - pollMs)
  const metadata: Step2Metadata = {
    transcriptionService: 'deapi',
    transcriptionModel: modelName,
    processingTime,
    tokenCount: countTokens(finalText),
    runtime: completedRuntime,
    ...(billing ? { billing } : {}),
    ...((uploadMs > 0 || createMs > 0 || pollMs > 0 || pollSleepMs > 0 || remoteProcessingMs > 0 || requestCount > 0 || retryCount > 0 || rateLimitCount > 0)
      ? {
          timings: {
            ...(uploadMs > 0 ? { uploadMs } : {}),
            ...(createMs > 0 ? { createMs } : {}),
            ...(createCount > 0 ? { createCount } : {}),
            ...(pollMs > 0 ? { pollMs } : {}),
            ...(pollSleepMs > 0 ? { pollSleepMs } : {}),
            ...(pollCount > 0 ? { pollCount } : {}),
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
    logSttSegmentLifecycle(l, { provider: 'deapi', action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
  }

  return {
    result: {
      text: finalText,
      segments: finalSegments,
      evidence: {
        segments: finalSegments.map((segment) => ({
          startSeconds: timestampToSeconds(segment.start),
          endSeconds: timestampToSeconds(segment.end),
          text: segment.text,
          ...(segment.speaker ? { speaker: segment.speaker } : {})
        })),
        capabilities: {
          hasNativeWordTiming: false,
          hasConfidence: false,
          hasSpeakerLabels: finalSegments.some((segment) => segment.speaker !== undefined)
        },
        timingQuality: segments.length > 0 ? 'segment_interpolated' : 'coarse',
        rawResponse: completedStatus.raw
      }
    },
    metadata
  }
}
