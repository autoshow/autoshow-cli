import type { HtmlArticleBackend } from '~/types'
import { defuddleArticleAdapter } from './url-local/defuddle/run-defuddle-url'
import { firecrawlArticleAdapter } from './url-services/firecrawl/run-firecrawl-url'
import { glmReaderArticleAdapter } from './url-services/glm-reader/run-glm-reader-url'
import { spiderArticleAdapter } from './url-services/spider/run-spider-url'
import { zyteArticleAdapter } from './url-services/zyte/run-zyte-url'
import type { UrlArticleProviderAdapter, UrlArticleRunOptions } from './url-provider-adapter'
import {
  getUrlRequestAttempts,
  getUrlRequestTimeoutMs,
  type UrlArticleRunResult
} from './url-utils'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { isAppError } from '~/utils/error-handler'

export const URL_ARTICLE_BACKENDS = [
  'defuddle',
  'firecrawl',
  'glm-reader',
  'spider',
  'zyte'
] as const satisfies readonly HtmlArticleBackend[]

export const HOSTED_URL_ARTICLE_BACKENDS = URL_ARTICLE_BACKENDS.filter(
  (backend) => backend !== 'defuddle'
) as Exclude<HtmlArticleBackend, 'defuddle'>[]

export const URL_ARTICLE_PROVIDER_ADAPTERS: Record<HtmlArticleBackend, UrlArticleProviderAdapter> = {
  defuddle: defuddleArticleAdapter,
  firecrawl: firecrawlArticleAdapter,
  'glm-reader': glmReaderArticleAdapter,
  spider: spiderArticleAdapter,
  zyte: zyteArticleAdapter
}

export const getUrlArticleProviderAdapter = (
  backend: HtmlArticleBackend
): UrlArticleProviderAdapter => URL_ARTICLE_PROVIDER_ADAPTERS[backend]

export type UrlArticleProviderRunWithStats = {
  article: UrlArticleRunResult
  attempts: number
}

const URL_PROVIDER_RETRY_POLICY = {
  baseDelayMs: 2_000,
  maxDelayMs: 10_000,
  jitter: true,
  exponential: true
} as const

const enrichUrlRetryError = (
  error: unknown,
  providerLabel: string,
  timeoutMs: number,
  attemptsMade: number,
  maxAttempts: number
): Error => {
  if (!isAppError(error) || error.kind !== 'retry_exhausted') {
    return error instanceof Error ? error : new Error(String(error))
  }

  const elapsedMs = typeof error.metadata['elapsedMs'] === 'number' ? error.metadata['elapsedMs'] : undefined
  const causeMessage = error.cause?.message ?? error.message
  const attempts = typeof error.metadata['attemptsMade'] === 'number' ? error.metadata['attemptsMade'] : attemptsMade
  const max = typeof error.metadata['maxAttempts'] === 'number' ? error.metadata['maxAttempts'] : maxAttempts
  const enriched = new Error(
    `${providerLabel} request failed after ${attempts}/${max} attempts with ${timeoutMs}ms timeout` +
    `${typeof elapsedMs === 'number' ? ` (${elapsedMs}ms elapsed)` : ''}: ${causeMessage}`,
    { cause: error }
  )
  Object.assign(enriched, {
    attemptsMade: attempts,
    maxAttempts: max,
    timeoutMs,
    elapsedMs,
    provider: providerLabel,
    retryClass: error.retryClass,
    retryable: error.retryable,
    status: error.status
  })
  return enriched
}

export const runUrlArticleProviderWithStats = async (
  backend: HtmlArticleBackend,
  source: string,
  sourceUrl: string | undefined,
  options?: UrlArticleRunOptions
): Promise<UrlArticleProviderRunWithStats> => {
  const adapter = getUrlArticleProviderAdapter(backend)
  const timeoutMs = getUrlRequestTimeoutMs(options)
  const maxAttempts = getUrlRequestAttempts(options)
  let attemptsMade = 0

  try {
    const article = await withRetry(
      {
        retryClass: 'runtime_http_read',
        operationName: `${adapter.displayName} request`,
        timeoutMs,
        policy: {
          ...URL_PROVIDER_RETRY_POLICY,
          maxAttempts
        }
      },
      async (signal) => {
        attemptsMade += 1
        return await adapter.run(source, sourceUrl, {
          ...options,
          timeoutMs,
          requestAttempts: maxAttempts,
          requestSignal: signal
        })
      },
      (error) => classifyFetchRetry(error, 'runtime_http_read')
    )
    return { article, attempts: attemptsMade }
  } catch (error) {
    throw enrichUrlRetryError(error, adapter.displayName, timeoutMs, attemptsMade, maxAttempts)
  }
}

export const runUrlArticleProvider = async (
  backend: HtmlArticleBackend,
  source: string,
  sourceUrl: string | undefined,
  options?: UrlArticleRunOptions
): Promise<UrlArticleRunResult> =>
  (await runUrlArticleProviderWithStats(backend, source, sourceUrl, options)).article
