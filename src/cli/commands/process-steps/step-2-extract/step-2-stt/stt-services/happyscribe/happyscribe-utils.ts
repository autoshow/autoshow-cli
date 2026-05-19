import type {
  HappyScribeHttpError,
  HappyScribeStage,
  RetryClass
} from '~/types'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const normalizeHappyScribeId = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}

export const parseHappyScribeNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value)
    ? value
    : typeof value === 'string'
      ? (() => {
          const parsed = Number.parseFloat(value)
          return Number.isFinite(parsed) ? parsed : undefined
        })()
      : undefined

export const readHappyScribeJsonOrText = async (response: Response): Promise<unknown> => {
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

export const extractHappyScribeErrorMessage = (payload: unknown): string | undefined => {
  if (typeof payload === 'string') {
    const trimmed = payload.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  if (!isRecord(payload)) {
    return undefined
  }

  for (const key of ['message', 'error', 'detail', 'failureMessage', 'failureReason'] as const) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return undefined
}

export const getHappyScribeErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

export const buildHappyScribeRetryHeaders = (
  response: Response,
  payload: unknown
): Headers => {
  const headers = new Headers(response.headers)
  if (!headers.has('retry-after') && isRecord(payload)) {
    const retryInSeconds = parseHappyScribeNumber(payload['retry_in_seconds'])
    if (typeof retryInSeconds === 'number' && retryInSeconds >= 0) {
      headers.set('retry-after', String(retryInSeconds))
    }
  }
  return headers
}

export const toHappyScribeHttpError = (
  stage: HappyScribeStage,
  retryClass: RetryClass,
  response: Response,
  payload: unknown,
  messagePrefix = 'Happy Scribe request failed'
): HappyScribeHttpError => Object.assign(
  new Error(`${messagePrefix} (${response.status}): ${extractHappyScribeErrorMessage(payload) ?? 'Unknown error'}`),
  {
    status: response.status,
    headers: buildHappyScribeRetryHeaders(response, payload),
    stage,
    retryClass,
    rawResponse: payload
  } satisfies Pick<HappyScribeHttpError, 'status' | 'headers' | 'stage' | 'retryClass' | 'rawResponse'>
)

export const attachHappyScribeErrorContext = (
  error: unknown,
  stage: HappyScribeStage,
  retryClass: RetryClass,
  rawResponse?: unknown
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as HappyScribeHttpError).stage = stage
  ;(source as HappyScribeHttpError).retryClass = retryClass
  if (rawResponse !== undefined) {
    ;(source as HappyScribeHttpError).rawResponse = rawResponse
  }
  throw source
}
