import { describe, expect, test } from 'bun:test'
import { withHostedTtsRetry } from '~/cli/commands/process-steps/step-4-tts/tts-utils/hosted-tts-retry'
import { AppError } from '~/utils/error-handler'
import { classifyFetchRetry, withRetry } from '~/utils/retries'

const FAST_RETRY_POLICY = {
  baseDelayMs: 0,
  maxDelayMs: 0,
  jitter: false,
  exponential: false
} as const

describe('retry error contracts', () => {
  test('classifyFetchRetry treats Bun TimeoutError DOMExceptions as retryable', () => {
    const decision = classifyFetchRetry(
      new DOMException('The operation timed out.', 'TimeoutError'),
      'runtime_http_read'
    )

    expect(decision).toMatchObject({
      shouldRetry: true,
      reason: 'abort/timeout'
    })
  })

  test('withHostedTtsRetry retries a timeout and propagates attempt signals', async () => {
    let attempts = 0
    const signals: boolean[] = []

    const result = await withHostedTtsRetry(
      {
        operationName: 'hosted-tts-timeout-success',
        timeoutMs: 1_000,
        policy: {
          ...FAST_RETRY_POLICY,
          maxAttempts: 4
        }
      },
      async (signal) => {
        attempts += 1
        signals.push(signal instanceof AbortSignal)
        if (attempts === 1) {
          throw new DOMException('The operation timed out.', 'TimeoutError')
        }
        return 'ok'
      }
    )

    expect(result).toBe('ok')
    expect(attempts).toBe(2)
    expect(signals).toEqual([true, true])
  })

  test('withHostedTtsRetry exhausts repeated timeouts with retry metadata', async () => {
    let attempts = 0

    try {
      await withHostedTtsRetry(
        {
          operationName: 'hosted-tts-timeout-exhaustion',
          policy: {
            ...FAST_RETRY_POLICY,
            maxAttempts: 2
          }
        },
        async () => {
          attempts += 1
          throw new DOMException('The operation timed out.', 'TimeoutError')
        }
      )
      throw new Error('expected hosted TTS retry failure')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      const appError = error as AppError
      expect(appError.message).toContain('hosted-tts-timeout-exhaustion failed after 2/2 attempts (max attempts reached,')
      expect(appError.metadata).toMatchObject({
        attemptsMade: 2,
        maxAttempts: 2,
        stopReason: 'max attempts reached'
      })
      expect(attempts).toBe(2)
    }
  })

  test('withHostedTtsRetry retries retryable HTTP statuses and honors non-retryable 400', async () => {
    let attempts = 0
    const success = await withHostedTtsRetry(
      {
        operationName: 'hosted-tts-http-retry',
        policy: {
          ...FAST_RETRY_POLICY,
          maxAttempts: 4
        }
      },
      async () => {
        attempts += 1
        if (attempts === 1) {
          throw Object.assign(new Error('provider busy'), {
            status: 503,
            headers: new Headers({ 'retry-after': '0' })
          })
        }
        return 'ok'
      }
    )

    expect(success).toBe('ok')
    expect(attempts).toBe(2)

    const badRequest = Object.assign(new Error('bad request'), { status: 400 })
    attempts = 0
    await expect(withHostedTtsRetry(
      {
        operationName: 'hosted-tts-http-400',
        policy: {
          ...FAST_RETRY_POLICY,
          maxAttempts: 4
        }
      },
      async () => {
        attempts += 1
        throw badRequest
      }
    )).rejects.toBe(badRequest)
    expect(attempts).toBe(1)
  })

  test('withRetry throws AppError with attempts and provider metadata after exhaustion', async () => {
    let attempts = 0

    await expect(withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'test-provider-read',
        policy: {
          maxAttempts: 2,
          baseDelayMs: 0,
          maxDelayMs: 0,
          jitter: false,
          exponential: false
        }
      },
      async () => {
        attempts += 1
        throw Object.assign(new Error('provider unavailable'), {
          status: 503,
          stage: 'poll',
          retryable: true,
          category: 'network',
          rawResponse: { error: 'temporary outage' }
        })
      },
      (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
    )).rejects.toThrow(AppError)

    expect(attempts).toBe(2)

    try {
      await withRetry(
        {
          retryClass: 'runtime_http_read',
          operationName: 'test-provider-read',
          policy: {
            maxAttempts: 2,
            baseDelayMs: 0,
            maxDelayMs: 0,
            jitter: false,
            exponential: false
          }
        },
        async () => {
          throw Object.assign(new Error('provider unavailable'), {
            status: 503,
            stage: 'poll',
            retryable: true,
            category: 'network',
            rawResponse: { error: 'temporary outage' }
          })
        },
        (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
      )
      throw new Error('expected retry failure')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      const appError = error as AppError
      expect(appError.kind).toBe('retry_exhausted')
      expect(appError.message).toContain('test-provider-read failed after 2/2 attempts (max attempts reached,')
      expect(appError.status).toBe(503)
      expect(appError.stage).toBe('poll')
      expect(appError.retryClass).toBe('runtime_http_read')
      expect(appError.retryable).toBe(true)
      expect(appError.metadata).toMatchObject({
        attemptsMade: 2,
        maxAttempts: 2,
        stopReason: 'max attempts reached',
        category: 'network',
        rawResponse: { error: 'temporary outage' }
      })
    }
  })

  test('withRetry reports actual attempts when a later failure is non-retryable', async () => {
    let attempts = 0

    try {
      await withRetry(
        {
          retryClass: 'runtime_http_read',
          operationName: 'test-provider-create',
          policy: {
            maxAttempts: 4,
            baseDelayMs: 0,
            maxDelayMs: 0,
            jitter: false,
            exponential: false
          }
        },
        async () => {
          attempts += 1
          if (attempts === 1) {
            throw new TypeError('fetch failed')
          }
          throw Object.assign(new Error('bad request'), { status: 400, stage: 'create' })
        },
        (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
      )
      throw new Error('expected retry failure')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      const appError = error as AppError
      expect(appError.message).toContain('test-provider-create failed after 2/4 attempts (non-retryable status 400,')
      expect(appError.status).toBe(400)
      expect(appError.stage).toBe('create')
      expect(appError.metadata['attemptsMade']).toBe(2)
      expect(appError.metadata['stopReason']).toBe('non-retryable status 400')
    }
  })

  test('withRetry rethrows a first non-retryable failure unchanged', async () => {
    const original = Object.assign(new Error('bad request'), { status: 400 })

    await expect(withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: 'test-provider-read',
        policy: {
          maxAttempts: 3,
          baseDelayMs: 0,
          maxDelayMs: 0,
          jitter: false,
          exponential: false
        }
      },
      async () => {
        throw original
      },
      (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
    )).rejects.toBe(original)
  })
})
