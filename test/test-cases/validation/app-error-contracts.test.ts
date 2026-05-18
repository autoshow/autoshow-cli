import { describe, expect, test } from 'bun:test'
import {
  AppError,
  AppUsageError,
  CLIUsageError,
  collectErrorChain,
  extractErrorHints,
  extractErrorMetadata,
  isAppError,
  isUsageError,
  normalizeExitCode,
  serializeDiagnosticError,
  usageMessage
} from '~/utils/error-handler'

describe('app error contracts', () => {
  test('AppError stores classification, exit code, hints, metadata, and cause', () => {
    const cause = Object.assign(new Error('provider rejected request'), {
      status: 429,
      stage: 'create',
      retryClass: 'runtime_http_read',
      retryable: true,
      rawResponse: { error: 'rate limit' }
    })
    const error = new AppError('Request failed', {
      kind: 'provider_http',
      hints: ['Lower concurrency'],
      cause,
      metadata: { provider: 'openai' }
    })

    expect(isAppError(error)).toBe(true)
    expect(error.kind).toBe('provider_http')
    expect(error.exitCode).toBe(1)
    expect(error.hints).toEqual(['Lower concurrency'])
    expect(error.cause).toBe(cause)
    expect(extractErrorMetadata(error)).toMatchObject({
      provider: 'openai',
      status: 429,
      stage: 'create',
      retryClass: 'runtime_http_read',
      retryable: true,
      rawResponse: { error: 'rate limit' }
    })
  })

  test('AppUsageError and CLIUsageError preserve legacy usage behavior', () => {
    const usage = new AppUsageError('Bad flags', ['Run help'])
    const legacy = CLIUsageError('Missing input', 'Run: bun as help extract')

    expect(usage.name).toBe('CLIUsageError')
    expect(usage.exitCode).toBe(2)
    expect(isUsageError(usage)).toBe(true)
    expect(isUsageError(legacy)).toBe(true)
    expect(normalizeExitCode(legacy)).toBe(2)
    expect(usageMessage(legacy)).toBe('Missing input')
    expect(extractErrorHints(legacy)).toEqual(['Run: bun as help extract'])
  })

  test('normalizeExitCode honors explicit positive exit codes', () => {
    const error = new AppError('Partial completion', {
      kind: 'validation',
      exitCode: 7
    })

    expect(normalizeExitCode(error)).toBe(7)
    expect(normalizeExitCode(new Error('plain'))).toBe(1)
  })

  test('collectErrorChain walks causes without looping', () => {
    const inner = new Error('inner')
    const outer = new Error('outer', { cause: inner })
    inner.cause = outer

    expect(collectErrorChain(outer).map(error => error.message)).toEqual(['outer', 'inner'])
  })

  test('serializeDiagnosticError redacts secrets and preserves custom fields and causes', () => {
    const secret = 'secret-value-123'
    const cause = Object.assign(new Error('nested'), {
      body: `OPENAI_API_KEY=${secret}`
    })
    const error = Object.assign(new Error('top'), {
      status: 503,
      headers: new Headers({ authorization: `Bearer ${secret}` }),
      rawResponse: { detail: `authorization: bearer ${secret}` },
      cause
    })

    const diagnostic = serializeDiagnosticError(error)
    const serialized = JSON.stringify(diagnostic)

    expect(diagnostic['status']).toBe(503)
    expect(serialized).not.toContain(secret)
    expect(serialized).toContain('REDACTED')
    expect(typeof diagnostic['cause']).toBe('object')
  })
})
