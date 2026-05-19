import type { RetryClassifier, RetryDecision, RetryPolicy } from '~/types'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { OCR_REQUEST_TIMEOUT_MS, readPositiveIntegerEnv } from '~/utils/timeouts'

export const OCR_SCHEMA_RETRY_ATTEMPTS = 3
export const DEFAULT_OCR_PAGE_REQUEST_ATTEMPTS = 2
export const OCR_PAGE_REQUEST_ATTEMPTS = readPositiveIntegerEnv(
  'AUTOSHOW_OCR_PAGE_REQUEST_ATTEMPTS',
  DEFAULT_OCR_PAGE_REQUEST_ATTEMPTS
)
export const DEFAULT_OCR_PAGE_REQUEST_TIMEOUT_MS = 5 * 60_000
export const OCR_PAGE_REQUEST_TIMEOUT_MS = readPositiveIntegerEnv(
  'AUTOSHOW_OCR_PAGE_REQUEST_TIMEOUT_MS',
  DEFAULT_OCR_PAGE_REQUEST_TIMEOUT_MS
)

export const OCR_CREATE_RETRY_POLICY: Partial<RetryPolicy> = {
  maxAttempts: 4,
  baseDelayMs: 2_000,
  maxDelayMs: 60_000,
  jitter: true,
  exponential: true
}

export const OCR_PAGE_REQUEST_RETRY_POLICY: Partial<RetryPolicy> = {
  maxAttempts: OCR_PAGE_REQUEST_ATTEMPTS,
  baseDelayMs: 2_000,
  maxDelayMs: 10_000,
  jitter: true,
  exponential: true
}

const isTimeoutError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return true
  }
  if (error instanceof Error) {
    return error.name === 'TimeoutError' || /timed out|timeout/i.test(error.message)
  }
  return false
}

const isStructuredOcrResponseError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.name === 'OcrStructuredResponseError'
      || /not valid json|malformed json|schema|returned \d+ pages|non-contiguous page numbers|returned no pages|returned no text output/i.test(error.message)
  }
  return false
}

export const classifyOcrCreateRetry = (error: unknown): RetryDecision => {
  if (isTimeoutError(error)) {
    return { shouldRetry: true, delayMs: 0, reason: 'timeout' }
  }
  return classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
}

export const classifyOcrPageRequestRetry = (error: unknown): RetryDecision => {
  if (isStructuredOcrResponseError(error)) {
    return { shouldRetry: true, delayMs: 0, reason: 'structured_response' }
  }
  return classifyOcrCreateRetry(error)
}

export const withOcrCreateRetry = async <T>(
  operationName: string,
  operation: (signal?: AbortSignal) => Promise<T>,
  classifier: RetryClassifier = classifyOcrCreateRetry
): Promise<T> =>
  await withRetry(
    {
      retryClass: 'runtime_http_create_conservative',
      operationName,
      policy: OCR_CREATE_RETRY_POLICY,
      timeoutMs: OCR_REQUEST_TIMEOUT_MS
    },
    operation,
    classifier
  )

export const withOcrPageRequestRetry = async <T>(
  operationName: string,
  operation: (signal?: AbortSignal) => Promise<T>,
  options: {
    attempts?: number | undefined
    timeoutMs?: number | undefined
    classifier?: RetryClassifier | undefined
  } = {}
): Promise<T> =>
  await withRetry(
    {
      retryClass: 'runtime_http_create_conservative',
      operationName,
      policy: {
        ...OCR_PAGE_REQUEST_RETRY_POLICY,
        ...(typeof options.attempts === 'number' ? { maxAttempts: Math.max(1, Math.floor(options.attempts)) } : {})
      },
      timeoutMs: options.timeoutMs ?? OCR_PAGE_REQUEST_TIMEOUT_MS
    },
    operation,
    options.classifier ?? classifyOcrPageRequestRetry
  )
