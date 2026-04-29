import * as v from 'valibot'
import type {
  RetryClass,
  Step2Metadata,
  TranscriptionEvidenceWord,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import * as l from '~/utils/logger'
import { logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import {
  appendToken,
  buildSegmentsFromWords,
  buildTranscriptionOutputBase,
  countTokens,
  formatSpeakerLabel,
  formatTranscriptText,
  resolveTranscriptionOutput
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData, validateDataSafe } from '~/utils/validate/validation'

const GROK_DEFAULT_BASE_URL = 'https://api.x.ai/v1'
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000

const GrokSttWordSchema = v.object({
  text: v.string(),
  start: v.number(),
  end: v.number(),
  confidence: v.optional(v.number(), undefined),
  speaker: v.optional(v.union([v.string(), v.number()]), undefined)
})

const GrokSttResponseSchema = v.object({
  text: v.string(),
  language: v.optional(v.string(), undefined),
  duration: v.optional(v.number(), undefined),
  words: v.optional(v.array(GrokSttWordSchema), undefined)
})

const GrokErrorSchema = v.object({
  error: v.optional(v.object({
    message: v.optional(v.string(), undefined)
  }), undefined),
  message: v.optional(v.string(), undefined)
})

type GrokSttResponse = v.InferOutput<typeof GrokSttResponseSchema>
type GrokWord = NonNullable<GrokSttResponse['words']>[number]
type GrokSttHttpError = Error & {
  status?: number | undefined
  headers?: Headers | undefined
  stage?: string | undefined
  retryClass?: RetryClass | undefined
  rawResponse?: unknown
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

const getErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

const readGrokError = async (response: Response): Promise<{ message: string, raw: unknown }> => {
  const rawText = await response.text()
  if (!rawText.trim()) {
    return { message: `HTTP ${response.status}`, raw: rawText }
  }

  try {
    const parsed: unknown = JSON.parse(rawText)
    const validated = validateDataSafe(GrokErrorSchema, parsed)
    if (validated?.error?.message && validated.error.message.trim().length > 0) {
      return { message: validated.error.message, raw: parsed }
    }
    if (validated?.message && validated.message.trim().length > 0) {
      return { message: validated.message, raw: parsed }
    }
    return { message: rawText, raw: parsed }
  } catch {
    return { message: rawText, raw: rawText }
  }
}

const textFromWords = (words: GrokWord[] | undefined): string => {
  if (!words) {
    return ''
  }

  let text = ''
  for (const word of words) {
    const token = word.text.trim()
    if (token.length === 0) {
      continue
    }
    text = appendToken(text, token)
  }

  return text.trim()
}

const normalizeWord = (word: GrokWord): { start: number, end: number, text: string, speaker?: string | undefined } | undefined => {
  const text = word.text.trim()
  if (text.length === 0 || !Number.isFinite(word.start) || !Number.isFinite(word.end)) {
    return undefined
  }

  const speaker = formatSpeakerLabel(word.speaker)
  return {
    start: word.start,
    end: word.end,
    text,
    ...(speaker ? { speaker } : {})
  }
}

const segmentsFromWords = (
  words: GrokWord[] | undefined,
  offsetSeconds: number
): TranscriptionSegment[] => {
  if (!words) {
    return []
  }

  const normalized = words
    .map(normalizeWord)
    .filter((word): word is NonNullable<typeof word> => word !== undefined)

  if (normalized.length === 0) {
    return []
  }

  const segments: TranscriptionSegment[] = []
  let currentSpeaker = normalized[0]?.speaker
  let group: typeof normalized = []

  const flush = (): void => {
    if (group.length === 0) {
      return
    }
    segments.push(...buildSegmentsFromWords(group, offsetSeconds))
    group = []
  }

  for (const word of normalized) {
    if (group.length > 0 && word.speaker !== currentSpeaker) {
      flush()
      currentSpeaker = word.speaker
    }
    group.push(word)
  }

  flush()
  return segments
}

const evidenceWordsFromApi = (
  words: GrokWord[] | undefined,
  offsetSeconds: number
): TranscriptionEvidenceWord[] => {
  if (!words) {
    return []
  }

  const parsed: TranscriptionEvidenceWord[] = []
  for (const word of words) {
    const text = word.text.trim()
    if (text.length === 0 || !Number.isFinite(word.start) || !Number.isFinite(word.end)) {
      continue
    }

    const speaker = formatSpeakerLabel(word.speaker)
    const confidence = typeof word.confidence === 'number' && Number.isFinite(word.confidence)
      ? word.confidence
      : undefined
    parsed.push({
      startSeconds: word.start + offsetSeconds,
      endSeconds: word.end + offsetSeconds,
      text,
      normalized: text.toLowerCase(),
      ...(speaker ? { speaker } : {}),
      ...(confidence !== undefined ? { confidence } : {}),
      timingSource: 'native'
    })
  }

  return parsed
}

const attachGrokErrorContext = (
  error: unknown,
  stage: 'transcribe',
  retryClass: RetryClass
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as GrokSttHttpError).stage = stage
  ;(source as GrokSttHttpError).retryClass = retryClass
  throw source
}

export const runGrokStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { model, segmentOffsetMinutes = 0, segmentNumber, totalSegments } = options
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required for Grok transcription')
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'grok', action: 'started', segmentNumber, totalSegments, model })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const baseURL = trimTrailingSlash(readEnv('XAI_BASE_URL') ?? GROK_DEFAULT_BASE_URL)
  let transcribeMs = 0
  let requestCount = 0
  let retryCount = 0
  let rateLimitCount = 0
  let rawPayload: unknown

  try {
    const transcribeStartedAt = Date.now()
    rawPayload = await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'grok-stt',
        policy: { maxAttempts: 4 },
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        requestCount += 1
        const form = new FormData()
        form.append('format', 'true')
        form.append('language', 'en')
        form.append('diarize', 'true')
        form.append('file', Bun.file(audioPath))

        const response = await fetch(`${baseURL}/stt`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`
          },
          body: form,
          ...(signal ? { signal } : {})
        })

        if (!response.ok) {
          const { message, raw } = await readGrokError(response)
          throw Object.assign(
            new Error(`Grok transcription failed (${response.status}): ${message}`),
            {
              status: response.status,
              headers: response.headers,
              stage: 'transcribe',
              retryClass: 'runtime_http_create_conservative',
              rawResponse: raw
            } satisfies Pick<GrokSttHttpError, 'status' | 'headers' | 'stage' | 'retryClass' | 'rawResponse'>
          )
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
    transcribeMs += Date.now() - transcribeStartedAt
  } catch (error) {
    attachGrokErrorContext(error, 'transcribe', 'runtime_http_create_conservative')
  }

  const payload = validateData(GrokSttResponseSchema, rawPayload, 'Grok STT response')
  const text = payload.text.trim() || textFromWords(payload.words)
  const segments = segmentsFromWords(payload.words, offsetSeconds)
  const evidenceWords = evidenceWordsFromApi(payload.words, offsetSeconds)
  const { finalSegments, finalText } = resolveTranscriptionOutput(segments, text, offsetSeconds)

  await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

  const processingTime = Date.now() - startTime
  const remoteProcessingMs = Math.max(0, processingTime - transcribeMs)
  const metadata: Step2Metadata = {
    transcriptionService: 'grok',
    transcriptionModel: model,
    processingTime,
    tokenCount: countTokens(finalText),
    ...((transcribeMs > 0 || requestCount > 0 || retryCount > 0 || rateLimitCount > 0 || remoteProcessingMs > 0)
      ? {
          timings: {
            ...(transcribeMs > 0 ? { transcribeMs } : {}),
            ...(remoteProcessingMs > 0 ? { remoteProcessingMs } : {}),
            ...(requestCount > 0 ? { requestCount } : {}),
            ...(retryCount > 0 ? { retryCount } : {}),
            ...(rateLimitCount > 0 ? { rateLimitCount } : {})
          }
        }
      : {})
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'grok', action: 'completed', segmentNumber, totalSegments, model, processingTimeMs: processingTime })
  }

  return {
    result: {
      text: finalText,
      segments: finalSegments,
      evidence: {
        ...(evidenceWords.length > 0 ? { words: evidenceWords } : {}),
        capabilities: {
          hasNativeWordTiming: evidenceWords.length > 0,
          hasConfidence: evidenceWords.some((word) => word.confidence !== undefined),
          hasSpeakerLabels: evidenceWords.some((word) => word.speaker !== undefined) || finalSegments.some((segment) => segment.speaker !== undefined)
        },
        timingQuality: evidenceWords.length > 0 ? 'native_word' : 'segment_interpolated',
        rawResponse: payload
      }
    },
    metadata
  }
}
