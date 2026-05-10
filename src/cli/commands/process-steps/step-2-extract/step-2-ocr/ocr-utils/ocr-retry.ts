import type { RetryClassifier, RetryDecision, RetryPolicy } from '~/types'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { OCR_REQUEST_TIMEOUT_MS } from '~/utils/timeouts'

export const OCR_SCHEMA_RETRY_ATTEMPTS = 3

export const OCR_CREATE_RETRY_POLICY: Partial<RetryPolicy> = {
  maxAttempts: 4,
  baseDelayMs: 2_000,
  maxDelayMs: 60_000,
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

export const classifyOcrCreateRetry = (error: unknown): RetryDecision => {
  if (isTimeoutError(error)) {
    return { shouldRetry: true, delayMs: 0, reason: 'timeout' }
  }
  return classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
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
