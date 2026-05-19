import { stat } from 'node:fs/promises'
import { basename, resolve as pathResolve } from 'node:path'
import type { HtmlArticleBackend, WebArticleMetadata } from '~/types'

export const HTML_FETCH_TIMEOUT_MS = 15000

const MIN_MEANINGFUL_MARKDOWN_CHARS = 50
const ARTICLE_FETCH_USER_AGENT = 'Mozilla/5.0 (compatible; autoshow-cli/0.1; +https://github.com/ajcwebdev/autoshow-cli)'

export type UrlArticleRunResult = {
  markdown: string
  web: WebArticleMetadata
  fileSize: number
  title: string
  author?: string
}

export type RemoteHtmlFetchResult = {
  html: string
  finalUrl: string
  fileSize: number
}

export type LocalHtmlReadResult = {
  html: string
  fileSize: number
  localFileUrl: string
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const cleanString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

export const byteLength = (value: string): number =>
  new TextEncoder().encode(value).byteLength

export const isRemoteSource = (source: string): boolean =>
  /^https?:\/\//i.test(source)

export const getLocalBaseName = (source: string): string => {
  const fileName = basename(source).trim()
  const withoutExtension = fileName.replace(/\.[^.]+$/, '')
  return withoutExtension.length > 0 ? withoutExtension : fileName
}

export const fallbackTitleFromSource = (source: string): string => {
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

export const withTimeout = async <T>(
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

export const fetchRemoteHtml = async (
  source: string
): Promise<RemoteHtmlFetchResult> => {
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

export const tryFetchRemoteHtml = async (
  source: string
): Promise<RemoteHtmlFetchResult | null> => {
  try {
    return await fetchRemoteHtml(source)
  } catch {
    return null
  }
}

export const readLocalHtml = async (
  source: string
): Promise<LocalHtmlReadResult> => {
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

export const countWords = (text: string): number => {
  const tokens = text.split(/\s+/).filter(Boolean)
  return tokens.length
}

export const normalizeMarkdown = (value: unknown): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

export const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const ensureMeaningfulMarkdown = (
  markdown: string,
  backend: HtmlArticleBackend
): string => {
  if (markdown.length >= MIN_MEANINGFUL_MARKDOWN_CHARS) {
    return markdown
  }

  if (backend === 'defuddle') {
    throw new Error(
      'Defuddle could not extract meaningful article content. ' +
      'The page may require client-side rendering. Retry with a remote --url-backend such as firecrawl, spider, or zyte.'
    )
  }

  if (backend === 'glm-reader') {
    throw new Error('GLM Reader returned empty article markdown.')
  }
  if (backend === 'spider') {
    throw new Error('Spider returned empty article markdown.')
  }
  if (backend === 'zyte') {
    throw new Error('Zyte returned empty article markdown.')
  }

  throw new Error('Firecrawl returned empty article markdown.')
}
