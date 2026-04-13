import type { DeepgramResponse, RetryClass, Step2Metadata, TranscriptionResult, TranscriptionSegment } from '~/types'
import { DeepgramResponseSchema } from '~/types'
import * as l from '~/logger'
import {
  appendToken,
  buildSegmentsFromWords,
  buildTranscriptionOutputBase,
  countTokens,
  formatSpeakerLabel,
  formatTranscriptText,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const REQUEST_TIMEOUT_MS = 20 * 60 * 1000

type DeepgramHttpError = Error & {
  status: number
  headers: Headers
  stage?: 'transcribe'
  retryClass?: RetryClass
}

type DeepgramAlternative = NonNullable<DeepgramResponse['results']['channels'][number]['alternatives']>[number]
type DeepgramWords = DeepgramAlternative['words']

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
  const apiKey = readEnvFallback('DEEPGRAM_API_KEY')
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY environment variable is required for Deepgram transcription')
  }

  const { model: modelName, segmentOffsetMinutes = 0, segmentNumber, totalSegments } = options
  if (segmentNumber && totalSegments) {
    l.info(`Transcribing segment ${segmentNumber}/${totalSegments} with Deepgram model: ${modelName}`)
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  const file = Bun.file(audioPath)
  const audioBuffer = await file.arrayBuffer()
  const mimeType = inferDeepgramMimeType(audioPath, file.type)
  const baseURL = readEnv('DEEPGRAM_BASE_URL') ?? 'https://api.deepgram.com'
  let transcribeMs = 0

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
        const response = await fetch(buildDeepgramUrl(baseURL, modelName), {
          method: 'POST',
          headers: {
            Authorization: `Token ${apiKey}`,
            'Content-Type': mimeType
          },
          body: audioBuffer,
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
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
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
  const metadata: Step2Metadata = {
    transcriptionService: 'deepgram',
    transcriptionModel: modelName,
    transcriptionModelName: modelName,
    processingTime,
    tokenCount: countTokens(finalText),
    ...(transcribeMs > 0 ? { timings: { transcribeMs } } : {})
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
}
