import { stat } from 'node:fs/promises'
import { basename, resolve as pathResolve } from 'node:path'
import { parseHTML } from 'linkedom'
import { Defuddle } from 'defuddle/node'
import * as l from '~/logger'
import { normalizeBatchChildPublishedAt, reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { createUniqueDirectoryName, sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { ensureDirectory } from '~/utils/cli-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { DocumentMetadataSchema, type BatchChildRunContext, type HtmlArticleBackend, type PreparedDocument, type WebArticleMetadata } from '~/types'
import { runGlmReader } from './glm-reader'

const HTML_FETCH_TIMEOUT_MS = 15000
const FIRECRAWL_DEFAULT_API_URL = 'https://api.firecrawl.dev'
const MIN_MEANINGFUL_MARKDOWN_CHARS = 50
const ARTICLE_FETCH_USER_AGENT = 'Mozilla/5.0 (compatible; autoshow-cli/0.1; +https://github.com/ajcwebdev/autoshow-cli)'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cleanString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const byteLength = (value: string): number =>
  new TextEncoder().encode(value).byteLength

const isRemoteSource = (source: string): boolean =>
  /^https?:\/\//i.test(source)

const getLocalBaseName = (source: string): string => {
  const fileName = basename(source).trim()
  const withoutExtension = fileName.replace(/\.[^.]+$/, '')
  return withoutExtension.length > 0 ? withoutExtension : fileName
}

const fallbackTitleFromSource = (source: string): string => {
  if (!isRemoteSource(source)) {
    return getLocalBaseName(source)
  }

  try {
    const parsed = new URL(source)
    const lastPathSegment = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        try {
          return decodeURIComponent(segment)
        } catch {
          return segment
        }
      })
      .pop()

    if (lastPathSegment) {
      const withoutExtension = lastPathSegment.replace(/\.[^.]+$/, '').trim()
      if (withoutExtension.length > 0) {
        return withoutExtension
      }
    }

    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return 'article'
  }
}

const buildArticleSlug = (
  source: string,
  fallbackTitle: string
): string => {
  if (!isRemoteSource(source)) {
    return getLocalBaseName(source)
  }

  try {
    const parsed = new URL(source)
    const host = parsed.hostname.replace(/^www\./, '')
    const pathParts = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        try {
          return decodeURIComponent(segment)
        } catch {
          return segment
        }
      })
      .map(segment => segment.replace(/\.[^.]+$/, ''))
      .filter(Boolean)

    const combined = [host, ...pathParts].join('-')
    const slug = sanitizeTitleSlug(combined, 180)
    if (slug.length > 0) {
      return slug
    }
  } catch {
  }

  return sanitizeTitleSlug(fallbackTitle, 180) || 'article'
}

const withTimeout = async <T>(
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fn(controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}

const fetchRemoteHtml = async (
  source: string
): Promise<{ html: string, finalUrl: string, fileSize: number }> => {
  const response = await withTimeout(HTML_FETCH_TIMEOUT_MS, async (signal) =>
    await fetch(source, {
      signal,
      headers: {
        'User-Agent': ARTICLE_FETCH_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'
      }
    })
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch article HTML (${response.status} ${response.statusText})`)
  }

  const contentType = cleanString(response.headers.get('content-type'))?.toLowerCase() ?? ''
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new Error(`Expected an HTML article response but received "${contentType || 'unknown'}"`)
  }

  const html = await response.text()
  return {
    html,
    finalUrl: cleanString(response.url) ?? source,
    fileSize: byteLength(html)
  }
}

const tryFetchRemoteHtml = async (
  source: string
): Promise<{ html: string, finalUrl: string, fileSize: number } | null> => {
  try {
    return await fetchRemoteHtml(source)
  } catch {
    return null
  }
}

const readLocalHtml = async (
  source: string
): Promise<{ html: string, fileSize: number, localFileUrl: string }> => {
  const file = Bun.file(source)
  if (!(await file.exists())) {
    throw new Error(`File does not exist: ${source}`)
  }

  const sourceStats = await stat(source)
  if (sourceStats.size <= 0) {
    throw new Error(`Document is empty: ${source}`)
  }

  return {
    html: await file.text(),
    fileSize: sourceStats.size,
    localFileUrl: `file://${pathResolve(source)}`
  }
}

const countWords = (text: string): number => {
  const tokens = text.split(/\s+/).filter(Boolean)
  return tokens.length
}

const normalizeMarkdown = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

const ensureMeaningfulMarkdown = (
  markdown: string,
  backend: HtmlArticleBackend
): string => {
  if (markdown.length >= MIN_MEANINGFUL_MARKDOWN_CHARS) {
    return markdown
  }

  if (backend === 'defuddle') {
    throw new Error(
      'Defuddle could not extract meaningful article content. ' +
      'The page may require client-side rendering. Retry with --url-backend firecrawl.'
    )
  }

  if (backend === 'glm-reader') {
    throw new Error('GLM Reader returned empty article markdown.')
  }

  throw new Error('Firecrawl returned empty article markdown.')
}

const buildDefuddleWebMetadata = (
  sourceUrl: string | undefined,
  finalUrl: string | undefined,
  parsed: Record<string, unknown>,
  markdown: string
): WebArticleMetadata => {
  const web: WebArticleMetadata = {}
  const title = cleanString(parsed['title'])
  const author = cleanString(parsed['author'])
  const site = cleanString(parsed['site'])
  const published = cleanString(parsed['published'])
  const language = cleanString(parsed['language'])
  const description = cleanString(parsed['description'])

  if (sourceUrl) web.sourceUrl = sourceUrl
  if (finalUrl) web.finalUrl = finalUrl
  if (title) web.title = title
  if (author) web.author = author
  if (site) web.site = site
  if (published) web.published = published
  if (language) web.language = language
  web.wordCount = typeof parsed['wordCount'] === 'number' && Number.isFinite(parsed['wordCount'])
    ? parsed['wordCount']
    : countWords(markdown)
  if (description) web.description = description

  return web
}

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
  const sourceUrl = getFirecrawlMetadataValue(metadata, 'sourceURL', 'sourceUrl', 'url')
  const finalUrl = getFirecrawlMetadataValue(metadata, 'finalURL', 'finalUrl')
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
  source: string
): Promise<{ markdown: string, web: WebArticleMetadata }> => {
  const baseUrl = readEnv('FIRECRAWL_API_URL') ?? FIRECRAWL_DEFAULT_API_URL
  const apiKey = readEnv('FIRECRAWL_API_KEY')
  const usingHostedApi = baseUrl === FIRECRAWL_DEFAULT_API_URL

  if (usingHostedApi && !apiKey) {
    throw new Error(
      'FIRECRAWL_API_KEY is required for --url-backend firecrawl when using the hosted API. ' +
      'Set FIRECRAWL_API_KEY or point FIRECRAWL_API_URL at a self-hosted instance.'
    )
  }

  const response = await withTimeout(HTML_FETCH_TIMEOUT_MS, async (signal) =>
    await fetch(`${baseUrl.replace(/\/$/, '')}/v1/scrape`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify({
        url: source,
        formats: ['markdown'],
        onlyMainContent: true
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
      ? cleanString(payload['error']) ?? cleanString(payload['message'])
      : undefined
    throw new Error(`Firecrawl scrape failed (${response.status} ${response.statusText})${errorMessage ? `: ${errorMessage}` : ''}`)
  }

  return parseFirecrawlResponse(payload)
}

export async function prepareHtmlArticle(
  source: string,
  outputDir: string,
  backend: HtmlArticleBackend,
  batchChildContext?: BatchChildRunContext
): Promise<PreparedDocument> {
  const remote = isRemoteSource(source)
  let resolvedBackend = backend

  if (!remote) {
    if (backend === 'firecrawl') {
      l.warn('Ignoring --url-backend firecrawl for local HTML inputs; using defuddle instead')
    } else if (backend === 'glm-reader') {
      l.warn('Ignoring --url-backend glm-reader for local HTML inputs; using defuddle instead')
    }
    resolvedBackend = 'defuddle'
  }

  const sourceUrl = remote ? source : undefined
  let markdown: string
  let web: WebArticleMetadata
  let fileSize: number
  let title: string | undefined
  let author: string | undefined

  if (resolvedBackend === 'defuddle') {
    if (remote) {
      const htmlInput = await fetchRemoteHtml(source)
      const { document } = parseHTML(htmlInput.html)
      const parsed = await Defuddle(document, htmlInput.finalUrl, {
        markdown: true,
        useAsync: false
      }) as unknown as Record<string, unknown>

      markdown = ensureMeaningfulMarkdown(normalizeMarkdown(parsed['content']), 'defuddle')
      web = buildDefuddleWebMetadata(sourceUrl, htmlInput.finalUrl, parsed, markdown)
      fileSize = htmlInput.fileSize
      title = cleanString(parsed['title']) ?? fallbackTitleFromSource(source)
      author = cleanString(parsed['author'])
    } else {
      const htmlInput = await readLocalHtml(source)
      const { document } = parseHTML(htmlInput.html)
      const parsed = await Defuddle(document, htmlInput.localFileUrl, {
        markdown: true,
        useAsync: false
      }) as unknown as Record<string, unknown>

      markdown = ensureMeaningfulMarkdown(normalizeMarkdown(parsed['content']), 'defuddle')
      web = buildDefuddleWebMetadata(undefined, undefined, parsed, markdown)
      fileSize = htmlInput.fileSize
      title = cleanString(parsed['title']) ?? fallbackTitleFromSource(source)
      author = cleanString(parsed['author'])
    }
  } else if (resolvedBackend === 'firecrawl') {
    l.info('Using Firecrawl backend for article extraction')
    const firecrawlResult = await runFirecrawlScrape(source)
    const htmlFallback = await tryFetchRemoteHtml(source)

    markdown = ensureMeaningfulMarkdown(firecrawlResult.markdown, 'firecrawl')
    web = { ...firecrawlResult.web }
    if (sourceUrl) web.sourceUrl = sourceUrl
    if (!web.finalUrl && htmlFallback?.finalUrl) web.finalUrl = htmlFallback.finalUrl
    fileSize = htmlFallback?.fileSize ?? byteLength(markdown)
    title = firecrawlResult.web.title ?? fallbackTitleFromSource(source)
    author = firecrawlResult.web.author
  } else {
    l.info('Using GLM Reader backend for article extraction')
    const glmResult = await runGlmReader(source)
    const htmlFallback = await tryFetchRemoteHtml(source)

    markdown = ensureMeaningfulMarkdown(glmResult.preparedMarkdown, 'glm-reader')
    web = { ...glmResult.web }
    if (sourceUrl) web.sourceUrl = sourceUrl
    fileSize = htmlFallback?.fileSize ?? byteLength(markdown)
    title = glmResult.web.title ?? fallbackTitleFromSource(source)
  }

  const step1Title = title ?? fallbackTitleFromSource(source)
  const step1Slug = buildArticleSlug(remote ? (web.finalUrl ?? source) : source, step1Title)
  const step1Metadata = validateData(DocumentMetadataSchema, {
    ...(step1Title ? { title: step1Title } : {}),
    slug: step1Slug,
    ...(author ? { author } : {}),
    pageCount: 1,
    format: 'html',
    fileSize
  }, 'html article metadata')

  const effectiveBaseDir = outputDir.trim().length > 0 ? outputDir : './output'
  const preparedOutputDir = await reserveBatchChildOutputDir(batchChildContext, {
    slug: step1Slug,
    publishedAt: batchChildContext?.batchItem?.publishedAt ?? normalizeBatchChildPublishedAt(web.published),
    fallbackLabel: step1Title || step1Slug || 'article'
  }) ?? `${effectiveBaseDir}/${createUniqueDirectoryName(step1Title || step1Slug || 'article')}`
  await ensureDirectory(preparedOutputDir)

  return {
    outputDir: preparedOutputDir,
    step1Metadata,
    preparedMarkdown: markdown,
    htmlArticleBackend: resolvedBackend,
    web
  }
}
