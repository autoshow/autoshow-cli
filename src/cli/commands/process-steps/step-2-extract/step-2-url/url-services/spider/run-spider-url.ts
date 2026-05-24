import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'
import type { WebArticleMetadata } from '~/types'
import {
  byteLength,
  cleanString,
  countWords,
  createUrlProviderHttpError,
  ensureMeaningfulMarkdown,
  fallbackTitleFromSource,
  getUrlRequestTimeoutMs,
  isRecord,
  normalizeMarkdown,
  tryFetchRemoteHtml,
  withUrlProviderTimeout,
  type UrlArticleRunResult
} from '../../url-utils'
import {
  assertUrlArticleOptionsSupported,
  type UrlArticleProviderAdapter,
  type UrlArticleRunOptions
} from '../../url-provider-adapter'

const SPIDER_DEFAULT_API_URL = 'https://api.spider.cloud'
const SPIDER_CAPABILITIES = [
  'remote-html',
  'main-content',
  'full-content',
  'selectors',
  'wait',
  'timeout',
  'geo',
  'locale'
] as const

const getSpiderValue = (
  data: Record<string, unknown>,
  metadata: Record<string, unknown>,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const dataValue = cleanString(data[key])
    if (dataValue) {
      return dataValue
    }

    const metadataValue = cleanString(metadata[key])
    if (metadataValue) {
      return metadataValue
    }
  }
  return undefined
}

const durationFromMs = (milliseconds: number): { secs: number, nanos: number } => ({
  secs: Math.floor(milliseconds / 1000),
  nanos: (milliseconds % 1000) * 1_000_000
})

const buildSpiderScrapeRequest = (
  source: string,
  options: UrlArticleRunOptions | undefined
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    url: source,
    return_format: 'markdown',
    metadata: true,
    filter_output_main_only: options?.contentScope === 'full' ? false : true
  }

  if (options?.includeSelectors && options.includeSelectors.length > 0) {
    body['root_selector'] = options.includeSelectors.join(', ')
  }
  if (options?.excludeSelectors && options.excludeSelectors.length > 0) {
    body['exclude_selector'] = options.excludeSelectors.join(', ')
  }
  if (typeof options?.waitMs === 'number') {
    body['wait_for'] = { delay: durationFromMs(options.waitMs) }
  }
  if (typeof options?.timeoutMs === 'number') {
    body['request_timeout'] = Math.ceil(options.timeoutMs / 1000)
  }
  if (options?.geo?.country) {
    body['country_code'] = options.geo.country
  }
  if (options?.geo?.locale) {
    body['locale'] = options.geo.locale
  } else if (options?.geo?.languages?.[0]) {
    body['locale'] = options.geo.languages[0]
  }

  return body
}

const parseSpiderResponse = (payload: unknown): { markdown: string, web: WebArticleMetadata } => {
  const firstResult = Array.isArray(payload) ? payload[0] : payload
  if (typeof firstResult === 'string') {
    const markdown = normalizeMarkdown(firstResult)
    if (markdown.length === 0) {
      throw new Error('Spider returned empty article markdown.')
    }
    return {
      markdown,
      web: { wordCount: countWords(markdown) }
    }
  }

  if (!isRecord(firstResult)) {
    throw new Error('Spider returned an invalid JSON payload.')
  }

  const data = isRecord(firstResult['data']) ? firstResult['data'] : firstResult
  const markdown = normalizeMarkdown(data['markdown'] ?? data['content'] ?? data['text'] ?? data['raw'])
  if (markdown.length === 0) {
    throw new Error('Spider returned empty article markdown.')
  }

  const metadata = isRecord(data['metadata']) ? data['metadata'] : {}
  const title = getSpiderValue(data, metadata, 'title')
  const author = getSpiderValue(data, metadata, 'author', 'byline')
  const site = getSpiderValue(data, metadata, 'site', 'siteName', 'ogSiteName')
  const published = getSpiderValue(data, metadata, 'published', 'publishedTime', 'publishDate', 'date')
  const language = getSpiderValue(data, metadata, 'language', 'locale')
  const description = getSpiderValue(data, metadata, 'description')
  const finalUrl = getSpiderValue(data, metadata, 'finalUrl', 'final_url', 'url')
  const sourceUrl = getSpiderValue(data, metadata, 'sourceUrl', 'source_url', 'sourceURL')
  const wordCountRaw = data['wordCount'] ?? metadata['wordCount']
  const wordCount = typeof wordCountRaw === 'number' && Number.isFinite(wordCountRaw)
    ? wordCountRaw
    : countWords(markdown)

  const web: WebArticleMetadata = { wordCount }
  if (sourceUrl) web.sourceUrl = sourceUrl
  if (finalUrl) web.finalUrl = finalUrl
  if (title) web.title = title
  if (author) web.author = author
  if (site) web.site = site
  if (published) web.published = published
  if (language) web.language = language
  if (description) web.description = description

  return { markdown, web }
}

const runSpiderScrape = async (
  source: string,
  options?: UrlArticleRunOptions
): Promise<{ markdown: string, web: WebArticleMetadata }> => {
  assertUrlArticleOptionsSupported({
    displayName: 'Spider',
    capabilities: SPIDER_CAPABILITIES
  }, options)

  const baseUrl = readEnv('SPIDER_API_URL') ?? SPIDER_DEFAULT_API_URL
  const apiKey = readEnv('SPIDER_API_KEY')
  const usingHostedApi = baseUrl === SPIDER_DEFAULT_API_URL

  if (usingHostedApi && !apiKey) {
    throw new Error(
      'SPIDER_API_KEY is required for --url-provider spider when using the hosted API. ' +
      'Set SPIDER_API_KEY or point SPIDER_API_URL at a compatible endpoint.'
    )
  }

  const requestOptions = {
    ...options,
    timeoutMs: getUrlRequestTimeoutMs(options)
  }
  const response = await withUrlProviderTimeout('Spider', requestOptions, async (signal) =>
    await fetch(`${baseUrl.replace(/\/$/, '')}/scrape`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(buildSpiderScrapeRequest(source, requestOptions))
    })
  )

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const errorMessage = isRecord(payload)
      ? cleanString(payload['error']) ?? cleanString(payload['message']) ?? cleanString(payload['detail'])
      : undefined
    throw createUrlProviderHttpError('Spider', 'scrape', response, errorMessage)
  }

  return parseSpiderResponse(payload)
}

export const runSpiderUrl = async (
  source: string,
  sourceUrl: string | undefined,
  options?: UrlArticleRunOptions
): Promise<UrlArticleRunResult> => {
  l.write('info', 'Using Spider backend for article extraction')
  const spiderResult = await runSpiderScrape(source, options)
  const htmlFallback = await tryFetchRemoteHtml(source)

  const markdown = ensureMeaningfulMarkdown(spiderResult.markdown, 'spider')
  const web = { ...spiderResult.web }
  if (sourceUrl) web.sourceUrl = sourceUrl
  if (!web.finalUrl && htmlFallback?.finalUrl) web.finalUrl = htmlFallback.finalUrl

  return {
    markdown,
    web,
    fileSize: htmlFallback?.fileSize ?? byteLength(markdown),
    title: spiderResult.web.title ?? fallbackTitleFromSource(source),
    ...(spiderResult.web.author ? { author: spiderResult.web.author } : {})
  }
}

export const spiderArticleAdapter: UrlArticleProviderAdapter = {
  id: 'spider',
  displayName: 'Spider',
  capabilities: SPIDER_CAPABILITIES,
  run: runSpiderUrl
}
