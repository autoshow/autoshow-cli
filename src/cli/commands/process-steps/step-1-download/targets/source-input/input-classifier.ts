import { extname } from 'node:path'
import { fileExists } from '~/utils/cli-utils'
import { MEDIA_EXTENSIONS } from '../../media-extensions'
import { detectDocumentFormat } from '../../document/detect-format'
import type { DetectResult, InputFamily, InputKind, RuntimeOptions } from '~/types'

export const DOCUMENT_EXTENSIONS = [
  '.pdf', '.epub', '.docx', '.pptx', '.xlsx', '.odt', '.ods', '.odp',
  '.mobi', '.azw3', '.azw', '.fb2', '.lit', '.cbz', '.rtf', '.csv',
  '.html', '.htm'
]
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.bmp', '.gif']
const HTML_DOCUMENT_EXTENSIONS = ['.html', '.htm'] as const
const DOCUMENT_MIME_HINTS = [
  'application/pdf',
  'application/epub+zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/rtf',
  'text/rtf',
  'text/csv'
] as const
const HTML_MIME_HINTS = ['text/html', 'application/xhtml+xml'] as const
const PROBE_TIMEOUT_MS = 5000
const URL_PROBE_USER_AGENT = 'Mozilla/5.0 (compatible; autoshow-cli/0.1; +https://github.com/ajcwebdev/autoshow-cli)'

export const isLikelyUrl = (input: string): boolean => {
  try {
    const parsed = new URL(input)
    return !!parsed.protocol && !!parsed.host
  } catch {
    return false
  }
}

const isHtmlMimeType = (contentType: string): boolean =>
  HTML_MIME_HINTS.some((hint) => contentType.includes(hint))

const isDocumentMimeType = (contentType: string): boolean =>
  DOCUMENT_MIME_HINTS.some((hint) => contentType.includes(hint))

const isMediaMimeType = (contentType: string): boolean =>
  contentType.startsWith('audio/') || contentType.startsWith('video/')

const hasHtmlExtension = (path: string): boolean => {
  const lower = path.toLowerCase()
  return HTML_DOCUMENT_EXTENSIONS.some(ext => lower.endsWith(ext))
}

const isDirectMediaUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return MEDIA_EXTENSIONS.some(ext => pathname.endsWith(ext))
  } catch {
    return false
  }
}

const isDocumentUrl = (url: string): boolean => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return isDocumentByExtension(pathname)
  } catch {
    return false
  }
}

const isXHost = (host: string): boolean =>
  host === 'x.com' || host === 'twitter.com'
  || host === 'mobile.x.com' || host === 'mobile.twitter.com'
  || host === 'www.x.com' || host === 'www.twitter.com'

const isXSpaceUrl = (url: string): boolean => {
  try {
    const { hostname, pathname } = new URL(url)
    return isXHost(hostname.toLowerCase())
      && /^\/i\/spaces\/[A-Za-z0-9]{1,13}\/?$/.test(pathname)
  } catch {
    return false
  }
}

const isXPostUrl = (url: string): boolean => {
  try {
    const { hostname, pathname } = new URL(url)
    return isXHost(hostname.toLowerCase())
      && /^\/(?:[A-Za-z0-9_]{1,15}\/status(?:es)?|i\/web\/status)\/\d+\/?$/.test(pathname)
  } catch {
    return false
  }
}

const isStreamingUrl = (url: string): boolean => {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host.includes('youtube.com')
      || host.includes('youtu.be')
      || host.includes('twitch.tv')
      || host.includes('tiktok.com')
  } catch {
    return false
  }
}

const shouldAssumeHtmlArticle = (
  url: string,
  opts?: Pick<RuntimeOptions, 'urlBackendExplicit'>
): boolean =>
  opts?.urlBackendExplicit === true && /^https?:\/\//i.test(url)

const probeHeaders = async (
  url: string,
  init: RequestInit
): Promise<Headers | null> => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    try {
      await response.body?.cancel()
    } catch {
    }

    if (!response.ok) {
      return null
    }

    return response.headers
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

const probeUrlHeaders = async (url: string): Promise<Headers | null> => {
  const headHeaders = await probeHeaders(url, { method: 'HEAD' })
  if (headHeaders) {
    return headHeaders
  }

  const rangeHeaders = await probeHeaders(url, {
    method: 'GET',
    headers: { Range: 'bytes=0-0' }
  })
  if (rangeHeaders) {
    return rangeHeaders
  }

  return await probeHeaders(url, {
    method: 'GET',
    headers: {
      'User-Agent': URL_PROBE_USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'
    }
  })
}

export const hasSupportedExtension = (path: string): boolean => {
  const lower = path.toLowerCase()
  return [...MEDIA_EXTENSIONS, ...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS].some(ext => lower.endsWith(ext))
}

export const isDocumentByExtension = (path: string): boolean => {
  const lower = path.toLowerCase()
  return [...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS].some(ext => lower.endsWith(ext))
}

export const isHtmlDocumentPath = (path: string): boolean =>
  hasHtmlExtension(path)

export const classifyUrlInput = async (
  url: string,
  opts?: Pick<RuntimeOptions, 'urlBackendExplicit'>
): Promise<InputKind> => {
  if (isDocumentUrl(url)) {
    return hasHtmlExtension(new URL(url).pathname) ? 'url_html_article' : 'url_direct_document'
  }
  if (isDirectMediaUrl(url)) {
    return 'url_direct_media'
  }
  if (isXSpaceUrl(url) || isXPostUrl(url)) {
    return 'url_x_space'
  }
  if (isStreamingUrl(url)) {
    return 'url_streaming'
  }

  const headers = await probeUrlHeaders(url)
  if (headers) {
    const contentType = (headers.get('content-type') ?? '').toLowerCase()
    const contentDisposition = (headers.get('content-disposition') ?? '').toLowerCase()

    if (contentDisposition && DOCUMENT_EXTENSIONS.some(ext => contentDisposition.includes(ext))) {
      return contentDisposition.includes('.html') || contentDisposition.includes('.htm')
        ? 'url_html_article'
        : 'url_direct_document'
    }

    if (isDocumentMimeType(contentType)) {
      return 'url_direct_document'
    }

    if (isMediaMimeType(contentType)) {
      return 'url_direct_media'
    }

    if (isHtmlMimeType(contentType)) {
      return 'url_html_article'
    }
  }

  if (shouldAssumeHtmlArticle(url, opts)) {
    return 'url_html_article'
  }

  return 'url_streaming'
}

export const isDocumentLikeTarget = async (
  target: string,
  opts?: Pick<RuntimeOptions, 'urlBackendExplicit'>
): Promise<boolean> => {
  if (isLikelyUrl(target)) {
    const kind = await classifyUrlInput(target, opts)
    return kind === 'url_direct_document' || kind === 'url_html_article'
  }

  return isDocumentByExtension(target)
}

export const isHtmlArticleTarget = async (
  target: string,
  opts?: Pick<RuntimeOptions, 'urlBackendExplicit'>
): Promise<boolean> => {
  if (isLikelyUrl(target)) {
    return await classifyUrlInput(target, opts) === 'url_html_article'
  }

  return isHtmlDocumentPath(target)
}

export const classifyInputFamily = async (
  target: string,
  opts?: Pick<RuntimeOptions, 'urlBackendExplicit'>
): Promise<InputFamily> => {
  if (isLikelyUrl(target)) {
    const kind = await classifyUrlInput(target, opts)
    if (kind === 'url_direct_document') {
      return 'document'
    }
    if (kind === 'url_html_article') {
      return 'html_article'
    }
    if (kind === 'url_x_space') {
      return 'x_space'
    }
    return 'media'
  }

  if (!await fileExists(target)) {
    return 'unsupported'
  }

  if (isHtmlDocumentPath(target)) {
    return 'html_article'
  }

  if (isDocumentByExtension(target)) {
    return 'document'
  }

  const detected = await detectDocumentFormat(target)
  if (detected === 'html') {
    return 'html_article'
  }
  if (detected !== null) {
    return 'document'
  }
  if (MEDIA_EXTENSIONS.some((ext) => target.toLowerCase().endsWith(ext))) {
    return 'media'
  }

  return 'unsupported'
}

const resolveDetectResultFromExtension = (
  target: string
): DetectResult | undefined => {
  const lower = target.toLowerCase()
  const extension = extname(lower)

  if (extension === '.pdf') return 'pdf'
  if (extension === '.epub') return 'epub'
  if (extension === '.docx') return 'docx'
  if (extension === '.pptx') return 'pptx'
  if (extension === '.xlsx') return 'xlsx'
  if (extension === '.odt' || extension === '.ods' || extension === '.odp') return 'odf'
  if (extension === '.mobi') return 'mobi'
  if (extension === '.azw3' || extension === '.azw') return 'azw3'
  if (extension === '.fb2') return 'fb2'
  if (extension === '.lit') return 'lit'
  if (extension === '.cbz') return 'cbz'
  if (extension === '.rtf') return 'rtf'
  if (extension === '.csv') return 'csv'
  if (extension === '.png') return 'png'
  if (extension === '.jpg' || extension === '.jpeg') return 'jpg'
  if (extension === '.tif' || extension === '.tiff') return 'tif'
  if (extension === '.webp') return 'webp'
  if (extension === '.bmp') return 'bmp'
  if (extension === '.gif') return 'gif'
  if (extension === '.html' || extension === '.htm') return 'html'

  return undefined
}

const resolveDetectResultFromContentType = (
  contentType: string
): DetectResult | undefined => {
  const normalized = contentType.toLowerCase()

  if (normalized.includes('application/pdf')) return 'pdf'
  if (normalized.includes('application/epub+zip')) return 'epub'
  if (normalized.includes('wordprocessingml.document')) return 'docx'
  if (normalized.includes('presentationml.presentation')) return 'pptx'
  if (normalized.includes('spreadsheetml.sheet')) return 'xlsx'
  if (normalized.includes('application/vnd.oasis.opendocument')) return 'odf'
  if (normalized.includes('text/csv')) return 'csv'
  if (normalized.includes('image/png')) return 'png'
  if (normalized.includes('image/jpeg')) return 'jpg'
  if (normalized.includes('image/tiff')) return 'tif'
  if (normalized.includes('image/webp')) return 'webp'
  if (normalized.includes('image/bmp')) return 'bmp'
  if (normalized.includes('image/gif')) return 'gif'
  if (isHtmlMimeType(normalized)) return 'html'

  return undefined
}

const resolveUrlDocumentFormatHint = async (
  url: string
): Promise<DetectResult | undefined> => {
  try {
    const extensionHint = resolveDetectResultFromExtension(new URL(url).pathname)
    if (extensionHint !== undefined) {
      return extensionHint
    }
  } catch {
  }

  const headers = await probeUrlHeaders(url)
  const contentType = headers?.get('content-type')
  if (typeof contentType === 'string' && contentType.length > 0) {
    const contentTypeHint = resolveDetectResultFromContentType(contentType)
    if (contentTypeHint !== undefined) {
      return contentTypeHint
    }
  }

  return undefined
}

export const resolveDocumentFormatHint = async (
  target: string,
  family: InputFamily
): Promise<DetectResult | undefined> => {
  if (family === 'html_article') {
    return 'html'
  }

  if (family !== 'document') {
    return undefined
  }

  if (isLikelyUrl(target)) {
    return await resolveUrlDocumentFormatHint(target)
  }

  const extensionHint = resolveDetectResultFromExtension(target)
  if (extensionHint !== undefined) {
    return extensionHint
  }

  return await detectDocumentFormat(target).catch(() => undefined)
}
