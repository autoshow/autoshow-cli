import * as l from '~/utils/logger'
import type {
  RetryClass,
  Step2Metadata,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import {
  logSttSegmentLifecycle,
  logSttTranscriptOutput
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import {
  convertScrapeCreatorsCreditsToCents,
  estimateScrapeCreatorsCredits,
  getScrapeCreatorsCreditRateCents
} from '~/utils/pricing/scrapecreators-pricing'
import {
  describeScrapeCreatorsUnsupportedSource,
  getScrapeCreatorsBaseUrl,
  isScrapeCreatorsSupportedSourceUrl
} from './scrapecreators'

const REQUEST_TIMEOUT_MS = 60_000
const DEFAULT_LANGUAGE = 'en'

type ScrapeCreatorsTranscriptEntry = {
  startMs: number
  endMs: number
  text: string
  [key: string]: unknown
}

type ScrapeCreatorsTranscriptPayload = {
  transcript: ScrapeCreatorsTranscriptEntry[] | null
  [key: string]: unknown
}

type ScrapeCreatorsHttpError = Error & {
  status?: number | undefined
  headers?: Headers | undefined
  retryClass?: RetryClass | undefined
  stage?: string | undefined
  retryable?: boolean | undefined
  skipped?: boolean | undefined
  rawResponse?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return undefined
    }

    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

const parseTranscriptEntry = (value: unknown): ScrapeCreatorsTranscriptEntry | undefined => {
  if (!isRecord(value) || typeof value['text'] !== 'string') {
    return undefined
  }

  const startMs = parseFiniteNumber(value['startMs'])
  const endMs = parseFiniteNumber(value['endMs'])
  if (startMs === undefined || endMs === undefined) {
    return undefined
  }

  return {
    ...value,
    startMs,
    endMs,
    text: value['text']
  }
}

const parseScrapeCreatorsTranscriptPayload = (
  value: unknown
): ScrapeCreatorsTranscriptPayload | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const transcript = value['transcript']
  if (transcript !== null && !Array.isArray(transcript)) {
    return undefined
  }

  const normalizedTranscript = transcript === null
    ? null
    : transcript.map(parseTranscriptEntry)
  if (normalizedTranscript?.some((entry) => entry === undefined)) {
    return undefined
  }

  return {
    ...value,
    transcript: normalizedTranscript
  } as ScrapeCreatorsTranscriptPayload
}

const buildScrapeCreatorsUrl = (
  baseURL: string,
  sourceUrl: string,
  language: string
): string => {
  const url = new URL('/v1/youtube/video/transcript', baseURL.endsWith('/') ? baseURL : `${baseURL}/`)
  url.searchParams.set('url', sourceUrl)
  url.searchParams.set('language', language)
  return url.toString()
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

const extractScrapeCreatorsErrorMessage = (payload: unknown): string | undefined => {
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (!isRecord(payload)) {
    return undefined
  }

  if (typeof payload['message'] === 'string' && payload['message'].trim().length > 0) {
    return payload['message'].trim()
  }
  if (typeof payload['error'] === 'string' && payload['error'].trim().length > 0) {
    return payload['error'].trim()
  }
  if (isRecord(payload['error']) && typeof payload['error']['message'] === 'string') {
    return payload['error']['message']
  }

  return undefined
}

const toScrapeCreatorsHttpError = (
  response: Response,
  payload: unknown
): ScrapeCreatorsHttpError => Object.assign(
  new Error(`ScrapeCreators transcript request failed (${response.status}): ${extractScrapeCreatorsErrorMessage(payload) ?? 'Unknown error'}`),
  {
    status: response.status,
    headers: response.headers,
    stage: 'create',
    retryClass: 'runtime_http_create_conservative' as RetryClass,
    rawResponse: payload
  } satisfies Partial<ScrapeCreatorsHttpError>
)

const buildScrapeCreatorsUnsupportedSourceError = (
  sourceUrl: string | undefined
): ScrapeCreatorsHttpError => Object.assign(
  new Error(describeScrapeCreatorsUnsupportedSource(sourceUrl)),
  {
    stage: 'create',
    retryable: false,
    skipped: true
  } satisfies Partial<ScrapeCreatorsHttpError>
)

const buildLanguageUnavailableError = (
  language: string,
  payload: ScrapeCreatorsTranscriptPayload
): ScrapeCreatorsHttpError => Object.assign(
  new Error(`ScrapeCreators transcript is unavailable for requested language "${language}"`),
  {
    stage: 'create',
    retryable: false,
    skipped: true,
    rawResponse: payload
  } satisfies Partial<ScrapeCreatorsHttpError>
)

const normalizeLanguage = (language: string | undefined): string => {
  const trimmed = language?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_LANGUAGE
}

const buildSegmentsFromTranscript = (
  transcript: readonly ScrapeCreatorsTranscriptEntry[],
  offsetSeconds: number
): TranscriptionSegment[] =>
  transcript.flatMap((entry) => {
    const text = entry.text.trim()
    if (text.length === 0) {
      return []
    }

    const startSeconds = Math.max(0, offsetSeconds + (entry.startMs / 1_000))
    const endSeconds = Math.max(startSeconds, offsetSeconds + (entry.endMs / 1_000))
    return [{
      start: toTimestamp(startSeconds),
      end: toTimestamp(endSeconds),
      text
    }]
  })

const normalizeScrapeCreatorsTranscript = (
  payload: ScrapeCreatorsTranscriptPayload,
  offsetSeconds: number
): TranscriptionResult => {
  const transcript = payload.transcript ?? []
  const text = transcript
    .map((entry) => entry.text.trim())
    .filter((entryText) => entryText.length > 0)
    .join(' ')
    .trim()
  const { finalSegments, finalText } = resolveTranscriptionOutput(
    buildSegmentsFromTranscript(transcript, offsetSeconds),
    text,
    offsetSeconds
  )

  return {
    text: finalText,
    segments: finalSegments,
    evidence: {
      segments: transcript.flatMap((entry) => {
        const text = entry.text.trim()
        if (text.length === 0) {
          return []
        }
        const startSeconds = Math.max(0, offsetSeconds + (entry.startMs / 1_000))
        return [{
          startSeconds,
          endSeconds: Math.max(startSeconds, offsetSeconds + (entry.endMs / 1_000)),
          text
        }]
      }),
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

export const runScrapeCreatorsStt = async (
  _audioPath: string,
  outputDir: string,
  options: {
    model: string
    sourceUrl?: string | undefined
    language?: string | undefined
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const {
    model: modelName,
    sourceUrl,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments
  } = options
  const language = normalizeLanguage(options.language)

  if (!isScrapeCreatorsSupportedSourceUrl(sourceUrl)) {
    throw buildScrapeCreatorsUnsupportedSourceError(sourceUrl)
  }

  const apiKey = readEnv('SCRAPECREATORS_API_KEY')
  if (!apiKey) {
    throw new Error('SCRAPECREATORS_API_KEY environment variable is required for ScrapeCreators YouTube transcript retrieval')
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'scrapecreators', action: 'started', segmentNumber, totalSegments, model: modelName })
  }

  const startTime = Date.now()
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const requestUrl = buildScrapeCreatorsUrl(getScrapeCreatorsBaseUrl(), sourceUrl as string, language)
  let requestCount = 0
  let retryCount = 0
  let rateLimitCount = 0
  const requestStartedAt = Date.now()

  const payload = await withRetry(
    {
      retryClass: 'runtime_http_create_conservative',
      operationName: 'scrapecreators-youtube-transcript',
      policy: { maxAttempts: 3 },
      timeoutMs: REQUEST_TIMEOUT_MS
    },
    async (signal) => {
      requestCount += 1
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'x-api-key': apiKey
        },
        signal: signal ?? null
      })
      const responsePayload = await readJsonOrText(response)

      if (!response.ok) {
        throw toScrapeCreatorsHttpError(response, responsePayload)
      }

      const parsed = parseScrapeCreatorsTranscriptPayload(responsePayload)
      if (!parsed) {
        throw Object.assign(new Error('ScrapeCreators returned an invalid transcript payload'), {
          stage: 'create',
          retryClass: 'runtime_http_create_conservative' as RetryClass,
          rawResponse: responsePayload
        })
      }

      return parsed
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

  if (payload.transcript === null) {
    throw buildLanguageUnavailableError(language, payload)
  }

  const offsetSeconds = segmentOffsetMinutes * 60
  const result = normalizeScrapeCreatorsTranscript(payload, offsetSeconds)
  await Bun.write(`${outputBase}.txt`, formatTranscriptText(result.segments))
  logSttTranscriptOutput(l, {
    provider: 'scrapecreators',
    path: `${outputBase}.txt`,
    characters: result.text.length
  })

  const creditsUsed = estimateScrapeCreatorsCredits()
  const creditRateCents = getScrapeCreatorsCreditRateCents()
  const processingTime = Date.now() - startTime
  const metadata: Step2Metadata = {
    transcriptionService: 'scrapecreators',
    transcriptionModel: modelName,
    processingTime,
    tokenCount: countTokens(result.text),
    captionLanguage: language,
    timings: {
      createMs: Date.now() - requestStartedAt,
      createCount: 1,
      requestCount,
      ...(retryCount > 0 ? { retryCount } : {}),
      ...(rateLimitCount > 0 ? { rateLimitCount } : {})
    },
    billing: {
      creditsUsed,
      creditRateCents,
      totalCost: convertScrapeCreatorsCreditsToCents(creditsUsed, creditRateCents),
      source: 'fallback-estimate',
      mode: 'url'
    }
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'scrapecreators', action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
  }

  return { result, metadata }
}
