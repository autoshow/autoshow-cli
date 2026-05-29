import { MISTRAL_DEFAULT_BASE_URL } from '~/utils/base-urls'
import {
  extractRestErrorMessage,
  normalizeFetchAbortError,
  parseJsonOrText,
  readJsonResponse,
  trimTrailingSlashes
} from '~/utils/rest-client'

export { MISTRAL_DEFAULT_BASE_URL }

type MistralRestError = Error & {
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

const buildMistralUrl = (baseURL: string | undefined, path: string): string => {
  const normalizedBase = normalizeMistralBaseUrl(baseURL ?? MISTRAL_DEFAULT_BASE_URL)
  return new URL(path.replace(/^\/+/, ''), `${normalizedBase}/`).toString()
}

const createMistralHttpError = async (
  response: Response,
  errorMessagePrefix: string
): Promise<MistralRestError> => {
  const rawText = await response.text()
  const rawResponse = parseJsonOrText(rawText)
  const message = extractRestErrorMessage(rawResponse, rawText, response.status)
  return Object.assign(new Error(`${errorMessagePrefix} (${response.status}): ${message}`), {
    status: response.status,
    headers: response.headers,
    body: rawText,
    rawResponse
  } satisfies Pick<MistralRestError, 'status' | 'headers' | 'body' | 'rawResponse'>)
}

const mistralFetch = async (options: MistralFetchOptions): Promise<Response> => {
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
    throw normalizeFetchAbortError(error)
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
