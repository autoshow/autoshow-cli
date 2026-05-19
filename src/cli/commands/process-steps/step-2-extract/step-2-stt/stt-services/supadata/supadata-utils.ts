import type { RetryClass, Step2Metadata, SupadataHttpError } from '~/types'
import { describeSupadataUnsupportedSource } from './supadata'
import {
  extractSupadataErrorMessage,
  isRecord
} from './supadata-response-parsers'

export type SupadataStage = NonNullable<SupadataHttpError['stage']>
export type SupadataRequestMetrics = {
  onRequest?: (() => void) | undefined
  onRetry?: ((status: number | undefined) => void) | undefined
}

export const buildSupadataUrl = (baseURL: string, path: string): string =>
  new URL(path.replace(/^\/+/, ''), baseURL.endsWith('/') ? baseURL : `${baseURL}/`).toString()

export const parseSupadataBillableRequests = (headers: Headers): number | undefined => {
  const raw = headers.get('x-billable-requests')
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return undefined
  }

  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

export const parsePersistedSupadataBilling = (value: unknown): Step2Metadata['billing'] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const billing = isRecord(value['billing']) ? value['billing'] : undefined
  if (!billing) {
    return undefined
  }

  const parsed: NonNullable<Step2Metadata['billing']> = {}
  if (typeof billing['creditsUsed'] === 'number' && Number.isFinite(billing['creditsUsed']) && billing['creditsUsed'] >= 0) {
    parsed.creditsUsed = billing['creditsUsed']
  }
  if (typeof billing['creditRateCents'] === 'number' && Number.isFinite(billing['creditRateCents']) && billing['creditRateCents'] >= 0) {
    parsed.creditRateCents = billing['creditRateCents']
  }
  if (billing['source'] === 'response-header' || billing['source'] === 'fallback-estimate') {
    parsed.source = billing['source']
  }

  return Object.keys(parsed).length > 0 ? parsed : undefined
}

export const toSupadataHttpError = (
  stage: SupadataStage,
  retryClass: RetryClass,
  response: Response,
  payload: unknown,
  messagePrefix = 'Supadata request failed'
): SupadataHttpError => Object.assign(
  new Error(`${messagePrefix} (${response.status}): ${extractSupadataErrorMessage(payload) ?? 'Unknown error'}`),
  {
    status: response.status,
    headers: response.headers,
    stage,
    retryClass,
    rawResponse: payload
  } satisfies Pick<SupadataHttpError, 'status' | 'headers' | 'stage' | 'retryClass' | 'rawResponse'>
)

export const attachSupadataErrorContext = (
  error: unknown,
  stage: SupadataStage,
  retryClass: RetryClass,
  rawResponse?: unknown
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as SupadataHttpError).stage = stage
  ;(source as SupadataHttpError).retryClass = retryClass
  if (rawResponse !== undefined) {
    ;(source as SupadataHttpError).rawResponse = rawResponse
  }
  throw source
}

export const buildSupadataUnsupportedSourceError = (
  sourceUrl: string | undefined
): SupadataHttpError => Object.assign(
  new Error(describeSupadataUnsupportedSource(sourceUrl)),
  {
    stage: 'create' as const,
    retryable: false,
    skipped: true
  }
)

export const buildSupadataPollingDeadlineError = (
  jobId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`Supadata timed out waiting for transcription completion for ${jobId} (deadline exceeded after ${pollDeadlineMs}ms)`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

export const buildSupadataResumeProbeError = (
  jobId: string,
  probeCount: number,
  totalWaitMs: number
): never => {
  const error = Object.assign(
    new Error(`Supadata transcript job ${jobId} is still pending after ${probeCount} resume status checks (${totalWaitMs}ms total backoff). Retry the command later.`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}
