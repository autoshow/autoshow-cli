import type { DeepgramAlternative, DeepgramHttpError, DeepgramResponse, DeepgramWords, RetryClass, Step2Metadata, TranscriptionResult, TranscriptionSegment } from '~/types'
import { DeepgramResponseSchema } from '~/types'
import * as l from '~/utils/logger'
import { logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import {
  appendToken,
  buildSegmentsFromWords,
  buildTranscriptionOutputBase,
  countTokens,
  formatSpeakerLabel,
  formatTranscriptText,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const REQUEST_TIMEOUT_MS = 20 * 60 * 1000

const getErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

const attachDeepgramErrorContext = (
  error: unknown,
  stage: 'transcribe',
  retryClass: RetryClass
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as DeepgramHttpError).stage = stage
  ;(source as DeepgramHttpError).retryClass = retryClass
  throw source
}

const inferDeepgramMimeType = (audioPath: string, fallback?: string | undefined): string => {
  const lower = audioPath.toLowerCase()
  if (lower.endsWith('.mp3') || lower.endsWith('.mpga')) return 'audio/mpeg'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.m4a') || lower.endsWith('.mp4')) return 'audio/mp4'
  if (lower.endsWith('.aac')) return 'audio/aac'
  if (lower.endsWith('.flac')) return 'audio/flac'
  if (lower.endsWith('.ogg') || lower.endsWith('.opus')) return 'audio/ogg'
  if (lower.endsWith('.webm')) return 'audio/webm'
  if (lower.endsWith('.mpeg')) return 'audio/mpeg'
  return fallback ?? 'application/octet-stream'
}

const buildDeepgramUrl = (baseURL: string, modelName: string): string => {
  const url = new URL('/v1/listen', baseURL)
  url.searchParams.set('model', modelName)
  url.searchParams.set('diarize', 'true')
  url.searchParams.set('utterances', 'true')
  url.searchParams.set('punctuate', 'true')
  url.searchParams.set('smart_format', 'true')
  return url.toString()
}

const selectPrimaryAlternative = (
  payload: DeepgramResponse
): DeepgramAlternative | undefined => {
  const firstChannel = payload.results.channels[0]
  return firstChannel?.alternatives?.[0]
}

const toTextFromWords = (
  words: DeepgramWords | undefined
): string => {
  if (!words) {
    return ''
  }

  let text = ''
  for (const word of words) {
    const token = (word.punctuated_word ?? word.word ?? '').trim()
    if (token.length === 0) {
      continue
    }
    text = appendToken(text, token)
  }

  return text.trim()
}

const segmentsFromUtterances = (
  utterances: DeepgramResponse['results']['utterances'] | undefined,
  offsetSeconds: number
): TranscriptionSegment[] => {
  if (!utterances) {
    return []
  }

  const segments: TranscriptionSegment[] = []
  for (const utterance of utterances) {
    const text = utterance.transcript.trim()
    if (text.length === 0) {
      continue
    }

    const speaker = formatSpeakerLabel(utterance.speaker)
    segments.push({
      start: toTimestamp(utterance.start + offsetSeconds),
      end: toTimestamp(utterance.end + offsetSeconds),
      text,
      ...(speaker ? { speaker } : {})
    })
  }

  return segments
}

const segmentsFromWords = (
  words: DeepgramWords | undefined,
  offsetSeconds: number
): TranscriptionSegment[] => {
  if (!words) {
    return []
  }

  return buildSegmentsFromWords(
    words
      .map((word) => ({
        start: word.start ?? 0,
        end: word.end ?? word.start ?? 0,
        text: (word.punctuated_word ?? word.word ?? '').trim(),
        speaker: formatSpeakerLabel(word.speaker)
      }))
      .filter((word) => word.text.length > 0),
    offsetSeconds
  )
}

const evidenceWordsFromDeepgram = (
  words: DeepgramWords | undefined,
  offsetSeconds: number
) => {
  if (!words) {
    return []
  }

  return words
    .map((word) => {
      const text = (word.punctuated_word ?? word.word ?? '').trim()
      if (text.length === 0 || typeof word.start !== 'number' || typeof word.end !== 'number') {
        return null
      }

      return {
        startSeconds: word.start + offsetSeconds,
        endSeconds: word.end + offsetSeconds,
        text,
        normalized: text.toLowerCase(),
        ...(word.speaker !== undefined ? { speaker: formatSpeakerLabel(word.speaker) } : {}),
        timingSource: 'native' as const
      }
    })
    .filter((word): word is NonNullable<typeof word> => word !== null)
}

export const runDeepgramTranscribe = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const apiKey = readEnv('DEEPGRAM_API_KEY')
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable is required for Deepgram transcription')
  }

  const { model: modelName, segmentOffsetMinutes = 0, segmentNumber, totalSegments } = options
  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'deepgram', action: 'started', segmentNumber, totalSegments, model: modelName })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  const file = Bun.file(audioPath)
  const mimeType = inferDeepgramMimeType(audioPath, file.type)
  const baseURL = readEnv('DEEPGRAM_BASE_URL') ?? 'https://api.deepgram.com'
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
        operationName: 'deepgram-stt',
        policy: { maxAttempts: 4 },
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        requestCount += 1
        const response = await fetch(buildDeepgramUrl(baseURL, modelName), {
          method: 'POST',
          headers: {
            Authorization: `Token ${apiKey}`,
            'Content-Type': mimeType
          },
          body: file,
          signal: signal ?? null
        })

        if (!response.ok) {
          const errText = await response.text()
          throw Object.assign(
            new Error(`Deepgram transcription failed (${response.status}): ${errText}`),
            {
              status: response.status,
              headers: response.headers,
              stage: 'transcribe',
              retryClass: 'runtime_http_create_conservative'
            } satisfies Pick<DeepgramHttpError, 'status' | 'headers' | 'stage' | 'retryClass'>
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
    attachDeepgramErrorContext(error, 'transcribe', 'runtime_http_create_conservative')
  }

  const payload = validateData(DeepgramResponseSchema, rawPayload, 'Deepgram STT response')
  const primaryAlternative = selectPrimaryAlternative(payload)
  const transcript = (primaryAlternative?.transcript ?? '').trim()
  const utteranceSegments = segmentsFromUtterances(payload.results.utterances, offsetSeconds)
  const wordSegments = segmentsFromWords(primaryAlternative?.words, offsetSeconds)
  const segments = utteranceSegments.length > 0 ? utteranceSegments : wordSegments
  const text = transcript || toTextFromWords(primaryAlternative?.words)

  const { finalSegments, finalText } = resolveTranscriptionOutput(segments, text, offsetSeconds)

  await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

  const processingTime = Date.now() - startTime
  const remoteProcessingMs = Math.max(0, processingTime - transcribeMs)
  const evidenceWords = evidenceWordsFromDeepgram(primaryAlternative?.words, offsetSeconds)
  const metadata: Step2Metadata = {
    transcriptionService: 'deepgram',
    transcriptionModel: modelName,
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
    logSttSegmentLifecycle(l, { provider: 'deepgram', action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
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
          hasConfidence: false,
          hasSpeakerLabels: evidenceWords.some((word) => word.speaker !== undefined) || finalSegments.some((segment) => segment.speaker !== undefined)
        },
        timingQuality: evidenceWords.length > 0 ? 'native_word' : 'segment_interpolated',
        rawResponse: payload
      }
    },
    metadata
  }
}
