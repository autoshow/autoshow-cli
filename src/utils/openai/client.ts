import { AppError } from '~/utils/error-handler'
import { OPENAI_DEFAULT_BASE_URL } from '~/utils/base-urls'

export { OPENAI_DEFAULT_BASE_URL }

export type OpenAIRestConfig = {
  apiKey: string
  baseURL?: string | undefined
}

type OpenAIRequestOptions = {
  signal?: AbortSignal | undefined
  errorMessagePrefix?: string | undefined
}

type OpenAIResponsesResponse = {
  id?: string | undefined
  model?: string | undefined
  status?: string | undefined
  error?: unknown
  incomplete_details?: unknown
  output_text?: string | undefined
  output?: unknown[] | undefined
  usage?: {
    input_tokens?: number | undefined
    output_tokens?: number | undefined
    [key: string]: unknown
  } | undefined
  [key: string]: unknown
}

export type OpenAIChatCompletionResponse = {
  model?: string | undefined
  choices?: Array<{
    finish_reason?: string | null | undefined
    message?: {
      content?: unknown
      [key: string]: unknown
    } | undefined
    [key: string]: unknown
  }> | undefined
  usage?: {
    prompt_tokens?: number | undefined
    completion_tokens?: number | undefined
    total_tokens?: number | undefined
    [key: string]: unknown
  } | undefined
  [key: string]: unknown
}

export type OpenAIImageResponse = {
  data?: Array<{
    b64_json?: string | undefined
    url?: string | undefined
    mime_type?: string | null | undefined
    revised_prompt?: string | undefined
    [key: string]: unknown
  }> | undefined
  usage?: Record<string, unknown> | undefined
  size?: string | undefined
  quality?: string | undefined
  model?: string | undefined
  revised_prompt?: string | undefined
  [key: string]: unknown
}

type OpenAIFetchOptions = {
  config: OpenAIRestConfig
  path: string
  method?: string | undefined
  headers?: RequestInit['headers'] | undefined
  body?: RequestInit['body'] | undefined
  signal?: AbortSignal | undefined
  errorMessagePrefix: string
}

type OpenAIErrorFields = {
  error?: unknown
  code?: string
  param?: string
  type?: string
}

export class OpenAIRestError extends Error {
  status: number
  headers: Headers
  body: string
  rawResponse: unknown
  error?: unknown
  code?: string
  param?: string
  type?: string

  constructor(
    message: string,
    status: number,
    headers: Headers,
    body: string,
    rawResponse: unknown,
    fields: OpenAIErrorFields = {}
  ) {
    super(message)
    this.name = 'OpenAIRestError'
    this.status = status
    this.headers = headers
    this.body = body
    this.rawResponse = rawResponse

    if (fields.error !== undefined) this.error = fields.error
    if (fields.code !== undefined) this.code = fields.code
    if (fields.param !== undefined) this.param = fields.param
    if (fields.type !== undefined) this.type = fields.type
  }
}

const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '')

const buildOpenAIUrl = (baseURL: string | undefined, path: string): string => {
  const base = trimTrailingSlashes((baseURL ?? OPENAI_DEFAULT_BASE_URL).trim() || OPENAI_DEFAULT_BASE_URL)
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
  typeof value === 'object' && value !== null

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

const extractErrorFields = (payload: unknown): OpenAIErrorFields => {
  if (!isRecord(payload)) return {}
  const error = payload['error']
  if (!isRecord(error)) return {}

  const fields: OpenAIErrorFields = { error }
  if (typeof error['code'] === 'string') fields.code = error['code']
  if (typeof error['param'] === 'string') fields.param = error['param']
  if (typeof error['type'] === 'string') fields.type = error['type']
  return fields
}

const createOpenAIHttpError = async (
  response: Response,
  errorMessagePrefix: string
): Promise<OpenAIRestError> => {
  const rawText = await response.text()
  const rawResponse = parseJsonOrText(rawText)
  const message = extractErrorMessage(rawResponse, rawText, response.status)
  return new OpenAIRestError(
    `${errorMessagePrefix} (${response.status}): ${message}`,
    response.status,
    response.headers,
    rawText,
    rawResponse,
    extractErrorFields(rawResponse)
  )
}

const normalizeOpenAIFetchError = (error: unknown): unknown => {
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

const openAIFetch = async (options: OpenAIFetchOptions): Promise<Response> => {
  const headers = new Headers(options.headers)
  headers.set('authorization', `Bearer ${options.config.apiKey}`)

  try {
    const response = await fetch(buildOpenAIUrl(options.config.baseURL, options.path), {
      method: options.method ?? 'POST',
      headers,
      body: options.body,
      ...(options.signal ? { signal: options.signal } : {})
    })

    if (!response.ok) {
      throw await createOpenAIHttpError(response, options.errorMessagePrefix)
    }

    return response
  } catch (error) {
    throw normalizeOpenAIFetchError(error)
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

export const openAIJsonRequest = async <T = Record<string, unknown>>(
  config: OpenAIRestConfig,
  path: string,
  body: Record<string, unknown>,
  options: OpenAIRequestOptions = {}
): Promise<T> => {
  const response = await openAIFetch({
    config,
    path,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI request failed'
  })
  return await readJsonResponse(response, options.errorMessagePrefix ?? 'OpenAI response') as T
}

const openAIBinaryJsonRequest = async (
  config: OpenAIRestConfig,
  path: string,
  body: Record<string, unknown>,
  options: OpenAIRequestOptions = {}
): Promise<Uint8Array> => {
  const response = await openAIFetch({
    config,
    path,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI request failed'
  })
  return new Uint8Array(await response.arrayBuffer())
}

const openAIMultipartRequest = async <T = Record<string, unknown>>(
  config: OpenAIRestConfig,
  path: string,
  form: FormData,
  options: OpenAIRequestOptions = {}
): Promise<T> => {
  const response = await openAIFetch({
    config,
    path,
    method: 'POST',
    body: form,
    signal: options.signal,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI request failed'
  })
  return await readJsonResponse(response, options.errorMessagePrefix ?? 'OpenAI response') as T
}

export const createOpenAIResponse = async (
  config: OpenAIRestConfig,
  body: Record<string, unknown>,
  options: OpenAIRequestOptions = {}
): Promise<OpenAIResponsesResponse> =>
  await openAIJsonRequest<OpenAIResponsesResponse>(config, '/responses', body, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI Responses request failed'
  })

export const createOpenAIChatCompletion = async (
  config: OpenAIRestConfig,
  body: Record<string, unknown>,
  options: OpenAIRequestOptions = {}
): Promise<OpenAIChatCompletionResponse> =>
  await openAIJsonRequest<OpenAIChatCompletionResponse>(config, '/chat/completions', body, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI Chat Completions request failed'
  })

export const createOpenAISpeech = async (
  config: OpenAIRestConfig,
  body: Record<string, unknown>,
  options: OpenAIRequestOptions = {}
): Promise<Uint8Array> =>
  await openAIBinaryJsonRequest(config, '/audio/speech', body, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI speech request failed'
  })

export const createOpenAITranscription = async <T = Record<string, unknown>>(
  config: OpenAIRestConfig,
  form: FormData,
  options: OpenAIRequestOptions = {}
): Promise<T> =>
  await openAIMultipartRequest<T>(config, '/audio/transcriptions', form, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI transcription failed'
  })

export const createOpenAIImage = async (
  config: OpenAIRestConfig,
  body: Record<string, unknown>,
  options: OpenAIRequestOptions = {}
): Promise<OpenAIImageResponse> =>
  await openAIJsonRequest<OpenAIImageResponse>(config, '/images/generations', body, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI image generation failed'
  })

export const createOpenAIImageEdit = async (
  config: OpenAIRestConfig,
  form: FormData,
  options: OpenAIRequestOptions = {}
): Promise<OpenAIImageResponse> =>
  await openAIMultipartRequest<OpenAIImageResponse>(config, '/images/edits', form, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI image edit failed'
  })

export const createOpenAIVoiceConsent = async <T = Record<string, unknown>>(
  config: OpenAIRestConfig,
  form: FormData,
  options: OpenAIRequestOptions = {}
): Promise<T> =>
  await openAIMultipartRequest<T>(config, '/audio/voice_consents', form, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI voice consent upload failed'
  })

export const createOpenAIVoice = async <T = Record<string, unknown>>(
  config: OpenAIRestConfig,
  form: FormData,
  options: OpenAIRequestOptions = {}
): Promise<T> =>
  await openAIMultipartRequest<T>(config, '/audio/voices', form, {
    ...options,
    errorMessagePrefix: options.errorMessagePrefix ?? 'OpenAI voice creation failed'
  })

export const extractOpenAIResponseText = (response: OpenAIResponsesResponse): string | undefined => {
  if (typeof response.output_text === 'string') {
    return response.output_text
  }

  let text = ''
  let foundText = false
  for (const item of response.output ?? []) {
    if (!isRecord(item) || !Array.isArray(item['content'])) {
      continue
    }

    for (const part of item['content']) {
      if (!isRecord(part)) {
        continue
      }

      if (part['type'] === 'output_text' && typeof part['text'] === 'string') {
        text += part['text']
        foundText = true
      }
    }
  }

  return foundText ? text : undefined
}

export const extractOpenAIChatCompletionText = (response: OpenAIChatCompletionResponse): string | undefined => {
  const content = response.choices?.[0]?.message?.content
  if (typeof content === 'string') {
    return content
  }

  if (!Array.isArray(content)) {
    return undefined
  }

  let text = ''
  let foundText = false
  for (const part of content) {
    if (isRecord(part) && typeof part['text'] === 'string') {
      text += part['text']
      foundText = true
    }
  }
  return foundText ? text : undefined
}
