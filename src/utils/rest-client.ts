import { AppError } from '~/utils/error-handler'

export const trimTrailingSlashes = (value: string): string => value.replace(/\/+$/, '')

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const parseJsonOrText = (rawText: string): unknown => {
  if (rawText.trim().length === 0) {
    return {}
  }

  try {
    return JSON.parse(rawText) as unknown
  } catch {
    return rawText
  }
}

export const extractRestErrorMessage = (payload: unknown, rawText: string, status: number): string => {
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

export const normalizeFetchAbortError = (error: unknown): unknown => {
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

export const joinRestUrl = (
  baseURL: string | undefined,
  path: string,
  defaultBaseUrl: string,
  options: { collapseVersionPrefix?: string } = {}
): string => {
  const base = trimTrailingSlashes((baseURL ?? defaultBaseUrl).trim() || defaultBaseUrl)
  const pathWithoutLeadingSlash = path.replace(/^\/+/, '')
  const versionPrefix = options.collapseVersionPrefix?.replace(/^\/+|\/+$/g, '')

  const resolveRequestPath = (basePath: string): string =>
    versionPrefix && basePath.endsWith(`/${versionPrefix}`) && pathWithoutLeadingSlash.startsWith(`${versionPrefix}/`)
      ? pathWithoutLeadingSlash.slice(`${versionPrefix}/`.length)
      : pathWithoutLeadingSlash

  try {
    const url = new URL(base)
    url.hash = ''
    url.search = ''
    const basePath = trimTrailingSlashes(url.pathname)
    const requestPath = resolveRequestPath(basePath)
    url.pathname = `${basePath}/${requestPath}`.replace(/\/{2,}/g, '/')
    return url.toString()
  } catch {
    const requestPath = resolveRequestPath(base)
    return `${base}/${requestPath}`
  }
}

export const readJsonResponse = async (response: Response, errorMessagePrefix: string): Promise<unknown> => {
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
