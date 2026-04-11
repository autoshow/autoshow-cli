import { describe, expect, test } from 'bun:test'
import {
  isRetryableStatus,
  parseRetryAfterMs,
  classifyFetchRetry,
  getRetryPolicy,
  withRetry,
  pollUntil
} from '~/utils/retries'

describe('isRetryableStatus', () => {
  test('returns true for standard retryable statuses', () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504]) {
      expect(isRetryableStatus(status)).toBe(true)
    }
  })

  test('returns true for any 5xx status', () => {
    expect(isRetryableStatus(507)).toBe(true)
    expect(isRetryableStatus(599)).toBe(true)
  })

  test('returns false for non-retryable client errors', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isRetryableStatus(status)).toBe(false)
    }
  })

  test('returns false for success statuses', () => {
    expect(isRetryableStatus(200)).toBe(false)
    expect(isRetryableStatus(201)).toBe(false)
    expect(isRetryableStatus(204)).toBe(false)
  })
})

describe('parseRetryAfterMs', () => {
  test('returns undefined for missing headers', () => {
    expect(parseRetryAfterMs(undefined)).toBeUndefined()
  })

  test('returns undefined when header is absent', () => {
    const headers = new Headers()
    expect(parseRetryAfterMs(headers)).toBeUndefined()
  })

  test('parses seconds value', () => {
    const headers = new Headers({ 'retry-after': '5' })
    expect(parseRetryAfterMs(headers)).toBe(5000)
  })

  test('parses zero seconds', () => {
    const headers = new Headers({ 'retry-after': '0' })
    expect(parseRetryAfterMs(headers)).toBe(0)
  })

  test('returns undefined for invalid value', () => {
    const headers = new Headers({ 'retry-after': 'not-a-number-or-date' })
    expect(parseRetryAfterMs(headers)).toBeUndefined()
  })
})

describe('classifyFetchRetry', () => {
  test('retries on retryable HTTP status', () => {
    const error = Object.assign(new Error('HTTP 429'), { status: 429 })
    const decision = classifyFetchRetry(error, 'runtime_http_read')
    expect(decision.shouldRetry).toBe(true)
    expect(decision.reason).toContain('429')
  })

  test('does not retry on non-retryable status', () => {
    const error = Object.assign(new Error('HTTP 401'), { status: 401 })
    const decision = classifyFetchRetry(error, 'runtime_http_read')
    expect(decision.shouldRetry).toBe(false)
  })

  test('retries on network error', () => {
    const error = new Error('fetch failed')
    const decision = classifyFetchRetry(error, 'runtime_http_read')
    expect(decision.shouldRetry).toBe(true)
    expect(decision.reason).toContain('network')
  })

  test('does not retry abort on conservative class', () => {
    const error = new DOMException('signal aborted', 'AbortError')
    const decision = classifyFetchRetry(error, 'runtime_http_create_conservative')
    expect(decision.shouldRetry).toBe(false)
  })

  test('can retry abort on conservative class when explicitly enabled', () => {
    const error = new DOMException('signal aborted', 'AbortError')
    const decision = classifyFetchRetry(error, 'runtime_http_create_conservative', {
      retryAbortOnConservative: true
    })
    expect(decision.shouldRetry).toBe(true)
  })

  test('retries abort on non-conservative class', () => {
    const error = new DOMException('signal aborted', 'AbortError')
    const decision = classifyFetchRetry(error, 'runtime_http_read')
    expect(decision.shouldRetry).toBe(true)
  })

  test('does not retry unknown errors', () => {
    const error = new Error('something completely unexpected')
    const decision = classifyFetchRetry(error, 'runtime_http_read')
    expect(decision.shouldRetry).toBe(false)
    expect(decision.reason).toContain('unknown')
  })
})

describe('getRetryPolicy', () => {
  test('returns default policy for each retry class', () => {
    const setup = getRetryPolicy('setup_download')
    expect(setup.maxAttempts).toBe(3)
    expect(setup.jitter).toBe(true)
    expect(setup.exponential).toBe(true)

    const subprocess = getRetryPolicy('runtime_subprocess_transient')
    expect(subprocess.maxAttempts).toBe(2)
    expect(subprocess.jitter).toBe(false)

    const httpRead = getRetryPolicy('runtime_http_read')
    expect(httpRead.maxAttempts).toBe(4)

    const conservative = getRetryPolicy('runtime_http_create_conservative')
    expect(conservative.maxAttempts).toBe(2)

    const poll = getRetryPolicy('runtime_poll_loop')
    expect(poll.maxAttempts).toBe(1)
  })

  test('applies overrides', () => {
    const policy = getRetryPolicy('setup_download', { maxAttempts: 10 })
    expect(policy.maxAttempts).toBe(10)
    expect(policy.jitter).toBe(true)
  })
})

describe('withRetry', () => {
  test('succeeds on first attempt', async () => {
    const result = await withRetry(
      { operationName: 'test-op', retryClass: 'runtime_http_read' },
      async () => 42
    )
    expect(result).toBe(42)
  })

  test('retries and succeeds', async () => {
    let attempt = 0
    const result = await withRetry(
      { operationName: 'test-op', retryClass: 'runtime_http_read', policy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 1, jitter: false, exponential: false } },
      async () => {
        attempt++
        if (attempt < 3) throw new Error('transient')
        return 'ok'
      }
    )
    expect(result).toBe('ok')
    expect(attempt).toBe(3)
  })

  test('throws after exhausting retries', async () => {
    await expect(
      withRetry(
        { operationName: 'fail-op', retryClass: 'runtime_poll_loop', policy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, jitter: false, exponential: false } },
        async () => { throw new Error('always fails') }
      )
    ).rejects.toThrow('fail-op failed after 1 attempts')
  })

  test('respects classifier that says no retry', async () => {
    let attempts = 0
    await expect(
      withRetry(
        { operationName: 'classified-op', retryClass: 'runtime_http_read', policy: { maxAttempts: 5, baseDelayMs: 1, maxDelayMs: 1, jitter: false, exponential: false } },
        async () => {
          attempts++
          throw new Error('fatal')
        },
        () => ({ shouldRetry: false, delayMs: 0, reason: 'fatal' })
      )
    ).rejects.toThrow()
    expect(attempts).toBe(1)
  })

  test('passes a timeout-backed abort signal when timeoutMs is configured', async () => {
    await expect(
      withRetry(
        {
          operationName: 'timeout-op',
          retryClass: 'runtime_http_read',
          timeoutMs: 5,
          policy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, jitter: false, exponential: false }
        },
        async (signal) => await new Promise((_resolve, reject) => {
          if (!signal) {
            reject(new Error('missing signal'))
            return
          }

          signal.addEventListener('abort', () => {
            reject(signal.reason ?? new DOMException('signal aborted', 'AbortError'))
          }, { once: true })
        })
      )
    ).rejects.toThrow('timeout-op failed after 1 attempts')
  })
})

describe('pollUntil', () => {
  test('returns immediately when condition is met', async () => {
    const result = await pollUntil({
      operationName: 'instant-poll',
      deadlineMs: 5000,
      intervalMs: 10,
      pollFn: async () => 'done',
      isDone: (r) => r === 'done'
    })
    expect(result).toBe('done')
  })

  test('polls multiple times before success', async () => {
    let count = 0
    const result = await pollUntil({
      operationName: 'multi-poll',
      deadlineMs: 5000,
      intervalMs: 1,
      pollFn: async () => {
        count++
        return count >= 3 ? 'ready' : 'pending'
      },
      isDone: (r) => r === 'ready'
    })
    expect(result).toBe('ready')
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('throws on terminal failure', async () => {
    await expect(
      pollUntil({
        operationName: 'fail-poll',
        deadlineMs: 5000,
        intervalMs: 1,
        pollFn: async () => 'error-state',
        isDone: () => false,
        isFailed: (r) => r === 'error-state' ? { failed: true, reason: 'bad state' } : { failed: false }
      })
    ).rejects.toThrow('terminal failure')
  })

  test('throws on deadline exceeded', async () => {
    await expect(
      pollUntil({
        operationName: 'slow-poll',
        deadlineMs: 10,
        intervalMs: 5,
        pollFn: async () => {
          await Bun.sleep(20)
          return 'still waiting'
        },
        isDone: () => false
      })
    ).rejects.toThrow('deadline exceeded')
  })
})
