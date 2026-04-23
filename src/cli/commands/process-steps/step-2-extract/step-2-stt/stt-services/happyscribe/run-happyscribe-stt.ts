import { basename } from 'node:path'
import type {
  AsyncSttLifecycleHooks,
  RetryClass,
  Step2Metadata,
  Step2RuntimeMetadata,
  TranscriptionResult,
  TranscriptionSegment,
  TranscriptionEvidenceSegment,
  TranscriptionEvidenceWord
} from '~/types'
import * as l from '~/utils/logger'
import { logSttAsyncJobLifecycle, logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import {
  buildSegmentsFromWords,
  buildTranscriptionOutputBase,
  countTokens,
  formatSpeakerLabel,
  formatTranscriptText,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import {
  pollAsyncSttJobUntilComplete,
  readPersistedAsyncSttRuntime,
  writeAsyncSttProgressMetadata
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import {
  buildHappyScribeOrganizationResolutionError,
  buildHappyScribeUrl,
  getHappyScribeApiKey,
  getHappyScribeBaseUrl,
  HAPPYSCRIBE_STT_LANGUAGE,
  resolveHappyScribeOrganizationSelection
} from './happyscribe'
import { buildHappyScribeRegistryEstimate } from './happyscribe-pricing'
import type {
  HappyScribeExport,
  HappyScribeHttpError,
  HappyScribeOrder,
  HappyScribeStage,
  HappyScribeTranscription,
  NormalizedSegment,
  NormalizedWord
} from '~/types'

const INITIAL_POLL_INTERVAL_MS = 1_000
const MAX_POLL_INTERVAL_MS = 10_000
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const normalizeId = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}

const parseNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string'
      ? (() => {
          const parsed = Number.parseFloat(value)
          return Number.isFinite(parsed) ? parsed : undefined
        })()
      : undefined

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

const extractErrorMessage = (payload: unknown): string | undefined => {
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (!isRecord(payload)) {
    return undefined
  }

  for (const key of ['message', 'error', 'detail', 'failureMessage', 'failureReason'] as const) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return undefined
}

const getErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

const buildRetryHeaders = (
  response: Response,
  payload: unknown
): Headers => {
  const headers = new Headers(response.headers)
  if (!headers.has('retry-after') && isRecord(payload)) {
    const retryInSeconds = parseNumber(payload['retry_in_seconds'])
    if (typeof retryInSeconds === 'number' && retryInSeconds >= 0) {
      headers.set('retry-after', String(retryInSeconds))
    }
  }
  return headers
}

const toHappyScribeHttpError = (
  stage: HappyScribeStage,
  retryClass: RetryClass,
  response: Response,
  payload: unknown,
  messagePrefix = 'Happy Scribe request failed'
): HappyScribeHttpError => Object.assign(
  new Error(`${messagePrefix} (${response.status}): ${extractErrorMessage(payload) ?? 'Unknown error'}`),
  {
    status: response.status,
    headers: buildRetryHeaders(response, payload),
    stage,
    retryClass,
    rawResponse: payload
  } satisfies Pick<HappyScribeHttpError, 'status' | 'headers' | 'stage' | 'retryClass' | 'rawResponse'>
)

const attachHappyScribeErrorContext = (
  error: unknown,
  stage: HappyScribeStage,
  retryClass: RetryClass,
  rawResponse?: unknown
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as HappyScribeHttpError).stage = stage
  ;(source as HappyScribeHttpError).retryClass = retryClass
  if (rawResponse !== undefined) {
    ;(source as HappyScribeHttpError).rawResponse = rawResponse
  }
  throw source
}

const parseSignedUploadUrl = (payload: unknown): string => {
  if (isRecord(payload) && typeof payload['signedUrl'] === 'string' && payload['signedUrl'].length > 0) {
    return payload['signedUrl']
  }
  if (isRecord(payload) && typeof payload['signed_url'] === 'string' && payload['signed_url'].length > 0) {
    return payload['signed_url']
  }

  throw new Error('Happy Scribe signed upload response missing signedUrl')
}

const parseOrder = (payload: unknown): HappyScribeOrder => {
  if (!isRecord(payload)) {
    throw new Error('Happy Scribe order response was not an object')
  }

  const id = normalizeId(payload['id'])
  if (!id || typeof payload['state'] !== 'string') {
    throw new Error('Happy Scribe order response missing id or state')
  }

  const details = isRecord(payload['details'])
    ? {
        ...(typeof parseNumber(payload['details']['total_cents']) === 'number'
          ? { totalCents: parseNumber(payload['details']['total_cents']) }
          : {}),
        ...(typeof parseNumber(payload['details']['total_credits']) === 'number'
          ? { totalCredits: parseNumber(payload['details']['total_credits']) }
          : {}),
        ...(typeof payload['details']['currency'] === 'string' && payload['details']['currency'].trim().length > 0
          ? { currency: payload['details']['currency'].trim().toLowerCase() }
          : {})
      }
    : undefined

  const outputsIds = Array.isArray(payload['outputsIds'])
    ? payload['outputsIds'].map(normalizeId).filter((value): value is string => typeof value === 'string')
    : []
  const transcriptions: HappyScribeOrder['transcriptions'] = []
  if (Array.isArray(payload['transcriptions'])) {
    for (const value of payload['transcriptions']) {
      if (!isRecord(value)) {
        continue
      }

      const transcription: HappyScribeOrder['transcriptions'][number] = {}
      const transcriptionId = normalizeId(value['id'])
      const transcriptionUuid = normalizeId(value['uuid'])
      if (transcriptionId) {
        transcription.id = transcriptionId
      }
      if (transcriptionUuid) {
        transcription.uuid = transcriptionUuid
      }
      if (typeof value['state'] === 'string') {
        transcription.state = value['state']
      }

      if (transcription.id || transcription.uuid || transcription.state) {
        transcriptions.push(transcription)
      }
    }
  }

  return {
    id,
    state: payload['state'],
    ...(details && Object.keys(details).length > 0 ? { details } : {}),
    outputsIds,
    transcriptions
  }
}

const parseTranscription = (payload: unknown): HappyScribeTranscription => {
  if (!isRecord(payload)) {
    throw new Error('Happy Scribe transcription response was not an object')
  }

  const links = isRecord(payload['_links']) ? payload['_links'] : undefined
  const selfLink = links && isRecord(links['self']) ? links['self'] : undefined

  return {
    ...(normalizeId(payload['id']) ? { id: normalizeId(payload['id']) } : {}),
    ...(typeof payload['state'] === 'string' ? { state: payload['state'] } : {}),
    ...(typeof payload['failureReason'] === 'string' ? { failureReason: payload['failureReason'] } : {}),
    ...(typeof payload['failureMessage'] === 'string' ? { failureMessage: payload['failureMessage'] } : {}),
    ...(typeof parseNumber(payload['costInCents']) === 'number'
      ? { costInCents: parseNumber(payload['costInCents']) }
      : {}),
    ...(selfLink && typeof selfLink['downloadUrl'] === 'string' && selfLink['downloadUrl'].length > 0
      ? { downloadUrl: selfLink['downloadUrl'] }
      : {})
  }
}

const parseExport = (payload: unknown): HappyScribeExport => {
  if (!isRecord(payload)) {
    throw new Error('Happy Scribe export response was not an object')
  }

  const id = normalizeId(payload['id'])
  if (!id || typeof payload['state'] !== 'string') {
    throw new Error('Happy Scribe export response missing id or state')
  }

  return {
    id,
    state: payload['state'],
    ...(typeof payload['download_link'] === 'string' && payload['download_link'].length > 0
      ? { downloadLink: payload['download_link'] }
      : {})
  }
}

const resolveOrderTranscriptionId = (
  order: HappyScribeOrder
): string | undefined => {
  const finishedTranscription = order.transcriptions.find((transcription) => transcription.state === 'automatic_done')
  if (finishedTranscription?.uuid) {
    return finishedTranscription.uuid
  }
  if (finishedTranscription?.id) {
    return finishedTranscription.id
  }

  const firstTranscription = order.transcriptions[0]
  if (firstTranscription?.uuid) {
    return firstTranscription.uuid
  }
  if (firstTranscription?.id) {
    return firstTranscription.id
  }

  return order.outputsIds[0]
}

const buildOrderFailureMessage = (order: HappyScribeOrder): string => {
  if (order.state === 'locked') {
    return 'Happy Scribe order is locked due to insufficient credits or balance'
  }
  return `Happy Scribe order failed while in state "${order.state}"`
}

const buildPollingDeadlineError = (
  orderId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`Happy Scribe timed out waiting for transcription completion for ${orderId} (deadline exceeded after ${pollDeadlineMs}ms)`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const buildExportDeadlineError = (
  exportId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`Happy Scribe timed out waiting for export completion for ${exportId} (deadline exceeded after ${pollDeadlineMs}ms)`),
    {
      stage: 'result' as HappyScribeStage,
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const buildResumeProbeError = (
  orderId: string,
  probeCount: number,
  totalWaitMs: number
): never => {
  const error = Object.assign(
    new Error(`Happy Scribe order ${orderId} is still pending after ${probeCount} resume status checks (${totalWaitMs}ms total backoff). Retry the command later.`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const parseTimestampToSeconds = (value: string): number | undefined => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return undefined
  }

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const parsed = Number.parseFloat(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  const parts = trimmed.split(':')
  if (parts.length < 2 || parts.length > 3) {
    return undefined
  }

  const numeric = parts.map((part) => Number.parseFloat(part))
  if (numeric.some((part) => !Number.isFinite(part))) {
    return undefined
  }

  if (numeric.length === 3) {
    return (numeric[0] as number) * 3600 + (numeric[1] as number) * 60 + (numeric[2] as number)
  }

  return (numeric[0] as number) * 60 + (numeric[1] as number)
}

const readTimeField = (
  record: Record<string, unknown>,
  candidates: Array<{ key: string, unit: 'seconds' | 'milliseconds' | 'auto' }>
): number | undefined => {
  for (const candidate of candidates) {
    if (!(candidate.key in record)) {
      continue
    }

    const rawValue = record[candidate.key]
    if (candidate.unit === 'milliseconds') {
      const parsed = parseNumber(rawValue)
      if (typeof parsed === 'number') {
        return parsed / 1000
      }
      continue
    }

    if (candidate.unit === 'seconds') {
      const parsed = parseNumber(rawValue)
      if (typeof parsed === 'number') {
        return parsed
      }
      continue
    }

    if (typeof rawValue === 'string') {
      const parsed = parseTimestampToSeconds(rawValue)
      if (typeof parsed === 'number') {
        return parsed
      }
    }

    const parsed = parseNumber(rawValue)
    if (typeof parsed === 'number') {
      return parsed
    }
  }

  return undefined
}

const resolveSpeakerLabel = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return formatSpeakerLabel(value)
  }

  if (!isRecord(value)) {
    return undefined
  }

  for (const key of ['speaker_label', 'speakerLabel', 'speaker_name', 'speakerName', 'name', 'speaker_id', 'speakerId', 'id'] as const) {
    const candidate = value[key]
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      return formatSpeakerLabel(candidate)
    }
  }

  return undefined
}

const extractText = (
  record: Record<string, unknown>
): string | undefined => {
  for (const key of ['text', 'value', 'content', 'transcript', 'full_text', 'fullText', 'sentence'] as const) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  if (Array.isArray(record['words'])) {
    const parts = record['words']
      .map((entry) => {
        if (!isRecord(entry)) {
          return undefined
        }
        const text = entry['text'] ?? entry['word'] ?? entry['value']
        return typeof text === 'string' && text.trim().length > 0 ? text.trim() : undefined
      })
      .filter((value): value is string => typeof value === 'string')
    if (parts.length > 0) {
      return parts.join(' ').trim()
    }
  }

  return undefined
}

const parseWord = (
  value: unknown
): NormalizedWord | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const textCandidate = value['text'] ?? value['word'] ?? value['value'] ?? value['content']
  if (typeof textCandidate !== 'string' || textCandidate.trim().length === 0) {
    return undefined
  }

  const startSeconds = readTimeField(value, [
    { key: 'start_seconds', unit: 'seconds' },
    { key: 'startSeconds', unit: 'seconds' },
    { key: 'start_ms', unit: 'milliseconds' },
    { key: 'startMs', unit: 'milliseconds' },
    { key: 'start_time_ms', unit: 'milliseconds' },
    { key: 'startTimeMs', unit: 'milliseconds' },
    { key: 'start_time', unit: 'auto' },
    { key: 'startTime', unit: 'auto' },
    { key: 'start', unit: 'auto' }
  ])
  const endSeconds = readTimeField(value, [
    { key: 'end_seconds', unit: 'seconds' },
    { key: 'endSeconds', unit: 'seconds' },
    { key: 'end_ms', unit: 'milliseconds' },
    { key: 'endMs', unit: 'milliseconds' },
    { key: 'end_time_ms', unit: 'milliseconds' },
    { key: 'endTimeMs', unit: 'milliseconds' },
    { key: 'end_time', unit: 'auto' },
    { key: 'endTime', unit: 'auto' },
    { key: 'end', unit: 'auto' }
  ])

  if (typeof startSeconds !== 'number' || typeof endSeconds !== 'number') {
    return undefined
  }

  const text = textCandidate.trim()
  return {
    startSeconds,
    endSeconds,
    text,
    normalized: text.toLowerCase(),
    ...(resolveSpeakerLabel(value['speaker'] ?? value['speaker_id'] ?? value['speakerId'] ?? value['speaker_name'] ?? value['speakerName'])
      ? { speaker: resolveSpeakerLabel(value['speaker'] ?? value['speaker_id'] ?? value['speakerId'] ?? value['speaker_name'] ?? value['speakerName']) }
      : {}),
    ...(typeof parseNumber(value['confidence']) === 'number'
      ? { confidence: parseNumber(value['confidence']) }
      : {})
  }
}

const parseSegment = (
  value: unknown
): NormalizedSegment | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const nestedWords = Array.isArray(value['words'])
    ? value['words'].map(parseWord).filter((word): word is NormalizedWord => word !== undefined)
    : []

  const text = extractText(value)
    ?? (nestedWords.length > 0 ? nestedWords.map((word) => word.text).join(' ').trim() : undefined)
  if (!text) {
    return undefined
  }

  const startSeconds = readTimeField(value, [
    { key: 'start_seconds', unit: 'seconds' },
    { key: 'startSeconds', unit: 'seconds' },
    { key: 'start_ms', unit: 'milliseconds' },
    { key: 'startMs', unit: 'milliseconds' },
    { key: 'start_time_ms', unit: 'milliseconds' },
    { key: 'startTimeMs', unit: 'milliseconds' },
    { key: 'start_time', unit: 'auto' },
    { key: 'startTime', unit: 'auto' },
    { key: 'start', unit: 'auto' }
  ]) ?? nestedWords[0]?.startSeconds
  const endSeconds = readTimeField(value, [
    { key: 'end_seconds', unit: 'seconds' },
    { key: 'endSeconds', unit: 'seconds' },
    { key: 'end_ms', unit: 'milliseconds' },
    { key: 'endMs', unit: 'milliseconds' },
    { key: 'end_time_ms', unit: 'milliseconds' },
    { key: 'endTimeMs', unit: 'milliseconds' },
    { key: 'end_time', unit: 'auto' },
    { key: 'endTime', unit: 'auto' },
    { key: 'end', unit: 'auto' }
  ]) ?? nestedWords[nestedWords.length - 1]?.endSeconds

  if (typeof startSeconds !== 'number' || typeof endSeconds !== 'number') {
    return undefined
  }

  return {
    startSeconds,
    endSeconds,
    text,
    ...(resolveSpeakerLabel(value['speaker'] ?? value['speaker_id'] ?? value['speakerId'] ?? value['speaker_name'] ?? value['speakerName'])
      ? { speaker: resolveSpeakerLabel(value['speaker'] ?? value['speaker_id'] ?? value['speakerId'] ?? value['speaker_name'] ?? value['speakerName']) }
      : nestedWords[0]?.speaker ? { speaker: nestedWords[0].speaker } : {}),
    ...(typeof parseNumber(value['confidence']) === 'number'
      ? { confidence: parseNumber(value['confidence']) }
      : {})
  }
}

const collectStructuredCandidates = (
  value: unknown,
  buckets: { records: Record<string, unknown>[], arrays: unknown[][] } = { records: [], arrays: [] },
  depth = 0,
  seen = new Set<object>()
): { records: Record<string, unknown>[], arrays: unknown[][] } => {
  if (depth > 5) {
    return buckets
  }

  if (Array.isArray(value)) {
    buckets.arrays.push(value)
    for (const entry of value) {
      collectStructuredCandidates(entry, buckets, depth + 1, seen)
    }
    return buckets
  }

  if (!isRecord(value) || seen.has(value)) {
    return buckets
  }

  seen.add(value)
  buckets.records.push(value)
  for (const nested of Object.values(value)) {
    collectStructuredCandidates(nested, buckets, depth + 1, seen)
  }
  return buckets
}

const toNormalizedSegmentsFromWords = (
  words: NormalizedWord[]
): NormalizedSegment[] =>
  buildSegmentsFromWords(words.map((word) => ({
    start: word.startSeconds,
    end: word.endSeconds,
    text: word.text,
    ...(word.speaker ? { speaker: word.speaker } : {})
  })), 0).map((segment) => ({
    startSeconds: parseTimestampToSeconds(segment.start) ?? 0,
    endSeconds: parseTimestampToSeconds(segment.end) ?? (parseTimestampToSeconds(segment.start) ?? 0),
    text: segment.text,
    ...(segment.speaker ? { speaker: segment.speaker } : {})
  }))

const normalizeHappyScribeStructuredPayload = (
  payload: unknown,
  offsetSeconds: number
): TranscriptionResult => {
  const candidates = collectStructuredCandidates(payload)
  const bestWords = candidates.arrays
    .map((array) => array.map(parseWord).filter((word): word is NormalizedWord => word !== undefined))
    .sort((left, right) => right.length - left.length)[0] ?? []
  const bestSegments = candidates.arrays
    .map((array) => array.map(parseSegment).filter((segment): segment is NormalizedSegment => segment !== undefined))
    .sort((left, right) =>
      right.reduce((sum, segment) => sum + segment.text.length, 0)
      - left.reduce((sum, segment) => sum + segment.text.length, 0)
    )[0] ?? []
  const text = candidates.records
    .map(extractText)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort((left, right) => right.length - left.length)[0]

  const normalizedSegments = bestSegments.length > 0
    ? bestSegments
    : bestWords.length > 0
      ? toNormalizedSegmentsFromWords(bestWords)
      : []

  if (!text && normalizedSegments.length === 0 && bestWords.length === 0) {
    throw new Error('Happy Scribe transcript payload did not include recognizable structured transcript content')
  }

  const mappedSegments: TranscriptionSegment[] = normalizedSegments.map((segment) => ({
    start: toTimestamp(segment.startSeconds + offsetSeconds),
    end: toTimestamp(segment.endSeconds + offsetSeconds),
    text: segment.text,
    ...(segment.speaker ? { speaker: segment.speaker } : {})
  }))
  const { finalSegments, finalText } = resolveTranscriptionOutput(mappedSegments, text ?? '', offsetSeconds)
  const evidenceSegments: TranscriptionEvidenceSegment[] = normalizedSegments.map((segment) => ({
    startSeconds: segment.startSeconds + offsetSeconds,
    endSeconds: segment.endSeconds + offsetSeconds,
    text: segment.text,
    ...(segment.speaker ? { speaker: segment.speaker } : {}),
    ...(typeof segment.confidence === 'number' ? { confidence: segment.confidence } : {})
  }))
  const evidenceWords: TranscriptionEvidenceWord[] = bestWords.map((word) => ({
    startSeconds: word.startSeconds + offsetSeconds,
    endSeconds: word.endSeconds + offsetSeconds,
    text: word.text,
    normalized: word.normalized,
    ...(word.speaker ? { speaker: word.speaker } : {}),
    ...(typeof word.confidence === 'number' ? { confidence: word.confidence } : {}),
    timingSource: 'native'
  }))

  return {
    text: finalText,
    segments: finalSegments,
    evidence: {
      ...(evidenceSegments.length > 0 ? { segments: evidenceSegments } : {}),
      ...(evidenceWords.length > 0 ? { words: evidenceWords } : {}),
      capabilities: {
        hasNativeWordTiming: evidenceWords.length > 0,
        hasConfidence: evidenceWords.some((word) => typeof word.confidence === 'number')
          || evidenceSegments.some((segment) => typeof segment.confidence === 'number'),
        hasSpeakerLabels: evidenceWords.some((word) => word.speaker !== undefined)
          || finalSegments.some((segment) => segment.speaker !== undefined)
      },
      timingQuality: evidenceWords.length > 0 ? 'native_word' : 'segment_interpolated',
      rawResponse: payload
    }
  }
}

const buildBillingMetadata = (
  modelName: string,
  audioDurationSeconds: number | undefined,
  order: HappyScribeOrder,
  transcription: HappyScribeTranscription
): Step2Metadata['billing'] | undefined => {
  const totalCost = order.details?.currency === 'usd'
    ? order.details.totalCents ?? transcription.costInCents
    : undefined
  const creditsUsed = order.details?.currency === 'usd'
    ? order.details.totalCredits
    : undefined

  if (typeof totalCost === 'number' && Number.isFinite(totalCost) && totalCost >= 0) {
    const billing: NonNullable<Step2Metadata['billing']> = {
      totalCost,
      source: 'provider_quote',
      mode: 'order'
    }
    if (typeof creditsUsed === 'number' && Number.isFinite(creditsUsed) && creditsUsed >= 0) {
      billing.creditsUsed = creditsUsed
      if (creditsUsed > 0) {
        billing.creditRateCents = totalCost / creditsUsed
      }
    }
    return billing
  }

  if (typeof audioDurationSeconds === 'number' && Number.isFinite(audioDurationSeconds) && audioDurationSeconds >= 0) {
    return {
      totalCost: buildHappyScribeRegistryEstimate(modelName, audioDurationSeconds),
      source: 'registry_fallback',
      mode: 'duration'
    }
  }

  return undefined
}

const fetchDownloadPayload = async (
  url: string,
  apiKey: string
): Promise<unknown> => {
  const candidates: Array<Record<string, string>> = [
    { accept: 'application/json' },
    {
      accept: 'application/json',
      authorization: `Bearer ${apiKey}`
    }
  ]

  let lastError: unknown
  for (const headers of candidates) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'follow'
      })
      const payload = await readJsonOrText(response)
      if (!response.ok) {
        throw toHappyScribeHttpError('result', 'runtime_http_read', response, payload, 'Happy Scribe transcript download failed')
      }
      if (typeof payload === 'string') {
        throw Object.assign(
          new Error('Happy Scribe transcript download did not return JSON'),
          {
            stage: 'result',
            retryClass: 'runtime_http_read' as RetryClass,
            rawResponse: payload
          }
        )
      }
      return payload
    } catch (error) {
      lastError = error
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export const runHappyScribeStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    happyscribeOrganizationId?: string | undefined
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
    happyscribeOrganizationId,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options
  const apiKey = getHappyScribeApiKey()
  if (!apiKey) {
    throw new Error('HAPPYSCRIBE_API_KEY environment variable is required for Happy Scribe transcription')
  }

  const baseURL = getHappyScribeBaseUrl()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const startTime = Date.now()
  let uploadMs = 0
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
  let billing: Step2Metadata['billing'] | undefined

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'happyscribe', action: 'started', segmentNumber, totalSegments, model: modelName })
  }

  const organizationSelection = await resolveHappyScribeOrganizationSelection({
    preferredOrganizationId: happyscribeOrganizationId
  })
  if (!organizationSelection.selected) {
    throw buildHappyScribeOrganizationResolutionError(organizationSelection)
  }
  if (organizationSelection.selected.currency && organizationSelection.selected.currency !== 'usd') {
    throw new Error([
      `Happy Scribe organization ${organizationSelection.selected.id}${organizationSelection.selected.name ? ` (${organizationSelection.selected.name})` : ''} reports currency ${organizationSelection.selected.currency}, but v1 execution supports exact-cost capture only for usd organizations.`,
      `Organizations: ${organizationSelection.organizations.length > 0 ? organizationSelection.organizations.map((organization) => `${organization.id}${organization.name ? ` "${organization.name}"` : ''}${organization.currency ? ` currency=${organization.currency}` : ''}`).join(', ') : 'none'}.`,
      'Pass --happyscribe-organization-id <id> or save defaults.extract.stt.happyscribeOrganizationId with bun as config.'
    ].join(' '))
  }

  let runtime = await readPersistedAsyncSttRuntime(outputDir, {
    transcriptionService: 'happyscribe',
    transcriptionModel: modelName
  })
  let orderId = runtime?.remoteJobId
  let uploadUrl = runtime?.remoteAssetUrl
  let resumedExistingOrder = false
  let jobReadyNotified = false

  const buildProgressMetadata = (nextRuntime: Step2RuntimeMetadata): Step2Metadata => ({
    transcriptionService: 'happyscribe',
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

  if (runtime && (runtime.stage === 'created' || runtime.stage === 'polling')) {
    resumedExistingOrder = true
    runtime = {
      ...runtime,
      mode: 'resumed',
      stage: 'polling'
    }
    orderId = runtime.remoteJobId
    uploadUrl = runtime.remoteAssetUrl
    await persistProgressMetadata(runtime)
    await notifyJobReady(runtime)
  } else {
    let signedUploadPayload: unknown
    try {
      const uploadStartedAt = Date.now()
      signedUploadPayload = await withRetry(
        {
          retryClass: 'runtime_http_create_conservative',
          operationName: 'happyscribe-get-signed-upload',
          policy: { maxAttempts: 4 },
          timeoutMs: REQUEST_TIMEOUT_MS
        },
        async (signal) => {
          requestCount += 1
          const uploadUrlResponse = await fetch(`${buildHappyScribeUrl(baseURL, '/uploads/new')}?filename=${encodeURIComponent(basename(audioPath))}`, {
            method: 'GET',
            headers: {
              authorization: `Bearer ${apiKey}`,
              accept: 'application/json'
            },
            signal: signal ?? null
          })
          const payload = await readJsonOrText(uploadUrlResponse)

          if (!uploadUrlResponse.ok) {
            throw toHappyScribeHttpError('upload', 'runtime_http_create_conservative', uploadUrlResponse, payload, 'Happy Scribe signed upload request failed')
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
      uploadUrl = parseSignedUploadUrl(signedUploadPayload)

      await withRetry(
        {
          retryClass: 'runtime_http_create_conservative',
          operationName: 'happyscribe-upload-media',
          policy: { maxAttempts: 3 },
          timeoutMs: REQUEST_TIMEOUT_MS
        },
        async (signal) => {
          requestCount += 1
          const uploadResponse = await fetch(uploadUrl as string, {
            method: 'PUT',
            body: Bun.file(audioPath),
            signal: signal ?? null
          })

          if (!uploadResponse.ok) {
            const payload = await readJsonOrText(uploadResponse)
            throw toHappyScribeHttpError('upload', 'runtime_http_create_conservative', uploadResponse, payload, 'Happy Scribe media upload failed')
          }
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
      uploadMs += Date.now() - uploadStartedAt
    } catch (error) {
      attachHappyScribeErrorContext(error, 'upload', 'runtime_http_create_conservative', signedUploadPayload)
    }

    let createPayload: unknown
    try {
      const createStartedAt = Date.now()
      createPayload = await withRetry(
        {
          retryClass: 'runtime_http_create_conservative',
          operationName: 'happyscribe-create-order',
          policy: { maxAttempts: 4 },
          timeoutMs: REQUEST_TIMEOUT_MS
        },
        async (signal) => {
          requestCount += 1
          const response = await fetch(buildHappyScribeUrl(baseURL, '/orders'), {
            method: 'POST',
            headers: {
              authorization: `Bearer ${apiKey}`,
              accept: 'application/json',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              order: {
                url: uploadUrl,
                language: HAPPYSCRIBE_STT_LANGUAGE,
                service: 'auto',
                confirm: true,
                organization_id: organizationSelection.selected?.id,
                is_subtitle: false,
                name: basename(audioPath)
              }
            }),
            signal: signal ?? null
          })
          const payload = await readJsonOrText(response)

          if (!response.ok) {
            throw toHappyScribeHttpError('create', 'runtime_http_create_conservative', response, payload, 'Happy Scribe order creation failed')
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
      createMs += Date.now() - createStartedAt
      createCount += 1
    } catch (error) {
      attachHappyScribeErrorContext(error, 'create', 'runtime_http_create_conservative', createPayload)
    }

    const createdOrder = parseOrder(createPayload)
    orderId = createdOrder.id

    const createdRuntime: Step2RuntimeMetadata = {
      mode: 'fresh',
      stage: 'polling',
      remoteJobId: orderId,
      ...(uploadUrl ? { remoteAssetUrl: uploadUrl } : {}),
      createCompletedAt: new Date().toISOString()
    }
    await persistProgressMetadata(createdRuntime)
    await notifyJobReady(createdRuntime)
  }

  if (!orderId) {
    throw new Error('Happy Scribe order creation did not return an order id')
  }

  logSttAsyncJobLifecycle(l, {
    provider: `happyscribe/${modelName}`,
    action: resumedExistingOrder ? 'resumed' : 'created',
    remoteId: orderId,
    state: 'polling'
  })

  const orderPollResult = await pollAsyncSttJobUntilComplete({
    jobId: orderId,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    audioDurationSeconds,
    envSpecificDeadlineKey: 'AUTOSHOW_STT_POLL_DEADLINE_MS_HAPPYSCRIBE',
    pollMode: resumedExistingOrder ? 'resume-probe' : 'fresh',
    buildDeadlineError: (jobId, pollDeadlineMs) => buildPollingDeadlineError(jobId, pollDeadlineMs),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs) => buildResumeProbeError(jobId, probeCount, totalWaitMs),
    poll: async () => {
      let payload: unknown
      let retryAfterMs: number | null = null
      try {
        const pollStartedAt = Date.now()
        payload = await withRetry(
          {
            retryClass: 'runtime_http_read',
            operationName: 'happyscribe-poll-order',
            policy: { maxAttempts: 6 },
            timeoutMs: POLL_REQUEST_TIMEOUT_MS
          },
          async (signal) => {
            requestCount += 1
            const response = await fetch(buildHappyScribeUrl(baseURL, `/orders/${encodeURIComponent(orderId as string)}`), {
              method: 'GET',
              headers: {
                authorization: `Bearer ${apiKey}`,
                accept: 'application/json'
              },
              signal: signal ?? null
            })
            const payload = await readJsonOrText(response)

            if (!response.ok) {
              throw toHappyScribeHttpError('poll', 'runtime_http_read', response, payload, 'Happy Scribe order poll failed')
            }

            retryAfterMs = parseRetryAfterMs(buildRetryHeaders(response, payload)) ?? null
            return payload
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
        attachHappyScribeErrorContext(error, 'poll', 'runtime_http_read', payload)
      }

      return {
        status: parseOrder(payload),
        retryAfterMs
      }
    },
    isComplete: (order) => order.state === 'fulfilled',
    isFailed: (order) =>
      order.state === 'failed' || order.state === 'locked'
        ? buildOrderFailureMessage(order)
        : undefined,
    onProgress: async () => {
      await persistProgressMetadata({
        ...(runtime ?? {
          mode: 'fresh',
          stage: 'polling',
          remoteJobId: orderId
        }),
        mode: runtime?.mode ?? 'fresh',
        stage: 'polling',
        remoteJobId: orderId,
        ...(uploadUrl ? { remoteAssetUrl: uploadUrl } : {}),
        ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
        lastPollAt: new Date().toISOString()
      })
    },
    withPollSlot: lifecycle?.withPollSlot
  })

  pollSleepMs += orderPollResult.pollSleepMs
  pollCount += orderPollResult.pollCount
  const completedOrder = orderPollResult.status

  const transcriptionId = resolveOrderTranscriptionId(completedOrder)
  if (!transcriptionId) {
    throw new Error('Happy Scribe order completed without a transcription identifier')
  }

  let transcriptionPayload: unknown
  let transcription: HappyScribeTranscription | undefined
  try {
    const transcriptStartedAt = Date.now()
    transcriptionPayload = await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'happyscribe-get-transcription',
        policy: { maxAttempts: 4 },
        timeoutMs: POLL_REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        requestCount += 1
        const response = await fetch(buildHappyScribeUrl(baseURL, `/transcriptions/${encodeURIComponent(transcriptionId)}`), {
          method: 'GET',
          headers: {
            authorization: `Bearer ${apiKey}`,
            accept: 'application/json'
          },
          signal: signal ?? null
        })
        const payload = await readJsonOrText(response)

        if (!response.ok) {
          throw toHappyScribeHttpError('result', 'runtime_http_read', response, payload, 'Happy Scribe transcription lookup failed')
        }

        return payload
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
    transcription = parseTranscription(transcriptionPayload)
    transcriptMs += Date.now() - transcriptStartedAt
  } catch (error) {
    attachHappyScribeErrorContext(error, 'result', 'runtime_http_read', transcriptionPayload)
  }
  if (!transcription) {
    throw new Error('Happy Scribe transcription lookup did not return transcription metadata')
  }

  const completedRuntime: Step2RuntimeMetadata = {
    ...(runtime ?? {
      mode: 'fresh',
      stage: 'completed',
      remoteJobId: orderId
    }),
    mode: runtime?.mode ?? 'fresh',
    stage: 'completed',
    remoteJobId: orderId,
    ...(uploadUrl ? { remoteAssetUrl: uploadUrl } : {}),
    ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
    ...(runtime?.lastPollAt ? { lastPollAt: runtime.lastPollAt } : {}),
    completedAt: new Date().toISOString()
  }
  billing = buildBillingMetadata(modelName, audioDurationSeconds, completedOrder, transcription)
  await persistProgressMetadata(completedRuntime)

  let result: TranscriptionResult | undefined
  const tryDirectDownload = async (): Promise<TranscriptionResult | undefined> => {
    if (!transcription.downloadUrl) {
      return undefined
    }

    try {
      const structuredPayload = await fetchDownloadPayload(transcription.downloadUrl, apiKey)
      return normalizeHappyScribeStructuredPayload(structuredPayload, offsetSeconds)
    } catch {
      return undefined
    }
  }

  result = await tryDirectDownload()

  if (!result) {
    let exportPayload: unknown
    let exportRecord: HappyScribeExport
    try {
      const transcriptStartedAt = Date.now()
      exportPayload = await withRetry(
        {
          retryClass: 'runtime_http_create_conservative',
          operationName: 'happyscribe-create-export',
          policy: { maxAttempts: 4 },
          timeoutMs: REQUEST_TIMEOUT_MS
        },
        async (signal) => {
          requestCount += 1
          const response = await fetch(buildHappyScribeUrl(baseURL, '/exports'), {
            method: 'POST',
            headers: {
              authorization: `Bearer ${apiKey}`,
              accept: 'application/json',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              export: {
                format: 'json',
                transcription_ids: [transcription.id ?? transcriptionId]
              }
            }),
            signal: signal ?? null
          })
          const payload = await readJsonOrText(response)

          if (!response.ok) {
            throw toHappyScribeHttpError('result', 'runtime_http_create_conservative', response, payload, 'Happy Scribe export creation failed')
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
      exportRecord = parseExport(exportPayload)
      createCount += 1

      const exportPollResult = await pollAsyncSttJobUntilComplete({
        jobId: exportRecord.id,
        initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
        maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
        audioDurationSeconds,
        envSpecificDeadlineKey: 'AUTOSHOW_STT_POLL_DEADLINE_MS_HAPPYSCRIBE',
        buildDeadlineError: (jobId, pollDeadlineMs) => buildExportDeadlineError(jobId, pollDeadlineMs),
        poll: async () => {
          let retryAfterMs: number | null = null
          let payload: unknown
          try {
            payload = await withRetry(
              {
                retryClass: 'runtime_http_read',
                operationName: 'happyscribe-poll-export',
                policy: { maxAttempts: 6 },
                timeoutMs: POLL_REQUEST_TIMEOUT_MS
              },
              async (signal) => {
                requestCount += 1
                const response = await fetch(buildHappyScribeUrl(baseURL, `/exports/${encodeURIComponent(exportRecord.id)}`), {
                  method: 'GET',
                  headers: {
                    authorization: `Bearer ${apiKey}`,
                    accept: 'application/json'
                  },
                  signal: signal ?? null
                })
                const payload = await readJsonOrText(response)

                if (!response.ok) {
                  throw toHappyScribeHttpError('result', 'runtime_http_read', response, payload, 'Happy Scribe export poll failed')
                }

                retryAfterMs = parseRetryAfterMs(buildRetryHeaders(response, payload)) ?? null
                return payload
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
          } catch (error) {
            attachHappyScribeErrorContext(error, 'result', 'runtime_http_read', payload)
          }

          return {
            status: parseExport(payload),
            retryAfterMs
          }
        },
        isComplete: (exportStatus) => exportStatus.state === 'ready',
        isFailed: (exportStatus) =>
          exportStatus.state === 'failed' || exportStatus.state === 'expired'
            ? `Happy Scribe export ${exportStatus.id} failed in state "${exportStatus.state}"`
            : undefined,
        withPollSlot: lifecycle?.withPollSlot
      })

      pollSleepMs += exportPollResult.pollSleepMs
      pollCount += exportPollResult.pollCount
      exportRecord = exportPollResult.status
      if (!exportRecord.downloadLink) {
        throw new Error('Happy Scribe export completed without download_link')
      }

      const structuredPayload = await fetchDownloadPayload(exportRecord.downloadLink, apiKey)
      result = normalizeHappyScribeStructuredPayload(structuredPayload, offsetSeconds)
      transcriptMs += Date.now() - transcriptStartedAt
    } catch (error) {
      attachHappyScribeErrorContext(error, 'result', 'runtime_http_read', exportPayload)
    }
  }

  if (!result) {
    throw new Error('Happy Scribe transcript retrieval did not produce a transcript')
  }

  const formattedTranscriptPath = `${outputBase}.txt`
  await Bun.write(formattedTranscriptPath, formatTranscriptText(result.segments))

  const processingTime = Date.now() - startTime
  const remoteProcessingMs = Math.max(0, processingTime - uploadMs - createMs - pollMs - transcriptMs)
  const metadata: Step2Metadata = {
    transcriptionService: 'happyscribe',
    transcriptionModel: modelName,
    processingTime,
    tokenCount: countTokens(result.text),
    runtime: completedRuntime,
    ...(billing ? { billing } : {}),
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
    logSttSegmentLifecycle(l, { provider: 'happyscribe', action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
  }

  return {
    result,
    metadata
  }
}
