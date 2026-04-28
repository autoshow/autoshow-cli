import type { DeapiStatusPayload } from '~/types'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import {
  buildDeapiUrl,
  createDeapiHttpError,
  extractDeapiErrorMessage,
  getDeapiBaseUrl,
  isRecord,
  readJsonOrText
} from './client'

const DEFAULT_INITIAL_POLL_INTERVAL_MS = 1_000
const DEFAULT_MAX_POLL_INTERVAL_MS = 10_000
const DEFAULT_POLL_DEADLINE_MS = 10 * 60_000
const DEFAULT_POLL_REQUEST_TIMEOUT_MS = 60_000

export const parseRequestId = (payload: unknown): string | undefined => {
  if (!isRecord(payload)) {
    return undefined
  }

  for (const key of ['request_id', 'requestId'] as const) {
    const direct = payload[key]
    if (typeof direct === 'string' && direct.length > 0) {
      return direct
    }
  }

  const data = payload['data']
  if (isRecord(data)) {
    for (const key of ['request_id', 'requestId'] as const) {
      const nested = data[key]
      if (typeof nested === 'string' && nested.length > 0) {
        return nested
      }
    }
  }

  return undefined
}

export const parseStatusPayload = (payload: unknown): DeapiStatusPayload | undefined => {
  const container = isRecord(payload) && isRecord(payload['data'])
    ? payload['data']
    : payload
  if (!isRecord(container)) {
    return undefined
  }

  const status = typeof container['status'] === 'string' && container['status'].length > 0
    ? container['status']
    : (container['result_url'] !== undefined || container['result'] !== undefined ? 'done' : undefined)
  if (!status) {
    return undefined
  }

  return {
    status,
    ...('result' in container ? { result: container['result'] } : {}),
    ...(
      typeof container['result_url'] === 'string'
        ? { resultUrl: container['result_url'] }
        : typeof container['resultUrl'] === 'string'
          ? { resultUrl: container['resultUrl'] }
          : {}
    ),
    raw: payload
  }
}

export const extractResultUrl = (status: DeapiStatusPayload): string | undefined => {
  if (status.resultUrl) {
    return status.resultUrl
  }

  const result = status.result
  if (isRecord(result)) {
    const direct = result['result_url'] ?? result['resultUrl'] ?? result['url']
    if (typeof direct === 'string' && direct.length > 0) {
      return direct
    }
  }

  if (isRecord(status.raw)) {
    const data = status.raw['data']
    if (isRecord(data)) {
      const rawUrl = data['result_url'] ?? data['resultUrl'] ?? data['url']
      if (typeof rawUrl === 'string' && rawUrl.length > 0) {
        return rawUrl
      }
    }
  }

  return undefined
}

export const normalizeParsedResult = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']')))) {
    return value
  }

  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return value
  }
}

export const fetchResultPayload = async (resultUrl: string): Promise<unknown> => {
  const response = await fetch(resultUrl, {
    method: 'GET',
    headers: { accept: 'application/json,text/plain;q=0.9,*/*;q=0.8' }
  })
  if (!response.ok) {
    throw new Error(`deAPI result_url fetch failed (${response.status})`)
  }

  return normalizeParsedResult(await readJsonOrText(response))
}

type PollDeapiJobResult = {
  status: DeapiStatusPayload
  pollCount: number
  pollSleepMs: number
}

export const pollDeapiJob = async (
  options: {
    requestId: string
    apiKey: string
    endpointPath?: string | undefined
    baseURL?: string | undefined
    operationName: string
    deadlineMs?: number | undefined
    initialPollIntervalMs?: number | undefined
    maxPollIntervalMs?: number | undefined
  }
): Promise<PollDeapiJobResult> => {
  const baseURL = options.baseURL ?? getDeapiBaseUrl()
  const endpointPath = options.endpointPath ?? `/api/v2/jobs/${options.requestId}`
  const deadlineMs = options.deadlineMs ?? DEFAULT_POLL_DEADLINE_MS
  const maxPollIntervalMs = options.maxPollIntervalMs ?? DEFAULT_MAX_POLL_INTERVAL_MS
  let delayMs = options.initialPollIntervalMs ?? DEFAULT_INITIAL_POLL_INTERVAL_MS
  let pollCount = 0
  let pollSleepMs = 0
  const startedAt = Date.now()

  while (true) {
    if (Date.now() - startedAt > deadlineMs) {
      throw Object.assign(
        new Error(`deAPI timed out waiting for job completion for ${options.requestId} (deadline exceeded after ${deadlineMs}ms)`),
        {
          stage: 'poll',
          retryClass: 'runtime_http_read',
          retryable: true
        }
      )
    }

    const result = await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: options.operationName,
        policy: { maxAttempts: 6 },
        timeoutMs: DEFAULT_POLL_REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        const response = await fetch(buildDeapiUrl(baseURL, endpointPath), {
          method: 'GET',
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${options.apiKey}`
          },
          signal: signal ?? null
        })

        const payload = await readJsonOrText(response)
        if (!response.ok) {
          throw createDeapiHttpError(
            `deAPI polling failed (${response.status}): ${extractDeapiErrorMessage(payload) ?? 'Unknown error'}`,
            response,
            'poll',
            'runtime_http_read',
            payload
          )
        }

        return {
          payload,
          retryAfterMs: parseRetryAfterMs(response.headers) ?? null
        }
      },
      (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
    )
    pollCount += 1

    const status = parseStatusPayload(result.payload)
    if (!status) {
      throw createDeapiHttpError(
        'Invalid deAPI status payload',
        new Response(null, { status: 502 }),
        'poll',
        'runtime_http_read',
        result.payload
      )
    }

    const normalizedStatus = status.status.toLowerCase()
    if (['done', 'completed', 'success', 'succeeded'].includes(normalizedStatus)) {
      return { status, pollCount, pollSleepMs }
    }

    if (['error', 'failed', 'canceled', 'cancelled'].includes(normalizedStatus)) {
      throw createDeapiHttpError(
        `deAPI job failed: ${extractDeapiErrorMessage(status.raw) ?? 'unknown error'}`,
        new Response(null, { status: 502 }),
        'poll',
        'runtime_http_read',
        status.raw
      )
    }

    const sleepMs = result.retryAfterMs ?? delayMs
    await Bun.sleep(sleepMs)
    pollSleepMs += sleepMs
    delayMs = Math.min(maxPollIntervalMs, Math.ceil(delayMs * 1.5))
  }
}
