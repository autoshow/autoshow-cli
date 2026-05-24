import * as l from '~/utils/logger'
import { SUPADATA_DEFAULT_BASE_URL } from '~/utils/base-urls'
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

const SUPADATA_CAPABILITIES = [
  'remote-html',
  'main-content',
  'timeout'
] as const

const parseSupadataResponse = (
  payload: unknown,
  source: string
): { markdown: string, web: WebArticleMetadata } => {
  if (!isRecord(payload)) {
    throw new Error('Supadata returned an invalid JSON payload.')
  }

  const errorField = cleanString(payload['error'])
  const messageField = cleanString(payload['message'])
  const detailsField = cleanString(payload['details'])
  if (errorField) {
    throw new Error(
      `Supadata scrape error: ${messageField ?? errorField}${detailsField ? ` — ${detailsField}` : ''}`
    )
  }

  const markdown = normalizeMarkdown(payload['content'])
  if (markdown.length === 0) {
    throw new Error('Supadata returned empty article markdown.')
  }

  const name = cleanString(payload['name'])
  const description = cleanString(payload['description'])
  const scrapedUrl = cleanString(payload['url'])
  const ogUrl = cleanString(payload['ogUrl'])
  const wordCount = countWords(markdown)

  const web: WebArticleMetadata = {}
  if (scrapedUrl) web.sourceUrl = scrapedUrl
  if (scrapedUrl && scrapedUrl !== source) web.finalUrl = scrapedUrl
  if (name) web.title = name
  if (description) web.description = description
  web.wordCount = wordCount
  if (ogUrl) {
    if (!web.finalUrl) web.finalUrl = ogUrl
  }

  return { markdown, web }
}

const runSupadataScrape = async (
  source: string,
  options?: UrlArticleRunOptions
): Promise<{ markdown: string, web: WebArticleMetadata }> => {
  assertUrlArticleOptionsSupported({
    displayName: 'Supadata',
    capabilities: SUPADATA_CAPABILITIES
  }, options)

  const baseUrl = SUPADATA_DEFAULT_BASE_URL
  const apiKey = readEnv('SUPADATA_API_KEY')

  if (!apiKey) {
    throw new Error(
      'SUPADATA_API_KEY is required for --url-provider supadata. ' +
      'Set SUPADATA_API_KEY or use a different URL backend.'
    )
  }

  const scrapeUrl = `${baseUrl.replace(/\/$/, '')}/web/scrape?url=${encodeURIComponent(source)}`

  const requestOptions = {
    ...options,
    timeoutMs: getUrlRequestTimeoutMs(options)
  }
  const response = await withUrlProviderTimeout('Supadata', requestOptions, async (signal) =>
    await fetch(scrapeUrl, {
      method: 'GET',
      signal,
      headers: {
        'x-api-key': apiKey
      }
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
      ? cleanString(payload['message']) ?? cleanString(payload['details']) ?? cleanString(payload['error'])
      : undefined
    throw createUrlProviderHttpError('Supadata', 'scrape', response, errorMessage)
  }

  return parseSupadataResponse(payload, source)
}

export const runSupadataUrl = async (
  source: string,
  sourceUrl: string | undefined,
  options?: UrlArticleRunOptions
): Promise<UrlArticleRunResult> => {
  l.write('info', 'Using Supadata backend for article extraction')
  const supadataResult = await runSupadataScrape(source, options)
  const htmlFallback = await tryFetchRemoteHtml(source)

  const markdown = ensureMeaningfulMarkdown(supadataResult.markdown, 'supadata')
  const web = { ...supadataResult.web }
  if (sourceUrl) web.sourceUrl = sourceUrl
  if (!web.finalUrl && htmlFallback?.finalUrl) web.finalUrl = htmlFallback.finalUrl

  return {
    markdown,
    web,
    fileSize: htmlFallback?.fileSize ?? byteLength(markdown),
    title: supadataResult.web.title ?? fallbackTitleFromSource(source),
    ...(supadataResult.web.author ? { author: supadataResult.web.author } : {})
  }
}

export const supadataArticleAdapter: UrlArticleProviderAdapter = {
  id: 'supadata',
  displayName: 'Supadata',
  capabilities: SUPADATA_CAPABILITIES,
  run: runSupadataUrl
}
