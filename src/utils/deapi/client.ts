import type { DeapiHttpError, RetryClass } from '~/types'
import { readEnv } from '~/utils/validate/env-utils'

type DeapiStage = 'create' | 'poll' | 'result' | 'price'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const getDeapiBaseUrl = (): string =>
  readEnv('DEAPI_BASE_URL') ?? 'https://api.deapi.ai'

export const buildDeapiUrl = (baseURL: string, path: string): string =>
  new URL(path.replace(/^\/+/, ''), baseURL.endsWith('/') ? baseURL : `${baseURL}/`).toString()

export const getDeapiApiKey = (): string | undefined => readEnv('DEAPI_API_KEY')

export const ensureDeapiApiKey = (purpose: string): string => {
  const apiKey = getDeapiApiKey()
  if (!apiKey) {
    throw new Error(`DEAPI_API_KEY environment variable is required for ${purpose}`)
  }
  return apiKey
}

export const readJsonOrText = async (response: Response): Promise<unknown> => {
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

export const extractDeapiErrorMessage = (payload: unknown): string | undefined => {
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (!isRecord(payload)) {
    return undefined
  }

  for (const key of ['message', 'error', 'detail'] as const) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  const errors = payload['errors']
  if (Array.isArray(errors)) {
    const firstString = errors.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    if (firstString) {
      return firstString.trim()
    }
  }

  const data = isRecord(payload['data']) ? payload['data'] : undefined
  if (data) {
    for (const key of ['message', 'error', 'detail'] as const) {
      const value = data[key]
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim()
      }
    }
  }

  return undefined
}

export const buildDeapiAuthHeaders = (
  apiKey: string,
  extra?: RequestInit['headers']
): RequestInit['headers'] => {
  const headers = new Headers(extra)
  if (!headers.has('accept')) {
    headers.set('accept', 'application/json')
  }
  headers.set('authorization', `Bearer ${apiKey}`)
  return headers
}

export const attachDeapiErrorContext = (
  error: unknown,
  stage: DeapiStage,
  retryClass: RetryClass,
  rawResponse?: unknown
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as DeapiHttpError).stage = stage
  ;(source as DeapiHttpError).retryClass = retryClass
  if (rawResponse !== undefined) {
    ;(source as DeapiHttpError).body = rawResponse
    ;(source as DeapiHttpError).rawResponse = rawResponse
  }
  throw source
}

export const createDeapiHttpError = (
  message: string,
  response: Response,
  stage: DeapiStage,
  retryClass: RetryClass,
  rawResponse: unknown
): DeapiHttpError => Object.assign(new Error(message), {
  status: response.status,
  headers: response.headers,
  stage,
  retryClass,
  body: rawResponse,
  rawResponse
} satisfies Pick<DeapiHttpError, 'status' | 'headers' | 'stage' | 'retryClass' | 'body' | 'rawResponse'>)

export const deapiFetch = async (
  path: string,
  init: RequestInit & { apiKey: string, baseURL?: string | undefined }
): Promise<Response> => {
  const { apiKey, baseURL, headers, ...rest } = init
  return await fetch(buildDeapiUrl(baseURL ?? getDeapiBaseUrl(), path), {
    ...rest,
    headers: buildDeapiAuthHeaders(apiKey, headers)
  })
}
