import type {
  AsyncSttLifecycleHooks,
  RetryClass,
  Step2Metadata,
  Step2RuntimeMetadata,
  SupadataHttpError,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import * as l from '~/logger'
import {
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
} from '~/cli/commands/process-steps/step-2-stt/async-lifecycle'
import { readSttProviderCheckpoint } from '~/cli/commands/process-steps/step-2-stt/manifest'
import { describeSupadataUnsupportedSource, getSupadataBaseUrl, isSupadataSupportedSourceUrl } from './supadata'
import { readEnv } from '~/utils/validate/env-utils'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { getSupadataCreditRateCents } from '~/utils/pricing/supadata-pricing'

const INITIAL_POLL_INTERVAL_MS = 1_000
const MAX_POLL_INTERVAL_MS = 10_000
const REQUEST_TIMEOUT_MS = 70_000
const POLL_REQUEST_TIMEOUT_MS = 60_000

type SupadataChunk = {
  text: string
  offset: number
  duration: number
  lang?: string | undefined
}

type SupadataTranscriptPayload = {
  content: string | SupadataChunk[]
  lang?: string | undefined
  availableLangs?: string[] | undefined
}

type SupadataJobPayload = {
  jobId: string
}

type SupadataJobStatus = {
  status: 'queued' | 'active' | 'completed' | 'failed'
  content?: string | SupadataChunk[] | undefined
  lang?: string | undefined
  availableLangs?: string[] | undefined
  error?: unknown
  message?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSupadataChunk = (value: unknown): value is SupadataChunk =>
  isRecord(value)
  && typeof value['text'] === 'string'
  && typeof value['offset'] === 'number'
  && Number.isFinite(value['offset'])
  && typeof value['duration'] === 'number'
  && Number.isFinite(value['duration'])
  && (value['lang'] === undefined || typeof value['lang'] === 'string')

const parseSupadataTranscriptPayload = (
  value: unknown
): SupadataTranscriptPayload | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const content = value['content']
  if (
    typeof content !== 'string'
    && !(Array.isArray(content) && content.every(isSupadataChunk))
  ) {
    return undefined
  }

  return {
    content,
    ...(typeof value['lang'] === 'string' ? { lang: value['lang'] } : {}),
    ...(Array.isArray(value['availableLangs']) && value['availableLangs'].every((entry) => typeof entry === 'string')
      ? { availableLangs: value['availableLangs'] as string[] }
      : {})
  }
}

const parseSupadataJobPayload = (
  value: unknown
): SupadataJobPayload | undefined =>
  isRecord(value) && typeof value['jobId'] === 'string'
    ? { jobId: value['jobId'] }
    : undefined

const parseSupadataJobStatus = (
  value: unknown
): SupadataJobStatus | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const status = value['status']
  if (status !== 'queued' && status !== 'active' && status !== 'completed' && status !== 'failed') {
    return undefined
  }

  const parsed: SupadataJobStatus = { status }
  if (value['content'] !== undefined) {
    if (
      typeof value['content'] !== 'string'
      && !(Array.isArray(value['content']) && value['content'].every(isSupadataChunk))
    ) {
      return undefined
    }
    parsed.content = value['content']
  }
  if (typeof value['lang'] === 'string') {
    parsed.lang = value['lang']
  }
  if (Array.isArray(value['availableLangs']) && value['availableLangs'].every((entry) => typeof entry === 'string')) {
    parsed.availableLangs = value['availableLangs'] as string[]
  }
  if ('error' in value) {
    parsed.error = value['error']
  }
  if ('message' in value) {
    parsed.message = value['message']
  }

  return parsed
}

const buildSupadataUrl = (baseURL: string, path: string): string =>
  new URL(path.replace(/^\/+/, ''), baseURL.endsWith('/') ? baseURL : `${baseURL}/`).toString()

const parseSupadataBillableRequests = (headers: Headers): number | undefined => {
  const raw = headers.get('x-billable-requests')
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined
  }

  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

const parsePersistedSupadataBilling = (value: unknown): Step2Metadata['billing'] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const billing = isRecord(value['billing']) ? value['billing'] : undefined
  if (!billing) {
    return undefined
  }

  const parsed: NonNullable<Step2Metadata['billing']> = {}
  if (typeof billing['creditsUsed'] === 'number' && Number.isFinite(billing['creditsUsed']) && billing['creditsUsed'] >= 0) {
    parsed.creditsUsed = billing['creditsUsed']
  }
  if (typeof billing['creditRateCents'] === 'number' && Number.isFinite(billing['creditRateCents']) && billing['creditRateCents'] >= 0) {
    parsed.creditRateCents = billing['creditRateCents']
  }
  if (billing['source'] === 'response-header' || billing['source'] === 'fallback-estimate') {
    parsed.source = billing['source']
  }

  return Object.keys(parsed).length > 0 ? parsed : undefined
}

const extractSupadataErrorMessage = (payload: unknown): string | undefined => {
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (!isRecord(payload)) {
    return undefined
  }

  const directMessage = typeof payload['message'] === 'string'
    ? payload['message']
    : typeof payload['error'] === 'string'
      ? payload['error']
      : undefined
  if (directMessage && directMessage.trim().length > 0) {
    return directMessage.trim()
  }

  if (isRecord(payload['error']) && typeof payload['error']['message'] === 'string') {
    return payload['error']['message']
  }

  return undefined
}

const readJsonOrText = async (response: Response): Promise<unknown> => {
  const rawText = await response.text()
  if (rawText.length === 0) {
    return {}
  }

  try {
    return JSON.parse(rawText) as unknown
  } catch {
    return rawText
  }
}

const toSupadataHttpError = (
  stage: 'create' | 'poll',
  retryClass: RetryClass,
  response: Response,
  payload: unknown,
  messagePrefix = 'Supadata request failed'
): SupadataHttpError => Object.assign(
  new Error(`${messagePrefix} (${response.status}): ${extractSupadataErrorMessage(payload) ?? 'Unknown error'}`),
  {
    status: response.status,
    headers: response.headers,
    stage,
    retryClass,
    rawResponse: payload
  } satisfies Pick<SupadataHttpError, 'status' | 'headers' | 'stage' | 'retryClass' | 'rawResponse'>
)

const attachSupadataErrorContext = (
  error: unknown,
  stage: 'create' | 'poll',
  retryClass: RetryClass,
  rawResponse?: unknown
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as SupadataHttpError).stage = stage
  ;(source as SupadataHttpError).retryClass = retryClass
  if (rawResponse !== undefined) {
    ;(source as SupadataHttpError).rawResponse = rawResponse
  }
  throw source
}

const buildSupadataUnsupportedSourceError = (
  sourceUrl: string | undefined
): SupadataHttpError => Object.assign(
  new Error(describeSupadataUnsupportedSource(sourceUrl)),
  {
    stage: 'create' as const,
    retryable: false,
    skipped: true
  }
)

const buildPollingDeadlineError = (
  jobId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`Supadata timed out waiting for transcription completion for ${jobId} (deadline exceeded after ${pollDeadlineMs}ms)`),
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
    new Error(`Supadata transcript job ${jobId} is still pending after ${probeCount} resume status checks (${totalWaitMs}ms total backoff). Retry the command later.`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const buildSegmentsFromChunks = (
  chunks: readonly SupadataChunk[],
  offsetSeconds: number
): TranscriptionSegment[] =>
  chunks.map((chunk) => ({
    start: toTimestamp((chunk.offset / 1_000) + offsetSeconds),
    end: toTimestamp(((chunk.offset + chunk.duration) / 1_000) + offsetSeconds),
    text: chunk.text
  }))

const buildEvidenceSegments = (
  chunks: readonly SupadataChunk[],
  offsetSeconds: number
): NonNullable<TranscriptionResult['evidence']>['segments'] =>
  chunks.map((chunk) => ({
    startSeconds: Math.max(0, offsetSeconds + (chunk.offset / 1_000)),
    endSeconds: Math.max(0, offsetSeconds + ((chunk.offset + chunk.duration) / 1_000)),
    text: chunk.text
  }))

const normalizeSupadataTranscript = (
  payload: SupadataTranscriptPayload,
  offsetSeconds: number
): TranscriptionResult => {
  const chunks = Array.isArray(payload.content) ? payload.content : []
  const text = typeof payload.content === 'string'
    ? payload.content.trim()
    : chunks.map((chunk) => chunk.text.trim()).filter((chunkText) => chunkText.length > 0).join(' ').trim()
  const { finalSegments, finalText } = resolveTranscriptionOutput(
    buildSegmentsFromChunks(chunks, offsetSeconds),
    text,
    offsetSeconds
  )

  return {
    text: finalText,
    segments: finalSegments,
    evidence: {
      ...(chunks.length > 0 ? { segments: buildEvidenceSegments(chunks, offsetSeconds) } : {}),
      capabilities: {
        hasNativeWordTiming: false,
        hasConfidence: false,
        hasSpeakerLabels: false
      },
      timingQuality: 'coarse',
      rawResponse: payload
    }
  }
}

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
    l.info(`Transcribing segment ${segmentNumber}/${totalSegments} with Supadata mode: ${modelName}`)
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

  const buildTranscriptRequestUrl = (path: string): string => {
    const url = new URL(path.replace(/^\/+/, ''), baseURL.endsWith('/') ? baseURL : `${baseURL}/`)
    return url.toString()
  }

  const fetchTranscript = async (): Promise<{ status: number, headers: Headers, payload: unknown }> =>
    await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'supadata-create-transcript',
        policy: { maxAttempts: 3 },
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        requestCount += 1
        const requestUrl = new URL(buildTranscriptRequestUrl('/transcript'))
        requestUrl.searchParams.set('url', sourceUrl)
        requestUrl.searchParams.set('text', 'false')
        requestUrl.searchParams.set('mode', modelName)
        if (modelName !== 'generate' && typeof language === 'string' && language.trim().length > 0) {
          requestUrl.searchParams.set('lang', language.trim())
        }

        const response = await fetch(requestUrl, {
          method: 'GET',
          headers: {
            'x-api-key': apiKey
          },
          signal: signal ?? null
        })
        const payload = await readJsonOrText(response)

        if (response.status === 206) {
          throw Object.assign(
            new Error(`Supadata transcript unavailable (${response.status}): ${extractSupadataErrorMessage(payload) ?? 'Transcript unavailable'}`),
            {
              status: response.status,
              headers: response.headers,
              stage: 'create',
              retryClass: 'runtime_http_create_conservative',
              retryable: false,
              rawResponse: payload
            } satisfies Pick<SupadataHttpError, 'status' | 'headers' | 'stage' | 'retryClass' | 'retryable' | 'rawResponse'>
          )
        }

        if (!response.ok && response.status !== 202) {
          throw toSupadataHttpError('create', 'runtime_http_create_conservative', response, payload)
        }

        return {
          status: response.status,
          headers: response.headers,
          payload
        }
      },
      (error) => {
        const decision = classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
        if (decision.shouldRetry) {
          retryCount += 1
          if ((error as { status?: unknown }).status === 429) {
            rateLimitCount += 1
          }
        }
        return decision
      }
    )

  const pollTranscriptJob = async (
    currentJobId: string
  ): Promise<{ status: SupadataJobStatus, retryAfterMs: number | null }> =>
    await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'supadata-poll-transcript',
        policy: { maxAttempts: 4 },
        timeoutMs: POLL_REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        requestCount += 1
        const response = await fetch(buildSupadataUrl(baseURL, `/transcript/${currentJobId}`), {
          method: 'GET',
          headers: {
            'x-api-key': apiKey
          },
          signal: signal ?? null
        })
        const payload = await readJsonOrText(response)
        if (!response.ok) {
          throw toSupadataHttpError('poll', 'runtime_http_read', response, payload, 'Supadata polling failed')
        }

        const parsed = parseSupadataJobStatus(payload)
        if (!parsed) {
          throw Object.assign(new Error('Supadata returned an invalid job status payload'), {
            stage: 'poll',
            retryClass: 'runtime_http_read' as RetryClass,
            rawResponse: payload
          })
        }

        return {
          status: parsed,
          retryAfterMs: parseRetryAfterMs(response.headers) ?? null
        }
      },
      (error) => {
        const decision = classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
        if (decision.shouldRetry) {
          retryCount += 1
          if ((error as { status?: unknown }).status === 429) {
            rateLimitCount += 1
          }
        }
        return decision
      }
    )

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
  } else {
    let createResult: Awaited<ReturnType<typeof fetchTranscript>> | undefined
    try {
      const createStartedAt = Date.now()
      createResult = await fetchTranscript()
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
          retryClass: 'runtime_http_create_conservative' as RetryClass,
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
    } else {
      captureCreateBilling(createResult.headers)
      const transcriptPayload = parseSupadataTranscriptPayload(createResult.payload)
      if (!transcriptPayload) {
        throw Object.assign(new Error('Supadata returned an invalid transcript payload'), {
          stage: 'create',
          retryClass: 'runtime_http_create_conservative' as RetryClass,
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
        envSpecificDeadlineKey: 'AUTOSHOW_SUPADATA_STT_POLL_DEADLINE_MS',
        pollMode,
        poll: async () => await pollTranscriptJob(jobId),
        isComplete: (status) => status.status === 'completed',
        isFailed: (status) => {
          if (status.status !== 'failed') {
            return undefined
          }
          return extractSupadataErrorMessage(status.error) ?? extractSupadataErrorMessage(status.message) ?? 'Supadata transcription failed'
        },
        buildDeadlineError: buildPollingDeadlineError,
        buildResumeProbeError: buildResumeProbeError,
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
        retryClass: 'runtime_http_read' as RetryClass,
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
    l.success(`Segment ${segmentNumber}/${totalSegments} transcription completed in ${processingTime}ms`)
  }

  return { result, metadata }
}
