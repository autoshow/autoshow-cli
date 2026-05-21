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

const FIRECRAWL_DEFAULT_API_URL = 'https://api.firecrawl.dev'
const FIRECRAWL_CAPABILITIES = [
  'remote-html',
  'main-content',
  'full-content',
  'selectors',
  'wait',
  'timeout',
  'geo',
  'locale'
] as const

const getFirecrawlMetadataValue = (
  metadata: Record<string, unknown>,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = cleanString(metadata[key])
    if (value) {
      return value
    }
  }
  return undefined
}

const parseFirecrawlResponse = (payload: unknown): { markdown: string, web: WebArticleMetadata } => {
  if (!isRecord(payload)) {
    throw new Error('Firecrawl returned an invalid JSON payload.')
  }

  const data = isRecord(payload['data']) ? payload['data'] : null
  if (!data) {
    const fallbackMessage = cleanString(payload['error']) ?? cleanString(payload['message'])
    throw new Error(fallbackMessage ?? 'Firecrawl did not return scrape data.')
  }

  const markdown = normalizeMarkdown(data['markdown'])
  if (markdown.length === 0) {
    throw new Error('Firecrawl returned empty article markdown.')
  }

  const metadata = isRecord(data['metadata']) ? data['metadata'] : {}
  const wordCountRaw = metadata['wordCount']
  const wordCount = typeof wordCountRaw === 'number' && Number.isFinite(wordCountRaw)
    ? wordCountRaw
    : countWords(markdown)

  const web: WebArticleMetadata = {}
  const sourceUrl = getFirecrawlMetadataValue(metadata, 'sourceURL', 'sourceUrl')
  const finalUrl = getFirecrawlMetadataValue(metadata, 'finalURL', 'finalUrl', 'url')
  const title = getFirecrawlMetadataValue(metadata, 'title')
  const author = getFirecrawlMetadataValue(metadata, 'author', 'byline')
  const site = getFirecrawlMetadataValue(metadata, 'site', 'siteName', 'ogSiteName')
  const published = getFirecrawlMetadataValue(metadata, 'published', 'publishedTime', 'publishDate')
  const language = getFirecrawlMetadataValue(metadata, 'language')
  const description = getFirecrawlMetadataValue(metadata, 'description')

  if (sourceUrl) web.sourceUrl = sourceUrl
  if (finalUrl) web.finalUrl = finalUrl
  if (title) web.title = title
  if (author) web.author = author
  if (site) web.site = site
  if (published) web.published = published
  if (language) web.language = language
  web.wordCount = wordCount
  if (description) web.description = description

  return {
    markdown,
    web
  }
}

const runFirecrawlScrape = async (
  source: string,
  options?: UrlArticleRunOptions
): Promise<{ markdown: string, web: WebArticleMetadata }> => {
  assertUrlArticleOptionsSupported({
    displayName: 'Firecrawl',
    capabilities: FIRECRAWL_CAPABILITIES
  }, options)

  const baseUrl = readEnv('FIRECRAWL_API_URL') ?? FIRECRAWL_DEFAULT_API_URL
  const apiKey = readEnv('FIRECRAWL_API_KEY')
  const usingHostedApi = baseUrl === FIRECRAWL_DEFAULT_API_URL

  if (usingHostedApi && !apiKey) {
    throw new Error(
      'FIRECRAWL_API_KEY is required for --url-backend firecrawl when using the hosted API. ' +
      'Set FIRECRAWL_API_KEY or point FIRECRAWL_API_URL at a self-hosted instance.'
    )
  }

  const requestOptions = {
    ...options,
    timeoutMs: getUrlRequestTimeoutMs(options)
  }
  const response = await withUrlProviderTimeout('Firecrawl', requestOptions, async (signal) =>
    await fetch(`${baseUrl.replace(/\/$/, '')}/v2/scrape`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(buildFirecrawlScrapeRequest(source, requestOptions))
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
      ? cleanString(payload['error']) ?? cleanString(payload['message'])
      : undefined
    throw createUrlProviderHttpError('Firecrawl', 'scrape', response, errorMessage)
  }

  return parseFirecrawlResponse(payload)
}

const buildFirecrawlScrapeRequest = (
  source: string,
  options: UrlArticleRunOptions | undefined
): Record<string, unknown> => {
  const body: Record<string, unknown> = {
    url: source,
    formats: ['markdown'],
    onlyMainContent: options?.contentScope === 'full' ? false : true
  }

  if (options?.includeSelectors && options.includeSelectors.length > 0) {
    body['includeTags'] = options.includeSelectors
  }
  if (options?.excludeSelectors && options.excludeSelectors.length > 0) {
    body['excludeTags'] = options.excludeSelectors
  }
  if (typeof options?.waitMs === 'number') {
    body['waitFor'] = options.waitMs
  }
  if (typeof options?.timeoutMs === 'number') {
    body['timeout'] = options.timeoutMs
  }
  if (options?.geo?.country || options?.geo?.languages?.length) {
    body['location'] = {
      ...(options.geo.country ? { country: options.geo.country } : {}),
      ...(options.geo.languages?.length ? { languages: options.geo.languages } : {})
    }
  }

  return body
}

export const runFirecrawlUrl = async (
  source: string,
  sourceUrl: string | undefined,
  options?: UrlArticleRunOptions
): Promise<UrlArticleRunResult> => {
  l.write('info', 'Using Firecrawl backend for article extraction')
  const firecrawlResult = await runFirecrawlScrape(source, options)
  const htmlFallback = await tryFetchRemoteHtml(source)

  const markdown = ensureMeaningfulMarkdown(firecrawlResult.markdown, 'firecrawl')
  const web = { ...firecrawlResult.web }
  if (sourceUrl) web.sourceUrl = sourceUrl
  if (!web.finalUrl && htmlFallback?.finalUrl) web.finalUrl = htmlFallback.finalUrl

  return {
    markdown,
    web,
    fileSize: htmlFallback?.fileSize ?? byteLength(markdown),
    title: firecrawlResult.web.title ?? fallbackTitleFromSource(source),
    ...(firecrawlResult.web.author ? { author: firecrawlResult.web.author } : {})
  }
}

export const firecrawlArticleAdapter: UrlArticleProviderAdapter = {
  id: 'firecrawl',
  displayName: 'Firecrawl',
  capabilities: FIRECRAWL_CAPABILITIES,
  run: runFirecrawlUrl
}
