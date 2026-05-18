import { writeFile } from '~/utils/cli-utils'
import type { OcrProviderFailureSummary } from '~/types'

export class OcrStructuredResponseError extends Error {
  rawResponse: string

  constructor(message: string, rawResponse: string) {
    super(message)
    this.name = 'OcrStructuredResponseError'
    this.rawResponse = rawResponse
  }
}

export const findOcrStructuredResponseError = (
  error: unknown
): OcrStructuredResponseError | undefined => {
  const seen = new Set<unknown>()
  let current: unknown = error
  while (current instanceof Error && !seen.has(current)) {
    if (current instanceof OcrStructuredResponseError) {
      return current
    }
    seen.add(current)
    current = current.cause
  }
  return undefined
}

export const writeInvalidOcrStructuredResponse = async (
  providerDir: string,
  error: unknown
): Promise<void> => {
  const structuredError = findOcrStructuredResponseError(error)
  if (!structuredError) {
    return
  }

  await writeFile(`${providerDir}/invalid-structured-response.txt`, structuredError.rawResponse)
  await writeFile(`${providerDir}/invalid-structured-response.json`, JSON.stringify({
    error: structuredError.message,
    rawResponseFile: 'invalid-structured-response.txt'
  }, null, 2))
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const toDiagnosticValue = (
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown => {
  if (
    value === null
    || value === undefined
    || typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
  ) {
    return value
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof URL) {
    return value.toString()
  }

  if (value instanceof Headers) {
    return Object.fromEntries(value.entries())
  }

  if (value instanceof Error) {
    return serializeError(value, depth, seen)
  }

  if (depth > 5) {
    return '[Truncated]'
  }

  if (Array.isArray(value)) {
    return value.map(item => toDiagnosticValue(item, depth + 1, seen))
  }

  if (typeof value === 'object') {
    const objectValue = value as Record<string, unknown>
    if (seen.has(objectValue)) {
      return '[Circular]'
    }
    seen.add(objectValue)
    return Object.fromEntries(
      Object.entries(objectValue).map(([key, entry]) => [key, toDiagnosticValue(entry, depth + 1, seen)])
    )
  }

  return String(value)
}

const serializeError = (
  error: Error,
  depth = 0,
  seen = new WeakSet<object>()
): Record<string, unknown> => {
  if (seen.has(error)) {
    return { name: error.name, message: '[Circular]' }
  }
  seen.add(error)

  const out: Record<string, unknown> = {
    name: error.name,
    message: error.message
  }

  if (error.stack) {
    out['stack'] = error.stack
  }

  if (isRecord(error)) {
    for (const [key, value] of Object.entries(error)) {
      if (key === 'name' || key === 'message' || key === 'stack' || key === 'cause') {
        continue
      }
      out[key] = toDiagnosticValue(value, depth + 1, seen)
    }
  }

  if ('cause' in error && error.cause !== undefined) {
    out['cause'] = toDiagnosticValue(error.cause, depth + 1, seen)
  }

  return out
}

const serializeUnknownError = (error: unknown): unknown =>
  error instanceof Error
    ? serializeError(error)
    : toDiagnosticValue(error)

export const writeOcrProviderError = async (
  providerDir: string,
  error: unknown,
  failure: OcrProviderFailureSummary
): Promise<'error.json'> => {
  await writeInvalidOcrStructuredResponse(providerDir, error)
  await writeFile(`${providerDir}/error.json`, JSON.stringify({
    message: failure.message,
    category: failure.category,
    error: serializeUnknownError(error)
  }, null, 2))
  return 'error.json'
}
