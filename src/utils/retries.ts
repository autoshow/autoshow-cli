import type { PollOptions, RetryClass, RetryContext, RetryDecision, RetryPolicy } from '~/types'
import * as l from '~/utils/logger'

const NON_RETRYABLE_STATUSES = new Set([400, 401, 403, 404, 422])
const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

const RETRY_POLICIES: Record<RetryClass, RetryPolicy> = {
  setup_download: {
    maxAttempts: 3,
    baseDelayMs: 2_000,
    maxDelayMs: 30_000,
    jitter: true,
    exponential: true
  },
  runtime_subprocess_transient: {
    maxAttempts: 2,
    baseDelayMs: 1_000,
    maxDelayMs: 5_000,
    jitter: false,
    exponential: false
  },
  runtime_http_read: {
    maxAttempts: 4,
    baseDelayMs: 1_000,
    maxDelayMs: 15_000,
    jitter: true,
    exponential: true
  },
  runtime_http_create_conservative: {
    maxAttempts: 2,
    baseDelayMs: 2_000,
    maxDelayMs: 10_000,
    jitter: true,
    exponential: true
  },
  runtime_poll_loop: {
    maxAttempts: 1,
    baseDelayMs: 0,
    maxDelayMs: 0,
    jitter: false,
    exponential: false
  }
} as const

export const isRetryableStatus = (status: number): boolean => {
  if (RETRYABLE_STATUSES.has(status)) return true
  return status >= 500
}

export const parseRetryAfterMs = (headers: Headers | undefined): number | undefined => {
  if (!headers) return undefined
  const value = headers.get('retry-after')
  if (!value) return undefined

  const seconds = Number(value)
  if (!Number.isNaN(seconds)) {
    return seconds * 1_000
  }

  const date = Date.parse(value)
  if (!Number.isNaN(date)) {
    const delayMs = date - Date.now()
    return delayMs > 0 ? delayMs : undefined
  }

  return undefined
}

const isNetworkError = (error: unknown): boolean => {
  if (error instanceof TypeError) return true
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return (
      msg.includes('fetch failed') ||
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('econnrefused') ||
      msg.includes('etimedout') ||
      msg.includes('socket connection was closed unexpectedly') ||
      msg.includes('socket connection') ||
      msg.includes('socket hang up') ||
      msg.includes('closed unexpectedly') ||
      msg.includes('dns')
    )
  }
  return false
}

export const isAbortError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true
  if (error instanceof Error && error.name === 'AbortError') return true
  return false
}

const getStatusFromError = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: unknown }).status
    if (typeof status === 'number') return status
  }
  return undefined
}

const getHeadersFromError = (error: unknown): Headers | undefined => {
  if (error && typeof error === 'object' && 'headers' in error) {
    const headers = (error as { headers: unknown }).headers
    if (headers instanceof Headers) return headers
  }
  return undefined
}

export type ClassifyFetchRetryOptions = {
  retryAbortOnConservative?: boolean
}

export const classifyFetchRetry = (
  error: unknown,
  retryClass: RetryClass,
  options: ClassifyFetchRetryOptions = {}
): RetryDecision => {
  const noRetry = (reason: string): RetryDecision => ({ shouldRetry: false, delayMs: 0, reason })
  const doRetry = (delayMs: number, reason: string): RetryDecision => ({ shouldRetry: true, delayMs, reason })

  if (isAbortError(error)) {
    if (retryClass === 'runtime_http_create_conservative' && options.retryAbortOnConservative !== true) {
      return noRetry('abort/timeout on conservative request')
    }
    return doRetry(0, 'abort/timeout')
  }

  const status = getStatusFromError(error)

  if (status !== undefined) {
    if (NON_RETRYABLE_STATUSES.has(status)) {
      return noRetry(`non-retryable status ${status}`)
    }

    if (isRetryableStatus(status)) {
      const retryAfter = parseRetryAfterMs(getHeadersFromError(error))
      return doRetry(retryAfter ?? 0, `retryable status ${status}`)
    }

    return noRetry(`unexpected status ${status}`)
  }

  if (isNetworkError(error)) {
    return doRetry(0, 'network error')
  }

  return noRetry('unknown error type')
}

export const getRetryPolicy = (retryClass: RetryClass, overrides?: Partial<RetryPolicy>): RetryPolicy => {
  const base = RETRY_POLICIES[retryClass]
  if (!overrides) return base
  return { ...base, ...overrides }
}

export type RetryClassifier = (error: unknown) => RetryDecision

const computeDelay = (attempt: number, baseDelayMs: number, maxDelayMs: number, exponential: boolean, jitter: boolean): number => {
  let delay = exponential
    ? baseDelayMs * Math.pow(2, attempt)
    : baseDelayMs

  if (jitter) {
    delay = delay * (0.5 + Math.random() * 0.5)
  }

  return Math.min(delay, maxDelayMs)
}

export const withRetry = async <T>(
  ctx: RetryContext,
  operation: (signal?: AbortSignal) => Promise<T>,
  classifier?: RetryClassifier
): Promise<T> => {
  const policy = getRetryPolicy(ctx.retryClass, ctx.policy)
  const startedAt = Date.now()
  let lastError: unknown
  let retried = false

  for (let attempt = 0; attempt < policy.maxAttempts; attempt++) {
    try {
      const signal = typeof ctx.timeoutMs === 'number'
        ? AbortSignal.timeout(ctx.timeoutMs)
        : undefined
      return await operation(signal)
    } catch (error) {
      lastError = error

      const isLastAttempt = attempt === policy.maxAttempts - 1
      if (isLastAttempt) break

      if (classifier) {
        const decision = classifier(error)
        if (!decision.shouldRetry) {
          if (!retried) {
            throw error
          }
          break
        }

        if (decision.delayMs > 0) {
          retried = true
          l.warn(`${ctx.operationName}: attempt ${attempt + 1}/${policy.maxAttempts} failed (${decision.reason}), retrying in ${decision.delayMs}ms`)
          await Bun.sleep(decision.delayMs)
          continue
        }
      }

      retried = true
      const delay = computeDelay(attempt, policy.baseDelayMs, policy.maxDelayMs, policy.exponential, policy.jitter)
      const reason = error instanceof Error ? error.message : String(error)
      l.warn(`${ctx.operationName}: attempt ${attempt + 1}/${policy.maxAttempts} failed (${reason}), retrying in ${Math.round(delay)}ms`)
      await Bun.sleep(delay)
    }
  }

  const elapsed = Date.now() - startedAt
  const enrichedMessage = `${ctx.operationName} failed after ${policy.maxAttempts} attempts (${elapsed}ms elapsed)`
  const enrichedError = new Error(enrichedMessage, { cause: lastError })
  ;(enrichedError as Error & { retryClass?: RetryClass }).retryClass = ctx.retryClass

  if (lastError && typeof lastError === 'object') {
    const lastErrorWithMeta = lastError as Record<string, unknown>
    for (const key of ['status', 'headers', 'stage', 'retryClass'] as const) {
      const value = lastErrorWithMeta[key]
      if (value !== undefined) {
        ;(enrichedError as Error & Record<string, unknown>)[key] = value
      }
    }
  }

  throw enrichedError
}

export const pollUntil = async <T>(opts: PollOptions<T>): Promise<T> => {
  const deadline = Date.now() + opts.deadlineMs
  const { operationName, pollFn, isDone, isFailed, intervalMs } = opts

  while (Date.now() < deadline) {
    const result = await pollFn()

    if (isDone(result)) {
      return result
    }

    if (isFailed) {
      const failure = isFailed(result)
      if (failure.failed) {
        throw new Error(`${operationName}: terminal failure — ${failure.reason}`)
      }
    }

    const remaining = deadline - Date.now()
    if (remaining <= 0) break

    await Bun.sleep(Math.min(intervalMs, remaining))
  }

  throw new Error(`${operationName}: deadline exceeded (${opts.deadlineMs}ms)`)
}
