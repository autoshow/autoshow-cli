import { basename } from 'node:path'
import type {
  DiarizationOptions,
  SonioxTranscriptResponse,
  SonioxTranscriptionStatus
} from '~/types'
import {
  SonioxFileResponseSchema,
  SonioxTranscriptResponseSchema,
  SonioxTranscriptionStatusSchema
} from '~/types'
import * as l from '~/utils/logger'
import { logSttCleanupFailure } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import { validateData } from '~/utils/validate/validation'
import {
  attachSonioxErrorContext,
  attachSonioxValidationContext,
  getSonioxErrorStatus,
  toSonioxHttpError,
  type SonioxRequestMetrics
} from './soniox-utils'

const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

const buildSonioxUrl = (baseURL: string, path: string): string => new URL(path, baseURL).toString()

const buildUploadForm = (
  audioPath: string
): FormData => {
  const form = new FormData()
  form.append('file', Bun.file(audioPath), basename(audioPath))
  return form
}

export const uploadAudio = async (
  baseURL: string,
  apiKey: string,
  audioPath: string,
  metrics?: SonioxRequestMetrics | undefined
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
          metrics?.onRetry?.(getSonioxErrorStatus(error))
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

export const createTranscription = async (
  baseURL: string,
  apiKey: string,
  modelName: string,
  fileId: string,
  diarizationOptions: DiarizationOptions | undefined,
  metrics?: SonioxRequestMetrics | undefined
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
          metrics?.onRetry?.(getSonioxErrorStatus(error))
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

export const pollTranscription = async (
  baseURL: string,
  apiKey: string,
  transcriptionId: string,
  metrics?: SonioxRequestMetrics | undefined
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
          metrics?.onRetry?.(getSonioxErrorStatus(error))
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

export const getTranscriptionTranscript = async (
  baseURL: string,
  apiKey: string,
  transcriptionId: string,
  metrics?: SonioxRequestMetrics | undefined
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
          metrics?.onRetry?.(getSonioxErrorStatus(error))
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

export const deleteTranscription = async (
  baseURL: string,
  apiKey: string,
  transcriptionId: string
): Promise<boolean> => {
  try {
    const response = await fetch(buildSonioxUrl(baseURL, `/v1/transcriptions/${transcriptionId}`), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok && response.status !== 404) {
      logSttCleanupFailure(l, {
        provider: 'soniox',
        artifact: 'transcription',
        id: transcriptionId,
        detail: String(response.status)
      })
      return false
    }
    return true
  } catch (error) {
    logSttCleanupFailure(l, {
      provider: 'soniox',
      artifact: 'transcription',
      id: transcriptionId,
      detail: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}

export const deleteFile = async (
  baseURL: string,
  apiKey: string,
  fileId: string
): Promise<boolean> => {
  try {
    const response = await fetch(buildSonioxUrl(baseURL, `/v1/files/${fileId}`), {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    })

    if (!response.ok && response.status !== 404) {
      logSttCleanupFailure(l, {
        provider: 'soniox',
        artifact: 'file',
        id: fileId,
        detail: String(response.status)
      })
      return false
    }
    return true
  } catch (error) {
    logSttCleanupFailure(l, {
      provider: 'soniox',
      artifact: 'file',
      id: fileId,
      detail: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}
