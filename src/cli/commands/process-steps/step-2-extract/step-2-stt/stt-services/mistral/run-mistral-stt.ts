import { basename } from 'node:path'
import type { DiarizationOptions, MistralHttpError, RetryClass, Step2Metadata, TranscriptionResult, TranscriptionSegment } from '~/types'
import { MistralTranscriptionResponseSchema } from '~/types'
import * as l from '~/utils/logger'
import { logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import { countTokens, toTimestamp, buildTranscriptionOutputBase, formatTranscriptText, formatSpeakerLabel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { withRetry, classifyFetchRetry, parseRetryAfterMs } from '~/utils/retries'
import { MISTRAL_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { mistralMultipartRequest } from '~/utils/mistral/client'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { createMistralSttPassController } from './mistral-stt-pass-controller'

const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const MISTRAL_RATE_LIMIT_FALLBACK_COOLDOWN_MS = 60_000

const isMistralRetryWrapper = (error: unknown): error is Error & { cause: Error } =>
  error instanceof Error
  && error.cause instanceof Error
  && error.message.startsWith('mistral-stt failed after ')

const getErrorStatus = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status
    if (typeof status === 'number') {
      return status
    }
  }

  return undefined
}

const getErrorHeaders = (error: unknown): Headers | undefined => {
  if (error && typeof error === 'object' && 'headers' in error) {
    const headers = (error as { headers: unknown }).headers
    if (headers instanceof Headers) {
      return headers
    }
  }

  return undefined
}

const resolveMistralRateLimitCooldownMs = (
  error: unknown
): number => parseRetryAfterMs(getErrorHeaders(error)) ?? MISTRAL_RATE_LIMIT_FALLBACK_COOLDOWN_MS

const throwMistralErrorWithContext = (
  error: unknown,
  stage: 'transcribe',
  retryClass: RetryClass
): never => {
  if (isMistralRetryWrapper(error)) {
    ;(error.cause as MistralHttpError).stage = stage
    ;(error.cause as MistralHttpError).retryClass = retryClass
    throw error.cause
  }

  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as MistralHttpError).stage = stage
  ;(source as MistralHttpError).retryClass = retryClass
  throw source
}

const readSpeakerId = (segment: {
  speakerId?: string | number | null | undefined
  speaker_id?: string | number | null | undefined
}): string | number | undefined => {
  if (segment.speakerId !== undefined && segment.speakerId !== null) {
    return segment.speakerId
  }
  if (segment.speaker_id !== undefined && segment.speaker_id !== null) {
    return segment.speaker_id
  }
  return undefined
}

const toSegments = (
  rawSegments: Array<{
    start: number
    end: number
    text: string
    speakerId?: string | number | null | undefined
    speaker_id?: string | number | null | undefined
  }>,
  offsetSeconds: number
): TranscriptionSegment[] => {
  const parsed: TranscriptionSegment[] = []
  for (const segment of rawSegments) {
    const text = segment.text.trim()
    if (text.length === 0) {
      continue
    }
    const speakerId = readSpeakerId(segment)
    parsed.push({
      start: toTimestamp(segment.start + offsetSeconds),
      end: toTimestamp(segment.end + offsetSeconds),
      text,
      ...(speakerId !== undefined ? { speaker: formatSpeakerLabel(speakerId) } : {})
    })
  }
  return parsed
}

export const runMistralStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    diarizationOptions?: DiarizationOptions | undefined
    passController?: import('./mistral-stt-pass-controller').MistralSttPassController | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const apiKey = readEnv('MISTRAL_API_KEY')
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY environment variable is required for Mistral transcription')
  }

  const { model: modelName, segmentOffsetMinutes = 0, segmentNumber, totalSegments } = options
  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'mistral', action: 'started', segmentNumber, totalSegments, model: modelName })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const fileBytes = await Bun.file(audioPath).arrayBuffer()
  const baseURL = MISTRAL_DEFAULT_BASE_URL
  const passController = options.passController ?? createMistralSttPassController()
  let transcribeMs = 0

  let rawPayload: unknown
  try {
    const transcribeStartedAt = Date.now()
    rawPayload = await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'mistral-stt',
        policy: { maxAttempts: 4 },
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        return await passController.withRequestSlot(async () => {
          try {
            const form = new FormData()
            form.append('model', modelName)
            form.append('file', new File([fileBytes], basename(audioPath)))
            form.append('diarize', 'true')
            form.append('timestamp_granularities', 'segment')
            return await mistralMultipartRequest({
              apiKey,
              baseURL,
              path: '/audio/transcriptions',
              form,
              signal,
              errorMessagePrefix: 'Mistral transcription failed'
            })
          } catch (error) {
            if (getErrorStatus(error) === 429) {
              passController.noteRateLimit(resolveMistralRateLimitCooldownMs(error))
            }
            throw error
          }
        })
      },
      (error) => {
        if (getErrorStatus(error) === 429) {
          return {
            shouldRetry: true,
            delayMs: resolveMistralRateLimitCooldownMs(error),
            reason: 'retryable status 429'
          }
        }

        return classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
      }
    )
    transcribeMs += Date.now() - transcribeStartedAt
  } catch (error) {
    throwMistralErrorWithContext(error, 'transcribe', 'runtime_http_create_conservative')
  }

  const payload = validateData(MistralTranscriptionResponseSchema, rawPayload, 'Mistral STT response')
  const segments = toSegments(payload.segments ?? [], offsetSeconds)
  if (segments.every(seg => seg.speaker === undefined)) {
    l.warn('Mistral diarization is enabled but the API returned no speaker labels for this audio')
  }
  const textFromPayload = (payload.text ?? '').trim()
  const text = textFromPayload.length > 0 ? textFromPayload : segments.map(seg => seg.text).join(' ').trim()

  const finalSegments = segments.length > 0
    ? segments
    : [{
        start: toTimestamp(offsetSeconds),
        end: toTimestamp(offsetSeconds),
        text
      }]

  const formattedTranscriptPath = `${outputBase}.txt`
  await Bun.write(formattedTranscriptPath, formatTranscriptText(finalSegments))

  const processingTime = Date.now() - startTime
  const metadata: Step2Metadata = {
    transcriptionService: 'mistral',
    transcriptionModel: modelName,
    processingTime,
    tokenCount: countTokens(text),
    ...(transcribeMs > 0 ? { timings: { transcribeMs } } : {})
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'mistral', action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
  }

  return {
    result: {
      text,
      segments: finalSegments,
      evidence: {
        capabilities: {
          hasNativeWordTiming: false,
          hasConfidence: false,
          hasSpeakerLabels: finalSegments.some((segment) => segment.speaker !== undefined)
        },
        timingQuality: 'segment_interpolated',
        rawResponse: payload
      }
    },
    metadata
  }
}
