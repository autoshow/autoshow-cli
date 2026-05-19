import type {
  RetryClass,
  SupadataHttpError,
  SupadataJobStatus
} from '~/types'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'
import {
  extractSupadataErrorMessage,
  parseSupadataJobStatus,
  readJsonOrText
} from './supadata-response-parsers'
import {
  buildSupadataUrl,
  toSupadataHttpError,
  type SupadataRequestMetrics
} from './supadata-utils'

const REQUEST_TIMEOUT_MS = 70_000
const POLL_REQUEST_TIMEOUT_MS = 60_000

export const fetchSupadataTranscript = async (
  input: {
    baseURL: string
    apiKey: string
    sourceUrl: string
    modelName: string
    language?: string | undefined
    metrics?: SupadataRequestMetrics | undefined
  }
): Promise<{ status: number, headers: Headers, payload: unknown }> =>
  await withRetry(
    {
      retryClass: 'runtime_http_create_conservative',
      operationName: 'supadata-create-transcript',
      policy: { maxAttempts: 3 },
      timeoutMs: REQUEST_TIMEOUT_MS
    },
    async (signal) => {
      input.metrics?.onRequest?.()
      const requestUrl = new URL(buildSupadataUrl(input.baseURL, '/transcript'))
      requestUrl.searchParams.set('url', input.sourceUrl)
      requestUrl.searchParams.set('text', 'false')
      requestUrl.searchParams.set('mode', input.modelName)
      if (input.modelName !== 'generate' && typeof input.language === 'string' && input.language.trim().length > 0) {
        requestUrl.searchParams.set('lang', input.language.trim())
      }

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'x-api-key': input.apiKey
        },
        signal: signal ?? null
      })
      const payload = await readJsonOrText(response)

      if (response.status === 206) {
        throw Object.assign(
          new Error(`Supadata transcript unavailable (${response.status}): ${extractSupadataErrorMessage(payload) ?? 'Transcript unavailable'}`),
          {
            status: response.status,
            headers: response.headers,
            stage: 'create',
            retryClass: 'runtime_http_create_conservative',
            retryable: false,
            rawResponse: payload
          } satisfies Pick<SupadataHttpError, 'status' | 'headers' | 'stage' | 'retryClass' | 'retryable' | 'rawResponse'>
        )
      }

      if (!response.ok && response.status !== 202) {
        throw toSupadataHttpError('create', 'runtime_http_create_conservative', response, payload)
      }

      return {
        status: response.status,
        headers: response.headers,
        payload
      }
    },
    (error) => {
      const decision = classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
      if (decision.shouldRetry) {
        input.metrics?.onRetry?.((error as { status?: unknown }).status as number | undefined)
      }
      return decision
    }
  )

export const pollSupadataTranscriptJob = async (
  input: {
    baseURL: string
    apiKey: string
    jobId: string
    metrics?: SupadataRequestMetrics | undefined
  }
): Promise<{ status: SupadataJobStatus, retryAfterMs: number | null }> =>
  await withRetry(
    {
      retryClass: 'runtime_http_read',
      operationName: 'supadata-poll-transcript',
      policy: { maxAttempts: 4 },
      timeoutMs: POLL_REQUEST_TIMEOUT_MS
    },
    async (signal) => {
      input.metrics?.onRequest?.()
      const response = await fetch(buildSupadataUrl(input.baseURL, `/transcript/${input.jobId}`), {
        method: 'GET',
        headers: {
          'x-api-key': input.apiKey
        },
        signal: signal ?? null
      })
      const payload = await readJsonOrText(response)
      if (!response.ok) {
        throw toSupadataHttpError('poll', 'runtime_http_read', response, payload, 'Supadata polling failed')
      }

      const parsed = parseSupadataJobStatus(payload)
      if (!parsed) {
        throw Object.assign(new Error('Supadata returned an invalid job status payload'), {
          stage: 'poll',
          retryClass: 'runtime_http_read' as RetryClass,
          rawResponse: payload
        })
      }

      return {
        status: parsed,
        retryAfterMs: parseRetryAfterMs(response.headers) ?? null
      }
    },
    (error) => {
      const decision = classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
      if (decision.shouldRetry) {
        input.metrics?.onRetry?.((error as { status?: unknown }).status as number | undefined)
      }
      return decision
    }
  )
