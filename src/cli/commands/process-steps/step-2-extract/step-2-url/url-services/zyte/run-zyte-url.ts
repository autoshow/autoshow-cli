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

const ZYTE_DEFAULT_API_URL = 'https://api.zyte.com'
const ZYTE_CAPABILITIES = [
  'remote-html',
  'main-content',
  'timeout',
  'structured-extraction'
] as const

const getZyteArticleValue = (
  article: Record<string, unknown>,
  ...keys: string[]
): string | undefined => {
  for (const key of keys) {
    const value = cleanString(article[key])
    if (value) {
      return value
    }
  }
  return undefined
}

const getZyteAuthor = (
  article: Record<string, unknown>
): string | undefined => {
  const authors = article['authors']
  if (!Array.isArray(authors)) {
    return undefined
  }

  const names = authors
    .map(author => isRecord(author) ? cleanString(author['name']) : undefined)
    .filter((name): name is string => typeof name === 'string')

  return names.length > 0 ? names.join(', ') : undefined
}

const getZytePublisher = (
  article: Record<string, unknown>
): string | undefined => {
  const publisher = article['publisher']
  if (isRecord(publisher)) {
    return cleanString(publisher['name'])
  }
  return cleanString(publisher)
}

const articleBodyToMarkdown = (
  title: string | undefined,
  body: string
): string => {
  const normalizedBody = normalizeMarkdown(body)
  if (!title) {
    return normalizedBody
  }

  const normalizedTitle = title.trim()
  if (normalizedTitle.length === 0) {
    return normalizedBody
  }

  const bodyStart = normalizedBody.slice(0, normalizedTitle.length).toLowerCase()
  if (bodyStart === normalizedTitle.toLowerCase() || normalizedBody.startsWith('#')) {
    return normalizedBody
  }

  return `# ${normalizedTitle}\n\n${normalizedBody}`
}

const parseZyteResponse = (payload: unknown): { markdown: string, web: WebArticleMetadata } => {
  if (!isRecord(payload)) {
    throw new Error('Zyte returned an invalid JSON payload.')
  }

  const article = isRecord(payload['article']) ? payload['article'] : null
  if (!article) {
    const fallbackMessage = cleanString(payload['error']) ?? cleanString(payload['message']) ?? cleanString(payload['detail'])
    throw new Error(fallbackMessage ?? 'Zyte did not return article data.')
  }

  const body = getZyteArticleValue(article, 'articleBody', 'text', 'description')
  if (!body) {
    throw new Error('Zyte returned empty article markdown.')
  }

  const title = getZyteArticleValue(article, 'headline', 'title', 'name')
  const markdown = articleBodyToMarkdown(title, body)
  const author = getZyteAuthor(article)
  const site = getZytePublisher(article)
  const finalUrl = getZyteArticleValue(article, 'canonicalUrl', 'url')
  const published = getZyteArticleValue(article, 'datePublished', 'datePublishedRaw')
  const language = getZyteArticleValue(article, 'inLanguage', 'language')
  const description = getZyteArticleValue(article, 'description')

  const web: WebArticleMetadata = {
    wordCount: countWords(markdown)
  }
  if (finalUrl) web.finalUrl = finalUrl
  if (title) web.title = title
  if (author) web.author = author
  if (site) web.site = site
  if (published) web.published = published
  if (language) web.language = language
  if (description) web.description = description

  return { markdown, web }
}

const runZyteExtract = async (
  source: string,
  options?: UrlArticleRunOptions
): Promise<{ markdown: string, web: WebArticleMetadata }> => {
  assertUrlArticleOptionsSupported({
    displayName: 'Zyte',
    capabilities: ZYTE_CAPABILITIES
  }, options)

  const baseUrl = readEnv('ZYTE_API_URL') ?? ZYTE_DEFAULT_API_URL
  const apiKey = readEnv('ZYTE_API_KEY')
  const usingHostedApi = baseUrl === ZYTE_DEFAULT_API_URL

  if (usingHostedApi && !apiKey) {
    throw new Error(
      'ZYTE_API_KEY is required for --url-provider zyte when using the hosted API. ' +
      'Set ZYTE_API_KEY or point ZYTE_API_URL at a compatible endpoint.'
    )
  }

  const requestOptions = {
    ...options,
    timeoutMs: getUrlRequestTimeoutMs(options)
  }
  const response = await withUrlProviderTimeout('Zyte', requestOptions, async (signal) =>
    await fetch(`${baseUrl.replace(/\/$/, '')}/v1/extract`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}` } : {})
      },
      body: JSON.stringify({
        url: source,
        article: true
      })
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
      ? cleanString(payload['detail']) ?? cleanString(payload['title']) ?? cleanString(payload['error']) ?? cleanString(payload['message'])
      : undefined
    throw createUrlProviderHttpError('Zyte', 'extract', response, errorMessage)
  }

  return parseZyteResponse(payload)
}

export const runZyteUrl = async (
  source: string,
  sourceUrl: string | undefined,
  options?: UrlArticleRunOptions
): Promise<UrlArticleRunResult> => {
  l.write('info', 'Using Zyte backend for article extraction')
  const zyteResult = await runZyteExtract(source, options)
  const htmlFallback = await tryFetchRemoteHtml(source)

  const markdown = ensureMeaningfulMarkdown(zyteResult.markdown, 'zyte')
  const web = { ...zyteResult.web }
  if (sourceUrl) web.sourceUrl = sourceUrl
  if (!web.finalUrl && htmlFallback?.finalUrl) web.finalUrl = htmlFallback.finalUrl

  return {
    markdown,
    web,
    fileSize: htmlFallback?.fileSize ?? byteLength(markdown),
    title: zyteResult.web.title ?? fallbackTitleFromSource(source),
    ...(zyteResult.web.author ? { author: zyteResult.web.author } : {})
  }
}

export const zyteArticleAdapter: UrlArticleProviderAdapter = {
  id: 'zyte',
  displayName: 'Zyte',
  capabilities: ZYTE_CAPABILITIES,
  run: runZyteUrl
}
