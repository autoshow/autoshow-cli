import type { RetryClassifier, RetryPolicy } from '~/types'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

const HOSTED_TTS_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 4,
  baseDelayMs: 2_000,
  maxDelayMs: 30_000,
  jitter: true,
  exponential: true
}

type HostedTtsRetryOptions = {
  operationName: string
  policy?: Partial<RetryPolicy> | undefined
  timeoutMs?: number | undefined
  classifier?: RetryClassifier | undefined
}

export const classifyHostedTtsRetry: RetryClassifier = (error) =>
  classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })

export const withHostedTtsRetry = async <T>(
  options: HostedTtsRetryOptions,
  operation: (signal?: AbortSignal) => Promise<T>
): Promise<T> =>
  await withRetry(
    {
      retryClass: 'runtime_http_create_conservative',
      operationName: options.operationName,
      timeoutMs: options.timeoutMs ?? MEDIA_GENERATION_TIMEOUT_MS,
      policy: {
        ...HOSTED_TTS_RETRY_POLICY,
        ...options.policy
      }
    },
    operation,
    options.classifier ?? classifyHostedTtsRetry
  )
