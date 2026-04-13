import { basename } from 'node:path'
import type {
  DiarizationOptions,
  RetryClass,
  SonioxTranscriptResponse,
  SonioxTranscriptionStatus,
  Step2Metadata,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import {
  SonioxFileResponseSchema,
  SonioxTranscriptResponseSchema,
  SonioxTranscriptionStatusSchema
} from '~/types'
import * as l from '~/logger'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatSpeakerLabel,
  formatTranscriptText,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000
const INITIAL_POLL_INTERVAL_MS = 1000
const MAX_POLL_INTERVAL_MS = 10000
const SILENCE_BREAK_MS = 1500
const MIN_SENTENCE_SEGMENT_CHARS = 80
const MAX_SEGMENT_CHARS = 220

type SonioxHttpError = Error & {
  status: number
  headers: Headers
  stage?: 'upload' | 'create' | 'poll' | 'transcript'
  retryClass?: RetryClass
  rawResponse?: unknown
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

const buildSonioxUrl = (baseURL: string, path: string): string => new URL(path, baseURL).toString()

const inferSonioxMimeType = (audioPath: string, fallback?: string | undefined): string => {
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

const toSonioxHttpError = (
  stage: 'upload' | 'create' | 'poll' | 'transcript',
  retryClass: RetryClass,
  response: Response,
  errText: string
): SonioxHttpError => Object.assign(
  new Error(`Soniox ${stage} failed (${response.status}): ${errText}`),
  {
    status: response.status,
    headers: response.headers,
    stage,
    retryClass
  }
)

const attachSonioxErrorContext = (
  error: unknown,
  stage: 'upload' | 'create' | 'poll' | 'transcript',
  retryClass: RetryClass
): never => {
  if (error instanceof Error && error.cause instanceof Error) {
    ;(error.cause as SonioxHttpError).stage = stage
    ;(error.cause as SonioxHttpError).retryClass = retryClass
    throw error.cause
  }

  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as SonioxHttpError).stage = stage
  ;(source as SonioxHttpError).retryClass = retryClass
  throw source
}

const attachSonioxValidationContext = (
  error: unknown,
  stage: 'upload' | 'create' | 'poll' | 'transcript',
  retryClass: RetryClass,
  rawResponse: unknown
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as SonioxHttpError).stage = stage
  ;(source as SonioxHttpError).retryClass = retryClass
  ;(source as SonioxHttpError).rawResponse = rawResponse
  throw source
}

const buildUploadForm = (
  audioPath: string,
  bytes: Uint8Array,
  mimeType: string
): FormData => {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: mimeType }), basename(audioPath))
  return form
}

const uploadAudio = async (
  baseURL: string,
  apiKey: string,
  audioPath: string,
  bytes: Uint8Array,
  mimeType: string
): Promise<string> => {
  let rawPayload: unknown
  try {
    rawPayload = await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'soniox-upload',
        policy: { maxAttempts: 4 },
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        const response = await fetch(buildSonioxUrl(baseURL, '/v1/files'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`
          },
          body: buildUploadForm(audioPath, bytes, mimeType),
          signal: signal ?? null
        })

        if (!response.ok) {
          throw toSonioxHttpError('upload', 'runtime_http_create_conservative', response, await response.text())
        }

        return await response.json()
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
    )
  } catch (error) {
    attachSonioxErrorContext(error, 'upload', 'runtime_http_create_conservative')
  }

  let payload!: { id: string }
  try {
    payload = validateData(SonioxFileResponseSchema, rawPayload, 'Soniox upload response')
  } catch (error) {
    attachSonioxValidationContext(error, 'upload', 'runtime_http_create_conservative', rawPayload)
  }

  return payload.id
}

const createTranscription = async (
  baseURL: string,
  apiKey: string,
  modelName: string,
  fileId: string,
  diarizationOptions: DiarizationOptions | undefined
): Promise<string> => {
  const body = {
    model: modelName,
    file_id: fileId,
    enable_speaker_diarization: diarizationOptions?.enabled !== false
  }

  let rawPayload: unknown
  try {
    rawPayload = await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'soniox-create-transcription',
        policy: { maxAttempts: 4 },
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        const response = await fetch(buildSonioxUrl(baseURL, '/v1/transcriptions'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body),
          signal: signal ?? null
        })

        if (!response.ok) {
          throw toSonioxHttpError('create', 'runtime_http_create_conservative', response, await response.text())
        }

        return await response.json()
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
    )
  } catch (error) {
    attachSonioxErrorContext(error, 'create', 'runtime_http_create_conservative')
  }

  let payload!: SonioxTranscriptionStatus
  try {
    payload = validateData(SonioxTranscriptionStatusSchema, rawPayload, 'Soniox transcription create response')
  } catch (error) {
    attachSonioxValidationContext(error, 'create', 'runtime_http_create_conservative', rawPayload)
  }

  return payload.id
}

const pollTranscription = async (
  baseURL: string,
  apiKey: string,
  transcriptionId: string
): Promise<{ retryAfterMs: number | null, status: SonioxTranscriptionStatus }> => {
  let pollResult!: { payload: unknown, retryAfterMs: number | null }
  try {
    pollResult = await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'soniox-poll-transcription',
        policy: { maxAttempts: 6 },
        timeoutMs: POLL_REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        const response = await fetch(buildSonioxUrl(baseURL, `/v1/transcriptions/${transcriptionId}`), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`
          },
          signal: signal ?? null
        })

        if (!response.ok) {
          throw toSonioxHttpError('poll', 'runtime_http_read', response, await response.text())
        }

        return {
          payload: await response.json(),
          retryAfterMs: parseRetryAfterMs(response.headers) ?? null
        }
      },
      (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
    )
  } catch (error) {
    attachSonioxErrorContext(error, 'poll', 'runtime_http_read')
  }

  let status!: SonioxTranscriptionStatus
  try {
    status = validateData(SonioxTranscriptionStatusSchema, pollResult.payload, 'Soniox transcription status')
  } catch (error) {
    attachSonioxValidationContext(error, 'poll', 'runtime_http_read', pollResult.payload)
  }

  return {
    retryAfterMs: pollResult.retryAfterMs,
    status
  }
}

const getTranscriptionTranscript = async (
  baseURL: string,
  apiKey: string,
  transcriptionId: string
): Promise<SonioxTranscriptResponse> => {
  let rawPayload: unknown
  try {
    rawPayload = await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'soniox-get-transcript',
        policy: { maxAttempts: 6 },
        timeoutMs: POLL_REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        const response = await fetch(buildSonioxUrl(baseURL, `/v1/transcriptions/${transcriptionId}/transcript`), {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`
          },
          signal: signal ?? null
        })

        if (!response.ok) {
          throw toSonioxHttpError('transcript', 'runtime_http_read', response, await response.text())
        }

        return await response.json()
      },
      (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
    )
  } catch (error) {
    attachSonioxErrorContext(error, 'transcript', 'runtime_http_read')
  }

  try {
    return validateData(SonioxTranscriptResponseSchema, rawPayload, 'Soniox transcript response')
  } catch (error) {
    return attachSonioxValidationContext(error, 'transcript', 'runtime_http_read', rawPayload)
  }
}

const deleteTranscription = async (
  baseURL: string,
  apiKey: string,
  transcriptionId: string
): Promise<void> => {
  try {
    const response = await fetch(buildSonioxUrl(baseURL, `/v1/transcriptions/${transcriptionId}`), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok && response.status !== 404) {
      l.warn(`Soniox cleanup failed for transcription ${transcriptionId} (${response.status})`)
    }
  } catch (error) {
    l.warn(`Soniox cleanup failed for transcription ${transcriptionId}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const deleteFile = async (
  baseURL: string,
  apiKey: string,
  fileId: string
): Promise<void> => {
  try {
    const response = await fetch(buildSonioxUrl(baseURL, `/v1/files/${fileId}`), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok && response.status !== 404) {
      l.warn(`Soniox cleanup failed for file ${fileId} (${response.status})`)
    }
  } catch (error) {
    l.warn(`Soniox cleanup failed for file ${fileId}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const toSegments = (
  tokens: SonioxTranscriptResponse['tokens'],
  offsetSeconds: number
): TranscriptionSegment[] => {
  const segments: TranscriptionSegment[] = []

  let currentText = ''
  let currentSpeaker: string | undefined
  let segmentStartMs: number | null = null
  let segmentEndMs: number | null = null
  let lastEndMs: number | undefined

  const flush = (): void => {
    const text = currentText.trim()
    if (text.length === 0) {
      currentText = ''
      currentSpeaker = undefined
      segmentStartMs = null
      segmentEndMs = null
      return
    }

    const startSeconds = ((segmentStartMs ?? 0) / 1000) + offsetSeconds
    const endSeconds = ((segmentEndMs ?? segmentStartMs ?? 0) / 1000) + offsetSeconds
    segments.push({
      start: toTimestamp(startSeconds),
      end: toTimestamp(endSeconds),
      text,
      ...(currentSpeaker ? { speaker: currentSpeaker } : {})
    })

    currentText = ''
    currentSpeaker = undefined
    segmentStartMs = null
    segmentEndMs = null
  }

  for (const token of tokens) {
    if (token.text.length === 0) {
      continue
    }

    const startMs: number = token.start_ms ?? segmentEndMs ?? 0
    const endMs: number = token.end_ms ?? startMs
    const speaker = formatSpeakerLabel(token.speaker)
    const speakerChanged = currentText.trim().length > 0 && speaker !== currentSpeaker
    const gapBreak = currentText.trim().length > 0 && lastEndMs !== undefined && startMs - lastEndMs > SILENCE_BREAK_MS

    if (speakerChanged || gapBreak) {
      flush()
    }

    if (segmentStartMs === null) {
      segmentStartMs = startMs
    }

    if (currentSpeaker === undefined && speaker !== undefined) {
      currentSpeaker = speaker
    }

    currentText += token.text
    segmentEndMs = endMs
    lastEndMs = endMs

    const trimmed = currentText.trimEnd()
    if ((trimmed.length >= MIN_SENTENCE_SEGMENT_CHARS && /[.!?]["')\]]?$/.test(trimmed)) || trimmed.length >= MAX_SEGMENT_CHARS) {
      flush()
    }
  }

  flush()
  return segments
}

export const runSonioxStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    diarizationOptions?: DiarizationOptions | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const apiKey = readEnvFallback('SONIOX_API_KEY')
  if (!apiKey) {
    throw new Error('SONIOX_API_KEY environment variable is required for Soniox transcription')
  }

  const { model: modelName, segmentOffsetMinutes = 0, segmentNumber, totalSegments, diarizationOptions } = options
  if (segmentNumber && totalSegments) {
    l.info(`Transcribing segment ${segmentNumber}/${totalSegments} with Soniox model: ${modelName}`)
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const baseURL = readEnv('SONIOX_BASE_URL') ?? 'https://api.soniox.com'
  const audioFile = Bun.file(audioPath)
  const audioBytes = new Uint8Array(await audioFile.arrayBuffer())
  const mimeType = inferSonioxMimeType(audioPath, audioFile.type)
  let uploadMs = 0
  let createMs = 0
  let pollMs = 0
  let transcriptMs = 0
  let metadata: Step2Metadata | undefined

  let fileId: string | undefined
  let transcriptionId: string | undefined

  try {
    const uploadStartedAt = Date.now()
    fileId = await uploadAudio(baseURL, apiKey, audioPath, audioBytes, mimeType)
    uploadMs += Date.now() - uploadStartedAt
    const createStartedAt = Date.now()
    transcriptionId = await createTranscription(baseURL, apiKey, modelName, fileId, diarizationOptions)
    createMs += Date.now() - createStartedAt

    l.info(`Soniox transcription created: ${transcriptionId}, polling for completion...`)

    let pollDelayMs = INITIAL_POLL_INTERVAL_MS
    while (true) {
      await sleep(pollDelayMs)
      const pollStartedAt = Date.now()
      const pollResult = await pollTranscription(baseURL, apiKey, transcriptionId)
      pollMs += Date.now() - pollStartedAt
      if (pollResult.status.status === 'completed') {
        break
      }
      if (pollResult.status.status === 'error') {
        throw new Error(`Soniox transcription failed: ${pollResult.status.error_message ?? pollResult.status.error_type ?? 'unknown error'}`)
      }

      pollDelayMs = pollResult.retryAfterMs !== null
        ? Math.min(MAX_POLL_INTERVAL_MS, Math.max(INITIAL_POLL_INTERVAL_MS, pollResult.retryAfterMs))
        : Math.min(MAX_POLL_INTERVAL_MS, pollDelayMs * 2)
    }

    const transcriptStartedAt = Date.now()
    const transcript = await getTranscriptionTranscript(baseURL, apiKey, transcriptionId)
    transcriptMs += Date.now() - transcriptStartedAt
    const text = transcript.text.trim().length > 0
      ? transcript.text.trim()
      : transcript.tokens.map((token) => token.text).join('').trim()
    const segments = toSegments(transcript.tokens, offsetSeconds)
    const finalSegments = segments.length > 0
      ? segments
      : [{
          start: toTimestamp(offsetSeconds),
          end: toTimestamp(offsetSeconds),
          text
        }]

    await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

    const processingTime = Date.now() - startTime
    metadata = {
      transcriptionService: 'soniox',
      transcriptionModel: modelName,
      transcriptionModelName: modelName,
      processingTime,
      tokenCount: countTokens(text),
      ...((uploadMs > 0 || createMs > 0 || pollMs > 0 || transcriptMs > 0)
        ? {
            timings: {
              ...(uploadMs > 0 ? { uploadMs } : {}),
              ...(createMs > 0 ? { createMs } : {}),
              ...(pollMs > 0 ? { pollMs } : {}),
              ...(transcriptMs > 0 ? { transcriptMs } : {})
            }
          }
        : {})
    }

    if (segmentNumber && totalSegments) {
      l.success(`Segment ${segmentNumber}/${totalSegments} transcription completed in ${processingTime}ms`)
    }

    const result: TranscriptionResult = {
      text,
      segments: finalSegments
    }

    return { result, metadata }
  } finally {
    const cleanupStartedAt = Date.now()
    if (transcriptionId) {
      await deleteTranscription(baseURL, apiKey, transcriptionId)
    }
    if (fileId) {
      await deleteFile(baseURL, apiKey, fileId)
    }
    const cleanupMs = Date.now() - cleanupStartedAt
    if (metadata && cleanupMs > 0) {
      metadata.timings = {
        ...(metadata.timings ?? {}),
        cleanupMs
      }
    }
  }
}
