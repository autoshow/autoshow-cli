import { AppError } from '~/utils/error-handler'
import { MISTRAL_DEFAULT_BASE_URL } from '~/utils/base-urls'

export { MISTRAL_DEFAULT_BASE_URL }

export type MistralRestError = Error & {
  status: number
  headers: Headers
  body: string
  rawResponse?: unknown
}

type MistralFetchOptions = {
  apiKey: string
  baseURL?: string | undefined
  path: string
  method?: string | undefined
  headers?: RequestInit['headers'] | undefined
  body?: RequestInit['body'] | undefined
  signal?: AbortSignal | undefined
  timeoutMs?: number | undefined
  errorMessagePrefix: string
}

type MistralJsonRequestOptions = Omit<MistralFetchOptions, 'body' | 'headers' | 'method'> & {
  body: unknown
}

type MistralMultipartRequestOptions = Omit<MistralFetchOptions, 'body' | 'headers' | 'method'> & {
  form: FormData
}

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '')

export const normalizeMistralBaseUrl = (baseURL: string): string => {
  const trimmed = baseURL.trim()
  if (trimmed.length === 0) {
    return MISTRAL_DEFAULT_BASE_URL
  }

  try {
    const url = new URL(trimmed)
    url.hash = ''
    url.search = ''
    const pathname = trimTrailingSlashes(url.pathname)
    url.pathname = pathname.endsWith('/v1')
      ? pathname
      : `${pathname}/v1`.replace(/\/{2,}/g, '/')
    return trimTrailingSlashes(url.toString())
  } catch {
    const withoutTrailingSlash = trimTrailingSlashes(trimmed)
    return withoutTrailingSlash.endsWith('/v1')
      ? withoutTrailingSlash
      : `${withoutTrailingSlash}/v1`
  }
}

export const buildMistralUrl = (baseURL: string | undefined, path: string): string => {
  const normalizedBase = normalizeMistralBaseUrl(baseURL ?? MISTRAL_DEFAULT_BASE_URL)
  return new URL(path.replace(/^\/+/, ''), `${normalizedBase}/`).toString()
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const extractErrorMessage = (payload: unknown, rawText: string, status: number): string => {
  if (isRecord(payload)) {
    const error = payload['error']
    if (isRecord(error)) {
      const message = error['message']
      if (typeof message === 'string' && message.trim().length > 0) {
        return message.trim()
      }
    }

    for (const key of ['message', 'detail', 'error'] as const) {
      const value = payload[key]
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim()
      }
    }
  }

  return rawText.trim() || `HTTP ${status}`
}

const parseJsonOrText = (rawText: string): unknown => {
  if (rawText.trim().length === 0) {
    return {}
  }

  try {
    return JSON.parse(rawText) as unknown
  } catch {
    return rawText
  }
}

export const createMistralHttpError = async (
  response: Response,
  errorMessagePrefix: string
): Promise<MistralRestError> => {
  const rawText = await response.text()
  const rawResponse = parseJsonOrText(rawText)
  const message = extractErrorMessage(rawResponse, rawText, response.status)
  return Object.assign(new Error(`${errorMessagePrefix} (${response.status}): ${message}`), {
    status: response.status,
    headers: response.headers,
    body: rawText,
    rawResponse
  } satisfies Pick<MistralRestError, 'status' | 'headers' | 'body' | 'rawResponse'>)
}

const normalizeMistralFetchError = (error: unknown): unknown => {
  if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    const abortError = new Error(error.message)
    abortError.name = 'AbortError'
    return abortError
  }

  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    const abortError = new Error(error.message)
    abortError.name = 'AbortError'
    return abortError
  }

  return error
}

export const mistralFetch = async (options: MistralFetchOptions): Promise<Response> => {
  const headers = new Headers(options.headers)
  if (!headers.has('accept')) {
    headers.set('accept', 'application/json')
  }
  headers.set('authorization', `Bearer ${options.apiKey}`)

  const signal = options.signal
    ?? (typeof options.timeoutMs === 'number' ? AbortSignal.timeout(options.timeoutMs) : undefined)

  try {
    const response = await fetch(buildMistralUrl(options.baseURL, options.path), {
      method: options.method ?? 'POST',
      headers,
      body: options.body,
      ...(signal ? { signal } : {})
    })

    if (!response.ok) {
      throw await createMistralHttpError(response, options.errorMessagePrefix)
    }

    return response
  } catch (error) {
    throw normalizeMistralFetchError(error)
  }
}

const readJsonResponse = async (response: Response, errorMessagePrefix: string): Promise<unknown> => {
  const rawText = await response.text()
  if (rawText.trim().length === 0) {
    return {}
  }

  try {
    return JSON.parse(rawText) as unknown
  } catch (error) {
    throw new AppError(`${errorMessagePrefix} returned invalid JSON: ${rawText.slice(0, 500)}`, {
      kind: 'validation',
      cause: error instanceof Error ? error : new Error(String(error)),
      status: response.status,
      metadata: {
        body: rawText,
        rawResponse: rawText
      }
    })
  }
}

export const mistralJsonRequest = async <T = unknown>(
  options: MistralJsonRequestOptions
): Promise<T> => {
  const response = await mistralFetch({
    ...options,
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(options.body)
  })
  return await readJsonResponse(response, options.errorMessagePrefix) as T
}

export const mistralMultipartRequest = async <T = unknown>(
  options: MistralMultipartRequestOptions
): Promise<T> => {
  const response = await mistralFetch({
    ...options,
    body: options.form
  })
  return await readJsonResponse(response, options.errorMessagePrefix) as T
}
