import { AppError } from '~/utils/error-handler'
import { ANTHROPIC_DEFAULT_BASE_URL } from '~/utils/base-urls'

export { ANTHROPIC_DEFAULT_BASE_URL }
const ANTHROPIC_VERSION = '2023-06-01'
export const ANTHROPIC_FILES_API_BETA = 'files-api-2025-04-14'

export type AnthropicRestConfig = {
  apiKey: string
  baseURL?: string | undefined
}

type AnthropicRequestOptions = {
  signal?: AbortSignal | undefined
  beta?: string | string[] | undefined
}

type AnthropicMessageResponse = {
  model?: string | undefined
  content?: Array<{ type: string, text?: string | undefined } & Record<string, unknown>> | undefined
  usage?: {
    input_tokens?: number | undefined
    output_tokens?: number | undefined
  } & Record<string, unknown> | undefined
} & Record<string, unknown>

type AnthropicFileMetadata = {
  id: string
  type?: string | undefined
  filename?: string | undefined
  mime_type?: string | undefined
  size_bytes?: number | undefined
  created_at?: string | undefined
  downloadable?: boolean | undefined
} & Record<string, unknown>

type AnthropicDeletedFile = {
  id?: string | undefined
  type?: string | undefined
} & Record<string, unknown>

type AnthropicRestError = Error & {
  status: number
  headers: Headers
  body: string
  rawResponse?: unknown
  errorType?: string | undefined
  responseType?: string | undefined
}

type AnthropicFetchOptions = {
  config: AnthropicRestConfig
  path: string
  method?: string | undefined
  headers?: RequestInit['headers'] | undefined
  body?: RequestInit['body'] | undefined
  signal?: AbortSignal | undefined
  beta?: string | string[] | undefined
  errorMessagePrefix: string
}

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '')

const getBetaHeaderValue = (beta: string | string[] | undefined): string | undefined => {
  if (Array.isArray(beta)) {
    const values = beta.map((value) => value.trim()).filter(Boolean)
    return values.length > 0 ? values.join(',') : undefined
  }

  const value = beta?.trim()
  return value ? value : undefined
}

const buildAnthropicUrl = (baseURL: string | undefined, path: string): string => {
  const base = trimTrailingSlashes((baseURL ?? ANTHROPIC_DEFAULT_BASE_URL).trim() || ANTHROPIC_DEFAULT_BASE_URL)
  const pathWithoutLeadingSlash = path.replace(/^\/+/, '')

  try {
    const url = new URL(base)
    url.hash = ''
    url.search = ''
    const basePath = trimTrailingSlashes(url.pathname)
    const requestPath = basePath.endsWith('/v1') && pathWithoutLeadingSlash.startsWith('v1/')
      ? pathWithoutLeadingSlash.slice('v1/'.length)
      : pathWithoutLeadingSlash
    url.pathname = `${basePath}/${requestPath}`.replace(/\/{2,}/g, '/')
    return url.toString()
  } catch {
    const requestPath = base.endsWith('/v1') && pathWithoutLeadingSlash.startsWith('v1/')
      ? pathWithoutLeadingSlash.slice('v1/'.length)
      : pathWithoutLeadingSlash
    return `${base}/${requestPath}`
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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

const extractErrorType = (payload: unknown): string | undefined => {
  if (!isRecord(payload)) return undefined
  const error = payload['error']
  if (isRecord(error) && typeof error['type'] === 'string') {
    return error['type']
  }
  return undefined
}

const extractResponseType = (payload: unknown): string | undefined => {
  if (!isRecord(payload)) return undefined
  return typeof payload['type'] === 'string' ? payload['type'] : undefined
}

const createAnthropicHttpError = async (
  response: Response,
  errorMessagePrefix: string
): Promise<AnthropicRestError> => {
  const rawText = await response.text()
  const rawResponse = parseJsonOrText(rawText)
  const message = extractErrorMessage(rawResponse, rawText, response.status)
  return Object.assign(new Error(`${errorMessagePrefix} (${response.status}): ${message}`), {
    status: response.status,
    headers: response.headers,
    body: rawText,
    rawResponse,
    ...(extractErrorType(rawResponse) ? { errorType: extractErrorType(rawResponse) } : {}),
    ...(extractResponseType(rawResponse) ? { responseType: extractResponseType(rawResponse) } : {})
  } satisfies Omit<AnthropicRestError, keyof Error>)
}

const normalizeAnthropicFetchError = (error: unknown): unknown => {
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

const anthropicFetch = async (options: AnthropicFetchOptions): Promise<Response> => {
  const headers = new Headers(options.headers)
  if (!headers.has('accept')) {
    headers.set('accept', 'application/json')
  }
  headers.set('x-api-key', options.config.apiKey)
  headers.set('anthropic-version', ANTHROPIC_VERSION)

  const beta = getBetaHeaderValue(options.beta)
  if (beta) {
    headers.set('anthropic-beta', beta)
  }

  try {
    const response = await fetch(buildAnthropicUrl(options.config.baseURL, options.path), {
      method: options.method ?? 'POST',
      headers,
      body: options.body,
      ...(options.signal ? { signal: options.signal } : {})
    })

    if (!response.ok) {
      throw await createAnthropicHttpError(response, options.errorMessagePrefix)
    }

    return response
  } catch (error) {
    throw normalizeAnthropicFetchError(error)
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

const extractBetasFromBody = (body: Record<string, unknown>): string[] | undefined => {
  const value = body['betas']
  if (!Array.isArray(value)) {
    return undefined
  }

  const betas = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return betas.length > 0 ? betas : undefined
}

export const createAnthropicMessage = async (
  config: AnthropicRestConfig,
  body: Record<string, unknown>,
  options: AnthropicRequestOptions = {}
): Promise<AnthropicMessageResponse> => {
  const requestBody = { ...body }
  const bodyBetas = extractBetasFromBody(requestBody)
  delete requestBody['betas']

  const response = await anthropicFetch({
    config,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(requestBody),
    signal: options.signal,
    beta: options.beta ?? bodyBetas,
    errorMessagePrefix: 'Anthropic Messages request failed'
  })

  return await readJsonResponse(response, 'Anthropic Messages response') as AnthropicMessageResponse
}

export const uploadAnthropicFile = async (
  config: AnthropicRestConfig,
  file: File,
  options: AnthropicRequestOptions = {}
): Promise<AnthropicFileMetadata> => {
  const form = new FormData()
  form.append('file', file, file.name)

  const response = await anthropicFetch({
    config,
    path: '/v1/files',
    method: 'POST',
    body: form,
    signal: options.signal,
    beta: options.beta ?? ANTHROPIC_FILES_API_BETA,
    errorMessagePrefix: 'Anthropic Files upload failed'
  })

  return await readJsonResponse(response, 'Anthropic Files upload response') as AnthropicFileMetadata
}

export const deleteAnthropicFile = async (
  config: AnthropicRestConfig,
  fileId: string,
  options: AnthropicRequestOptions = {}
): Promise<AnthropicDeletedFile> => {
  const response = await anthropicFetch({
    config,
    path: `/v1/files/${encodeURIComponent(fileId)}`,
    method: 'DELETE',
    signal: options.signal,
    beta: options.beta ?? ANTHROPIC_FILES_API_BETA,
    errorMessagePrefix: 'Anthropic Files delete failed'
  })

  return await readJsonResponse(response, 'Anthropic Files delete response') as AnthropicDeletedFile
}
