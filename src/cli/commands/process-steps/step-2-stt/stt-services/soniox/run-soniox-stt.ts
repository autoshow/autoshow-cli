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
const DEFAULT_POLL_DEADLINE_MS = 30 * 60 * 1000
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

const parsePositiveIntegerEnv = (key: string, fallback: number): number => {
  const parsed = Number.parseInt(process.env[key] ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback
  }

  return parsed
}

const buildSonioxUrl = (baseURL: string, path: string): string => new URL(path, baseURL).toString()

const getErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

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
  audioPath: string
): FormData => {
  const form = new FormData()
  form.append('file', Bun.file(audioPath), basename(audioPath))
  return form
}

const uploadAudio = async (
  baseURL: string,
  apiKey: string,
  audioPath: string,
  metrics?: {
    onRequest?: (() => void) | undefined
    onRetry?: ((status: number | undefined) => void) | undefined
  } | undefined
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
        metrics?.onRequest?.()
        const response = await fetch(buildSonioxUrl(baseURL, '/v1/files'), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`
          },
          body: buildUploadForm(audioPath),
          signal: signal ?? null
        })

        if (!response.ok) {
          throw toSonioxHttpError('upload', 'runtime_http_create_conservative', response, await response.text())
        }

        return await response.json()
      },
      (error) => {
        const decision = classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
        if (decision.shouldRetry) {
          metrics?.onRetry?.(getErrorStatus(error))
        }
        return decision
      }
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
  diarizationOptions: DiarizationOptions | undefined,
  metrics?: {
    onRequest?: (() => void) | undefined
    onRetry?: ((status: number | undefined) => void) | undefined
  } | undefined
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
        metrics?.onRequest?.()
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
      (error) => {
        const decision = classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
        if (decision.shouldRetry) {
          metrics?.onRetry?.(getErrorStatus(error))
        }
        return decision
      }
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
  transcriptionId: string,
  metrics?: {
    onRequest?: (() => void) | undefined
    onRetry?: ((status: number | undefined) => void) | undefined
  } | undefined
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
        metrics?.onRequest?.()
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
      (error) => {
        const decision = classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
        if (decision.shouldRetry) {
          metrics?.onRetry?.(getErrorStatus(error))
        }
        return decision
      }
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
  transcriptionId: string,
  metrics?: {
    onRequest?: (() => void) | undefined
    onRetry?: ((status: number | undefined) => void) | undefined
  } | undefined
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
        metrics?.onRequest?.()
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
      (error) => {
        const decision = classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
        if (decision.shouldRetry) {
          metrics?.onRetry?.(getErrorStatus(error))
        }
        return decision
      }
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

const buildPollingDeadlineError = (
  transcriptionId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`Soniox timed out waiting for transcription completion for ${transcriptionId} (deadline exceeded after ${pollDeadlineMs}ms)`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
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
  let uploadMs = 0
  let createMs = 0
  let pollMs = 0
  let pollSleepMs = 0
  let transcriptMs = 0
  let requestCount = 0
  let retryCount = 0
  let rateLimitCount = 0
  let metadata: Step2Metadata | undefined
  const pollDeadlineMs = parsePositiveIntegerEnv(
    'AUTOSHOW_STT_POLL_DEADLINE_MS_SONIOX',
    parsePositiveIntegerEnv('AUTOSHOW_STT_POLL_DEADLINE_MS', DEFAULT_POLL_DEADLINE_MS)
  )
  const requestMetrics = {
    onRequest: () => {
      requestCount += 1
    },
    onRetry: (status: number | undefined) => {
      retryCount += 1
      if (status === 429) {
        rateLimitCount += 1
      }
    }
  }

  let fileId: string | undefined
  let transcriptionId: string | undefined

  try {
    const uploadStartedAt = Date.now()
    fileId = await uploadAudio(baseURL, apiKey, audioPath, requestMetrics)
    uploadMs += Date.now() - uploadStartedAt
    const createStartedAt = Date.now()
    transcriptionId = await createTranscription(baseURL, apiKey, modelName, fileId, diarizationOptions, requestMetrics)
    createMs += Date.now() - createStartedAt

    l.info(`Soniox transcription created: ${transcriptionId}, polling for completion...`)

    let pollDelayMs = INITIAL_POLL_INTERVAL_MS
    const pollDeadlineAt = Date.now() + pollDeadlineMs
    while (true) {
      const remainingBeforeSleep = pollDeadlineAt - Date.now()
      if (remainingBeforeSleep <= 0) {
        buildPollingDeadlineError(transcriptionId, pollDeadlineMs)
      }

      const sleepStartedAt = Date.now()
      await sleep(Math.min(pollDelayMs, remainingBeforeSleep))
      pollSleepMs += Date.now() - sleepStartedAt
      const pollStartedAt = Date.now()
      const pollResult = await pollTranscription(baseURL, apiKey, transcriptionId, requestMetrics)
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
    const transcript = await getTranscriptionTranscript(baseURL, apiKey, transcriptionId, requestMetrics)
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
    const remoteProcessingMs = Math.max(0, processingTime - uploadMs - createMs - pollMs - transcriptMs)
    metadata = {
      transcriptionService: 'soniox',
      transcriptionModel: modelName,
      transcriptionModelName: modelName,
      processingTime,
      tokenCount: countTokens(text),
      ...((uploadMs > 0 || createMs > 0 || pollMs > 0 || pollSleepMs > 0 || transcriptMs > 0 || remoteProcessingMs > 0 || requestCount > 0 || retryCount > 0 || rateLimitCount > 0)
        ? {
            timings: {
              ...(uploadMs > 0 ? { uploadMs } : {}),
              ...(createMs > 0 ? { createMs } : {}),
              ...(pollMs > 0 ? { pollMs } : {}),
              ...(pollSleepMs > 0 ? { pollSleepMs } : {}),
              ...(transcriptMs > 0 ? { transcriptMs } : {}),
              ...(remoteProcessingMs > 0 ? { remoteProcessingMs } : {}),
              ...(requestCount > 0 ? { requestCount } : {}),
              ...(retryCount > 0 ? { retryCount } : {}),
              ...(rateLimitCount > 0 ? { rateLimitCount } : {})
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
      const processingTime = metadata.processingTime
      metadata.timings = {
        ...(metadata.timings ?? {}),
        cleanupMs,
        remoteProcessingMs: Math.max(0, processingTime
          - ((metadata.timings?.uploadMs ?? 0)
          + (metadata.timings?.createMs ?? 0)
          + (metadata.timings?.pollMs ?? 0)
          + (metadata.timings?.transcriptMs ?? 0)
          + cleanupMs))
      }
    }
  }
}
