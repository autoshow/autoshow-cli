import { join } from 'node:path'
import type {
  ProviderErrorLike,
  ProviderFailure,
  SttBatchBlockedProviderReason
} from '~/types'
import { classifyFetchRetry, parseRetryAfterMs } from '~/utils/retries'

const BATCH_BLOCKING_AUTH_STATUS_CODES = new Set([401, 403])
const BATCH_BLOCKING_MODEL_ERROR_CODES = new Set([400, 404, 422])
const BATCH_BLOCKING_MODEL_MESSAGE_PATTERNS = [
  /\bmodel\b.*\b(not found|does not exist|unsupported|not supported|unknown|invalid|unrecognized)\b/i,
  /\b(not found|does not exist|unsupported|not supported|unknown|invalid|unrecognized)\b.*\bmodel\b/i,
  /\bendpoint\b.*\bnot found\b/i,
  /\bspeaker reference\b.*\bnot found\b/i
]
const BATCH_BLOCKING_SETUP_MESSAGE_PATTERNS = [
  /\benvironment variable\b.*\brequired\b/i,
  /\bapi[_ -]?key\b.*\b(required|not set|missing)\b/i,
  /\bcredentials?\b.*\b(required|missing|invalid)\b/i
]
const RETRYABLE_DEADLINE_MESSAGE_PATTERN = /\bdeadline exceeded\b|\btimed out waiting for transcription completion\b/i

const isProviderErrorLike = (value: unknown): value is ProviderErrorLike =>
  value instanceof Error

const collectErrorChain = (error: unknown): ProviderErrorLike[] => {
  const chain: ProviderErrorLike[] = []
  const seen = new Set<unknown>()
  let current: unknown = error

  while (isProviderErrorLike(current) && !seen.has(current)) {
    chain.push(current)
    seen.add(current)
    current = current.cause
  }

  return chain
}

const resolveFailureMessage = (
  chain: ProviderErrorLike[],
  error: unknown
): string => {
  if (chain.length === 0) {
    return error instanceof Error ? error.message : String(error)
  }

  const outer = chain[0] as ProviderErrorLike
  const deepest = chain[chain.length - 1] as ProviderErrorLike
  if (deepest.name === 'AbortError') {
    return outer.message
  }

  return deepest.message || outer.message
}

export const classifySttProviderFailure = (
  error: unknown
): Omit<ProviderFailure, 'index' | 'service' | 'model'> => {
  const chain = collectErrorChain(error)
  const message = resolveFailureMessage(chain, error)
  const deepest = chain[chain.length - 1]
  const retryClass = chain.find((entry) => typeof entry.retryClass === 'string')?.retryClass
  const status = chain.find((entry) => typeof entry.status === 'number')?.status
  const headers = chain.find((entry) => entry.headers instanceof Headers)?.headers
  const stage = chain.find((entry) => typeof entry.stage === 'string')?.stage
  const explicitRetryable = chain.find((entry) => typeof entry.retryable === 'boolean')?.retryable
  const skipped = chain.some((entry) => entry.skipped === true)
  const retryAfterMs = parseRetryAfterMs(headers)

  let retryable = false
  if (explicitRetryable !== undefined) {
    retryable = explicitRetryable
  } else if (RETRYABLE_DEADLINE_MESSAGE_PATTERN.test(message)) {
    retryable = true
  } else if (retryClass) {
    const retryCandidate = Object.assign(
      deepest instanceof Error ? deepest : new Error(message),
      {
        ...(typeof status === 'number' ? { status } : {}),
        ...(headers instanceof Headers ? { headers } : {})
      }
    )
    retryable = classifyFetchRetry(
      retryCandidate,
      retryClass,
      { retryAbortOnConservative: true }
    ).shouldRetry
  } else if (typeof status === 'number') {
    retryable = classifyFetchRetry(
      Object.assign(new Error(message), {
        status,
        ...(headers instanceof Headers ? { headers } : {})
      }),
      'runtime_http_read',
      { retryAbortOnConservative: true }
    ).shouldRetry
  }

  return {
    message,
    retryable,
    ...(skipped ? { skipped: true } : {}),
    ...(stage ? { stage } : {}),
    ...(typeof status === 'number' ? { status } : {}),
    ...(typeof retryAfterMs === 'number' ? { retryAfterMs } : {})
  }
}

export const resolveTransientProviderCooldownMs = (
  failure: Pick<ProviderFailure, 'retryable' | 'status' | 'retryAfterMs' | 'stage' | 'message'>
): number | undefined => {
  if (!failure.retryable) {
    return undefined
  }

  if (typeof failure.retryAfterMs === 'number' && failure.retryAfterMs > 0) {
    return failure.retryAfterMs
  }

  if (failure.status === 429) {
    return 30_000
  }

  if (typeof failure.status === 'number' && failure.status >= 500) {
    return 10_000
  }

  if (failure.stage === 'poll' || RETRYABLE_DEADLINE_MESSAGE_PATTERN.test(failure.message)) {
    return 15_000
  }

  return 5_000
}

export const shouldBlockSttProviderForBatch = (
  failure: Pick<ProviderFailure, 'message' | 'retryable' | 'stage' | 'status' | 'skipped'>
): boolean => {
  if (failure.skipped === true) {
    return false
  }

  if (failure.retryable) {
    return false
  }

  if (BATCH_BLOCKING_SETUP_MESSAGE_PATTERNS.some((pattern) => pattern.test(failure.message))) {
    return true
  }

  if (typeof failure.status === 'number' && BATCH_BLOCKING_AUTH_STATUS_CODES.has(failure.status)) {
    return true
  }

  const isProviderConfigStage = failure.stage === undefined
    || failure.stage === 'transcribe'
    || failure.stage === 'create'
    || failure.stage === 'upload'

  return isProviderConfigStage
    && typeof failure.status === 'number'
    && BATCH_BLOCKING_MODEL_ERROR_CODES.has(failure.status)
    && BATCH_BLOCKING_MODEL_MESSAGE_PATTERNS.some((pattern) => pattern.test(failure.message))
}

export const extractProviderRawResponse = (error: unknown): unknown =>
  collectErrorChain(error).find((entry) => entry.rawResponse !== undefined)?.rawResponse

const toDiagnosticJson = (value: unknown): string => {
  try {
    const json = JSON.stringify(value, null, 2)
    if (typeof json === 'string') {
      return json
    }
  } catch {
  }

  return JSON.stringify({ value: String(value) }, null, 2)
}

export const writeProviderFailureArtifacts = async (
  providerDir: string,
  failure: Omit<ProviderFailure, 'index'>,
  rawResponse: unknown
): Promise<Pick<ProviderFailure, 'errorFile' | 'rawResponseFile'>> => {
  const errorFile = 'error.json'
  let rawResponseFile: string | undefined

  if (rawResponse !== undefined) {
    rawResponseFile = 'raw-response.json'
    await Bun.write(join(providerDir, rawResponseFile), toDiagnosticJson(rawResponse))
  }

  await Bun.write(join(providerDir, errorFile), JSON.stringify({
    service: failure.service,
    model: failure.model,
    message: failure.message,
    retryable: failure.retryable,
    ...(failure.stage ? { stage: failure.stage } : {}),
    ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
    ...(typeof failure.retryAfterMs === 'number' ? { retryAfterMs: failure.retryAfterMs } : {}),
    ...(rawResponseFile ? { rawResponseFile } : {})
  }, null, 2))

  return {
    errorFile,
    ...(rawResponseFile ? { rawResponseFile } : {})
  }
}

export const writeSkippedProviderArtifact = async (
  providerDir: string,
  reason: Pick<SttBatchBlockedProviderReason, 'service' | 'model' | 'message' | 'retryable' | 'stage' | 'status' | 'degraded'>,
  rawResponse?: unknown
): Promise<Pick<ProviderFailure, 'errorFile' | 'rawResponseFile'>> => {
  const errorFile = 'error.json'
  let rawResponseFile: string | undefined
  if (rawResponse !== undefined) {
    rawResponseFile = 'raw-response.json'
    await Bun.write(join(providerDir, rawResponseFile), toDiagnosticJson(rawResponse))
  }

  await Bun.write(join(providerDir, errorFile), JSON.stringify({
    service: reason.service,
    model: reason.model,
    message: reason.message,
    retryable: reason.retryable,
    skipped: true,
    ...(reason.stage ? { stage: reason.stage } : {}),
    ...(typeof reason.status === 'number' ? { status: reason.status } : {}),
    ...(reason.degraded === true ? { degraded: true } : {}),
    ...(rawResponseFile ? { rawResponseFile } : {})
  }, null, 2))

  return {
    errorFile,
    ...(rawResponseFile ? { rawResponseFile } : {})
  }
}

export const formatProviderFailure = (failure: ProviderFailure): string => {
  const context = [
    failure.stage ? `stage=${failure.stage}` : undefined,
    typeof failure.status === 'number' ? `status=${failure.status}` : undefined,
    failure.retryable ? 'retryable=true' : undefined
  ].filter((entry): entry is string => typeof entry === 'string')

  return context.length > 0
    ? `${failure.service}/${failure.model} (${context.join(', ')}): ${failure.message}`
    : `${failure.service}/${failure.model}: ${failure.message}`
}
