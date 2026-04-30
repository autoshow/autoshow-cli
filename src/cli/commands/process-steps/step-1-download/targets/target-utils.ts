import { readdir } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import * as l from '~/utils/logger'
import { createHumanTable, logBatchItemTable, logLocationsTable } from '~/utils/logger/human-table'
import { runWithLogContext } from '~/utils/logger'
import { fileExists, ensureDirectory, writeFile } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { MEDIA_EXTENSIONS } from '../media-extensions'
import { detectDocumentFormat } from '../document/detect-format'
import type { ProcessCommand, RuntimeOptions } from '~/types'
import {
  commandSupportsInputFamily,
  isExtractCommand,
  isOcrCommand,
  isSttCommand
} from '~/cli/commands/process-steps/process-command-kinds'
import type {
  BatchItem,
  BatchManifestEntry,
  BatchManifestErrorEntry,
  BatchItemProcessor,
  BatchProcessResult,
  BatchRunOptions,
  DetectResult,
  InputFamily,
  InputKind,
  PlannedBatchInput,
  ResolvedInputRouting,
  SttBatchItemSummary,
  SttManifestProviderSummary,
  TopLevelTargetInfo
} from '~/types'
import { formatSttTargetLabel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { isSttPartialCompletionError } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/batch'
import { writeSttBatchManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/manifest'
import { readBatchManifest, readRunManifest, writeBatchManifest } from '~/cli/commands/process-steps/manifest-utils'
import { joinOutputRoot } from '~/cli/commands/process-steps/output-root'
import { resolveOcrStep2ExecutionFromFormat, resolveSttStep2Execution } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/resolved-step2'

export { buildOptsFromFlags } from './build-opts-from-flags'

const toManifestKind = (command: ProcessCommand): 'metadata' | 'download' | 'extract' | 'ocr' | 'stt' | 'write' => {
  if (command === 'metadata' || command === 'download' || command === 'extract' || command === 'ocr' || command === 'stt' || command === 'write') {
    return command
  }

  throw new Error(`Unsupported batch manifest command: ${command}`)
}

const getBatchManifestTitle = (
  entry: BatchManifestEntry,
  fallbackIndex: number
): string => {
  const step1 = isRecord(entry['step1']) ? entry['step1'] : undefined
  const titleCandidates = [
    step1?.['title'],
    step1?.['slug'],
    entry['title']
  ]

  for (const candidate of titleCandidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  const url = typeof step1?.['url'] === 'string'
    ? step1['url']
    : typeof entry['url'] === 'string'
      ? entry['url']
      : undefined
  if (typeof url === 'string' && url.length > 0) {
    try {
      const parsed = new URL(url)
      const leaf = basename(parsed.pathname).replace(/\.[^.]+$/, '')
      if (leaf.length > 0) {
        return leaf
      }
    } catch {
    }
  }

  const outputDir = entry['outputDir']
  if (typeof outputDir === 'string' && outputDir.trim().length > 0) {
    return basename(outputDir)
  }

  return `item-${fallbackIndex + 1}`
}

const parseSttManifestProviderSummaries = (
  entry: BatchManifestEntry
): SttManifestProviderSummary[] => {
  const providerStates = Array.isArray(entry['providerStates']) ? entry['providerStates'] : []
  const summaries: SttManifestProviderSummary[] = []

  for (const value of providerStates) {
    if (!isRecord(value) || typeof value['service'] !== 'string' || typeof value['model'] !== 'string') {
      continue
    }

    const status = value['status']
    if (status !== 'succeeded' && status !== 'missing' && status !== 'failed' && status !== 'skipped') {
      continue
    }

    const lastError = isRecord(value['lastError']) ? value['lastError'] : undefined
    const message = typeof lastError?.['message'] === 'string' && lastError['message'].trim().length > 0
      ? lastError['message'].trim()
      : undefined

    summaries.push({
      label: formatSttTargetLabel({
        service: value['service'] as Parameters<typeof formatSttTargetLabel>[0]['service'],
        model: value['model']
      }),
      status,
      ...(message ? { message } : {})
    })
  }

  return summaries
}

const countStep2Entries = (entry: BatchManifestEntry): number => {
  const step2 = entry['step2']
  if (Array.isArray(step2)) {
    return step2.filter((value) => isRecord(value)).length
  }

  return isRecord(step2) ? 1 : 0
}

const getSttManifestProviderCounts = (
  entry: BatchManifestEntry | null
): {
  succeeded: number
  failed: number
  missing: number
  skipped: number
} => {
  if (!entry) {
    return {
      succeeded: 0,
      failed: 0,
      missing: 0,
      skipped: 0
    }
  }

  const summaries = parseSttManifestProviderSummaries(entry)
  if (summaries.length > 0) {
    return summaries.reduce((counts, summary) => {
      if (summary.status === 'succeeded') {
        counts.succeeded += 1
      } else if (summary.status === 'failed') {
        counts.failed += 1
      } else if (summary.status === 'missing') {
        counts.missing += 1
      } else {
        counts.skipped += 1
      }
      return counts
    }, {
      succeeded: 0,
      failed: 0,
      missing: 0,
      skipped: 0
    })
  }

  const errors = getBatchManifestErrors(entry)
  return {
    succeeded: countStep2Entries(entry),
    failed: errors.filter((value) => value.skipped !== true).length,
    missing: 0,
    skipped: errors.filter((value) => value.skipped === true).length
  }
}

const formatBatchProviderCount = (
  count: number,
  label: string
): string => `${count} ${label}${count === 1 ? '' : 's'}`

const buildSttBatchItemDetail = (
  entry: BatchManifestEntry | null
): string | undefined => {
  const counts = getSttManifestProviderCounts(entry)
  const parts = [
    counts.failed > 0 ? formatBatchProviderCount(counts.failed, 'provider failure') : undefined,
    counts.missing > 0 ? formatBatchProviderCount(counts.missing, 'provider missing') : undefined,
    counts.skipped > 0 ? formatBatchProviderCount(counts.skipped, 'provider skipped') : undefined
  ].filter((value): value is string => typeof value === 'string')

  return parts.length > 0 ? parts.join(', ') : undefined
}

const resolveSttBatchManifestCompletionStatus = (
  entry: BatchManifestEntry
): 'full' | 'incomplete' | 'failed' | 'skipped' => {
  const completionStatus = getBatchManifestCompletionStatus(entry)
  if (completionStatus) {
    return completionStatus
  }

  const counts = getSttManifestProviderCounts(entry)
  if (counts.succeeded === 0) {
    return 'failed'
  }

  return counts.failed === 0 && counts.missing === 0 ? 'full' : 'incomplete'
}

const summarizeSttBatchManifestEntries = (
  entries: BatchManifestEntry[]
): SttBatchItemSummary[] =>
  entries.map((entry, index) => ({
    label: getBatchManifestTitle(entry, index),
    completionStatus: resolveSttBatchManifestCompletionStatus(entry),
    providers: parseSttManifestProviderSummaries(entry)
  }))

export const buildSttBatchFinalSummaryTable = (
  entries: BatchManifestEntry[]
) => {
  const summaries = summarizeSttBatchManifestEntries(entries)
  const rows = summaries.flatMap((summary, index) => {
    const base = {
      item: `${index + 1}/${summaries.length}`,
      label: summary.label,
      status: summary.completionStatus
    }

    if (summary.providers.length === 0) {
      return [{
        ...base,
        provider: 'unavailable',
        providerStatus: 'unavailable',
        detail: ''
      }]
    }

    return summary.providers.map((provider) => ({
      ...base,
      provider: provider.label,
      providerStatus: provider.status,
      detail: provider.message ?? ''
    }))
  })

  return createHumanTable(rows, ['item', 'label', 'status', 'provider', 'providerStatus', 'detail'])
}

export const logSttBatchFinalSummary = async (batchDir: string): Promise<void> => {
  const manifest = await readBatchManifest(batchDir, 'stt').catch(() => undefined)
  if (!manifest) {
    return
  }

  const summaries = summarizeSttBatchManifestEntries(manifest.manifest.items)
  if (summaries.length === 0) {
    return
  }

  const table = buildSttBatchFinalSummaryTable(manifest.manifest.items)
  const hasFailed = summaries.some((summary) =>
    summary.completionStatus === 'failed'
    || summary.providers.some((provider) => provider.status === 'failed')
  )
  const hasWarnings = hasFailed || summaries.some((summary) =>
    summary.completionStatus === 'incomplete'
    || summary.completionStatus === 'skipped'
    || summary.providers.some((provider) =>
      provider.status === 'skipped' || provider.status === 'missing'
    )
  )
  const level = hasFailed ? 'error' : hasWarnings ? 'warn' : 'success'
  l.write(level, 'STT final provider status by item', {
    category: 'artifact',
    humanTable: table,
    metadata: {
      items: summaries.map((summary, index) => ({
        item: `${index + 1}/${summaries.length}`,
        label: summary.label,
        status: summary.completionStatus,
        providers: summary.providers
      }))
    }
  })
}

export const getBatchManifestErrorCount = (entry: BatchManifestEntry | null): number => {
  if (!entry) {
    return 0
  }

  const errors = entry['errors']
  return Array.isArray(errors) ? errors.length : 0
}

export const getBatchManifestErrors = (entry: BatchManifestEntry | null): BatchManifestErrorEntry[] => {
  if (!entry) {
    return []
  }

  const errors = entry['errors']
  return Array.isArray(errors)
    ? errors.filter((value): value is BatchManifestErrorEntry => typeof value === 'object' && value !== null)
    : []
}

const buildNonSttBatchSummaryTable = (
  ok: number,
  partial: number,
  fail: number
) =>
  createHumanTable([{
    completed: ok,
    full: ok - partial,
    partial,
    failed: fail
  }], ['completed', 'full', 'partial', 'failed'])

const buildSttBatchSummaryTable = (
  ok: number,
  incomplete: number,
  fail: number
) =>
  createHumanTable([{
    full: ok,
    incomplete,
    failed: fail
  }], ['full', 'incomplete', 'failed'])

export const buildBatchPartialFailureTable = (
  entries: BatchManifestErrorEntry[]
) => {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    if (entry.skipped === true) {
      continue
    }
    if (typeof entry.service !== 'string' || typeof entry.model !== 'string') {
      continue
    }

    const key = `${entry.service}/${entry.model}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const rows = [...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([provider, failures]) => ({ provider, failures }))

  return createHumanTable(rows, ['provider', 'failures'])
}

const formatProviderFailureDetail = (count: number): string =>
  `${count} provider failure${count === 1 ? '' : 's'}`

const logBatchItemStatus = (
  level: 'info' | 'success' | 'warn' | 'error',
  item: string,
  status: 'processing' | 'done' | 'incomplete' | 'failed',
  detail?: string
): void => {
  logBatchItemTable(l, [{
    status,
    input: item,
    ...(detail ? { detail } : {})
  }], { level })
}

export const buildBatchCompletionTable = (
  command: ProcessCommand,
  ok: number,
  partial: number,
  incomplete: number,
  fail: number
)=>
  isSttCommand(command)
    ? buildSttBatchSummaryTable(ok, incomplete, fail)
    : buildNonSttBatchSummaryTable(ok, partial, fail)

const logBatchCompletionTable = (
  command: ProcessCommand,
  ok: number,
  partial: number,
  incomplete: number,
  fail: number
): void => {
  l.write(
    isSttCommand(command)
      ? (incomplete > 0 || fail > 0 ? 'warn' : 'success')
      : (partial > 0 || fail > 0 ? 'warn' : 'success'),
    'Batch Summary',
    {
      category: 'pipeline',
      humanTable: buildBatchCompletionTable(command, ok, partial, incomplete, fail),
      metadata: isSttCommand(command)
        ? { full: ok, incomplete, failed: fail }
        : { completed: ok, full: ok - partial, partial, failed: fail }
    }
  )
}

export const DOCUMENT_EXTENSIONS = [
  '.pdf', '.epub', '.docx', '.pptx', '.xlsx', '.odt', '.ods', '.odp',
  '.mobi', '.azw3', '.azw', '.fb2', '.lit', '.cbz', '.rtf', '.csv',
  '.html', '.htm'
]
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.bmp', '.gif']
const URL_LIST_EXTENSIONS = ['.md', '.txt']
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

const hasSupportedExtension = (path: string): boolean => {
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

const resolveDocumentFormatHint = async (
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

const buildBatchManifestEntryForItem = (
  item: string,
  batchItem?: BatchItem
): BatchManifestEntry => {
  if (batchItem) {
    return {
      url: batchItem.url,
      title: batchItem.title ?? 'Untitled',
      channel: batchItem.author ?? 'Unknown',
      duration: batchItem.duration ?? 'Unknown',
      ...(batchItem.publishedAt ? { publishedAt: batchItem.publishedAt } : {})
    }
  }

  const isUrl = isLikelyUrl(item)
  const title = basename(item).replace(/\.[^.]+$/, '')
  if (isUrl) {
    return { url: item, title, channel: 'URL', duration: 'Unknown' }
  }

  return { url: `file://${item}`, title, channel: 'Local', duration: 'Unknown' }
}

export const describeUnsupportedInputForCommand = (
  command: ProcessCommand,
  family: InputFamily
): string => {
  if (isExtractCommand(command)) {
    if (family === 'unsupported') {
      return 'extract could not classify this input; verify the file type or route it explicitly as media or document content'
    }
    return 'extract only processes media, documents, images, HTML articles, and X Space links'
  }

  if (isSttCommand(command)) {
    if (family === 'x_space') {
      return 'stt does not support X Space links; use extract instead'
    }
    if (family === 'document' || family === 'html_article') {
      return 'stt only processes media inputs; use ocr or write for documents and articles'
    }
    return 'stt only processes media inputs'
  }

  if (isOcrCommand(command)) {
    if (family === 'x_space') {
      return 'ocr does not support X Space links; use extract instead'
    }
    if (family === 'media') {
      return 'ocr only processes documents, images, and HTML articles; use stt or write for media'
    }
    return 'ocr only processes documents, images, and HTML articles'
  }

  return 'unsupported input'
}

export const resolveInputRoutingForCommand = async (
  command: ProcessCommand,
  target: string,
  opts?: Pick<
    RuntimeOptions,
    | 'urlBackendExplicit'
    | 'urlBackend'
    | 'step2SelectionOrigins'
    | 'useReverb'
    | 'whisperModel'
    | 'whisperModels'
    | 'gcloudSttModel'
    | 'gcloudSttModels'
    | 'awsSttModel'
    | 'awsSttModels'
    | 'deepinfraSttModel'
    | 'deepinfraSttModels'
    | 'deapiSttModel'
    | 'deapiSttModels'
    | 'elevenlabsSttModel'
    | 'elevenlabsSttModels'
    | 'deepgramSttModel'
    | 'deepgramSttModels'
    | 'sonioxSttModel'
    | 'sonioxSttModels'
    | 'speechmaticsSttModel'
    | 'speechmaticsSttModels'
    | 'revSttModel'
    | 'revSttModels'
    | 'groqSttModel'
    | 'groqSttModels'
    | 'grokSttModel'
    | 'grokSttModels'
    | 'mistralSttModel'
    | 'mistralSttModels'
    | 'assemblyaiSttModel'
    | 'assemblyaiSttModels'
    | 'gladiaSttModel'
    | 'gladiaSttModels'
    | 'happyscribeSttModel'
    | 'happyscribeSttModels'
    | 'supadataSttModel'
    | 'supadataSttModels'
    | 'useTesseract'
    | 'useOcrmypdf'
    | 'usePaddleOcr'
    | 'mistralOcrModel'
    | 'mistralOcrModels'
    | 'glmOcrModel'
    | 'glmOcrModels'
    | 'kimiOcrModel'
    | 'kimiOcrModels'
    | 'openaiOcrModel'
    | 'openaiOcrModels'
    | 'anthropicOcrModel'
    | 'anthropicOcrModels'
    | 'geminiOcrModel'
    | 'geminiOcrModels'
    | 'deepinfraOcrModel'
    | 'deepinfraOcrModels'
    | 'deapiOcrModel'
    | 'deapiOcrModels'
    | 'useEpubBun'
    | 'useEpubCalibre'
  >
): Promise<ResolvedInputRouting> => {
  const family = await classifyInputFamily(target, opts)
  const documentFormatHint = await resolveDocumentFormatHint(target, family)
  const resolvedStep2: ResolvedInputRouting['resolvedStep2'] = family === 'x_space'
    ? { route: 'unsupported' as const, sourceKind: 'unsupported' as const }
    : family === 'media'
    ? resolveSttStep2Execution((opts ?? {}) as Parameters<typeof resolveSttStep2Execution>[0])
    : family === 'document' || family === 'html_article'
      ? resolveOcrStep2ExecutionFromFormat(
          documentFormatHint ?? (family === 'html_article' ? 'html' : 'pdf'),
          {
            ...(opts ?? {}),
            localHtmlDocument: family === 'html_article' && !isLikelyUrl(target)
          } as Parameters<typeof resolveOcrStep2ExecutionFromFormat>[1]
        )
      : {
          route: 'unsupported',
          sourceKind: 'unsupported'
        }
  const supported = family !== 'unsupported' && commandSupportsInputFamily(command, family)
  const step2Route = resolvedStep2.route
  const routedChildKind = family === 'x_space' && supported
    ? 'x_space'
    : step2Route === 'stt'
    ? 'stt'
    : step2Route === 'ocr' || step2Route === 'article' || step2Route === 'native-document'
      ? 'ocr'
      : undefined

  return {
    family,
    step2Route,
    resolvedStep2,
    ...(routedChildKind ? { routedChildKind } : {}),
    supported,
    ...(!supported && (isSttCommand(command) || isOcrCommand(command) || isExtractCommand(command))
      ? { skipReason: describeUnsupportedInputForCommand(command, family) }
      : {})
  }
}

export const planBatchInputsForCommand = async (
  command: ProcessCommand,
  items: string[],
  opts: RuntimeOptions,
  selectedItems?: Array<BatchItem | undefined>,
  logSkips = true
): Promise<{
  items: string[]
  selectedItems?: Array<BatchItem | undefined>
  initialEntries: BatchManifestEntry[]
  resultEntryIndexes: number[]
  plannedInputs: PlannedBatchInput[]
}> => {
  if (command === 'write' && opts.textInput) {
    return {
      items,
      ...(selectedItems ? { selectedItems } : {}),
      initialEntries: items.map((item, index) => ({
        ...buildBatchManifestEntryForItem(item, selectedItems?.[index]),
        sourceKind: 'text-input'
      })),
      resultEntryIndexes: items.map((_, index) => index),
      plannedInputs: items.map((item, index) => ({
        input: item,
        inputFamily: 'unsupported',
        resolvedStep2: {
          route: 'unsupported',
          sourceKind: 'unsupported'
        },
        ...(selectedItems?.[index] ? { batchItem: selectedItems[index] } : {})
      }))
    }
  }

  const shouldResolveRouting = isSttCommand(command) || isOcrCommand(command) || isExtractCommand(command) || command === 'write'
  if (!shouldResolveRouting) {
    return {
      items,
      ...(selectedItems ? { selectedItems } : {}),
      initialEntries: items.map((item, index) => buildBatchManifestEntryForItem(item, selectedItems?.[index])),
      resultEntryIndexes: items.map((_, index) => index),
      plannedInputs: items.map((item, index) => ({
        input: item,
        inputFamily: 'unsupported',
        resolvedStep2: {
          route: 'unsupported',
          sourceKind: 'unsupported'
        },
        ...(selectedItems?.[index] ? { batchItem: selectedItems[index] } : {})
      }))
    }
  }

  const filteredItems: string[] = []
  const filteredSelectedItems: Array<BatchItem | undefined> = []
  const initialEntries: BatchManifestEntry[] = []
  const resultEntryIndexes: number[] = []
  const plannedInputs: PlannedBatchInput[] = []

  for (const [index, item] of items.entries()) {
    const batchItem = selectedItems?.[index]
    const routing = await resolveInputRoutingForCommand(command, item, opts)
    const entryBase = {
      ...buildBatchManifestEntryForItem(item, batchItem),
      ...(routing.family !== 'unsupported' ? { inputFamily: routing.family } : {}),
      step2Route: routing.step2Route,
      resolvedStep2: routing.resolvedStep2,
      ...(routing.routedChildKind ? { routedChildKind: routing.routedChildKind } : {})
    }
    plannedInputs.push({
      input: item,
      inputFamily: routing.family,
      resolvedStep2: routing.resolvedStep2,
      ...(routing.routedChildKind ? { routedChildKind: routing.routedChildKind } : {}),
      ...(batchItem ? { batchItem } : {})
    })

    if (!routing.supported) {
      const reason = routing.skipReason ?? describeUnsupportedInputForCommand(command, routing.family)
      if (logSkips && (isSttCommand(command) || isOcrCommand(command) || isExtractCommand(command))) {
        l.warn(`Skipping ${routing.family} input in ${command} batch: ${item} (${reason})`)
      }
      initialEntries.push({
        ...entryBase,
        completionStatus: 'skipped',
        inputFamily: routing.family,
        skipReason: reason
      })
      continue
    }

    initialEntries.push(entryBase)
    resultEntryIndexes.push(initialEntries.length - 1)
    filteredItems.push(item)
    if (batchItem) {
      filteredSelectedItems.push(batchItem)
    }
  }

  return {
    items: filteredItems,
    ...(selectedItems ? { selectedItems: filteredSelectedItems } : {}),
    initialEntries,
    resultEntryIndexes,
    plannedInputs
  }
}

export const collectInputFiles = async (dir: string): Promise<string[]> => {
  const files: string[] = []

  const walk = async (currentDir: string): Promise<void> => {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = `${currentDir}/${entry.name}`
      if (entry.isDirectory()) {
        await walk(entryPath)
        continue
      }

      if (entry.isFile() && hasSupportedExtension(entryPath)) {
        files.push(entryPath)
      }
    }
  }

  try {
    await walk(dir)
  } catch {
    return files
  }

  return files
}

const parseListEntry = (line: string): string => {
  const withoutBullet = line.replace(/^[-*]\s+/, '').trim()
  const markdownLink = withoutBullet.match(/\[[^\]]+\]\(([^)]+)\)/)
  const raw = markdownLink?.[1] ?? withoutBullet
  return raw.replace(/^`|`$/g, '').trim()
}

export const readInputList = async (filePath: string): Promise<string[]> => {
  try {
    const exists = await fileExists(filePath)
    if (!exists) {
      l.warn(`Input list not found at ${filePath}`)
      return []
    }

    const baseDir = dirname(filePath)
    const text = await Bun.file(filePath).text()
    const lines = text
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .filter(s => !s.startsWith('#'))

    const valid: string[] = []
    let invalidCount = 0

    for (const line of lines) {
      const entry = parseListEntry(line)
      if (!entry) {
        invalidCount++
        continue
      }

      if (isLikelyUrl(entry)) {
        valid.push(entry)
        continue
      }

      const resolvedPath = resolve(baseDir, entry)
      if (await fileExists(resolvedPath)) {
        valid.push(resolvedPath)
        continue
      }

      if (await fileExists(entry)) {
        valid.push(entry)
        continue
      }

      invalidCount++
    }

    if (invalidCount > 0) {
      l.warn(`Ignored ${invalidCount} invalid entries in ${filePath}`)
    }

    l.write('info', `Loaded ${valid.length} inputs from ${filePath}`)
    return valid
  } catch {
    l.error(`Failed to read input list at ${filePath}`)
    return []
  }
}

const runWithSemaphore = async <T>(
  max: number,
  sem: { active: number },
  fn: () => Promise<T>
): Promise<T> => {
  while (sem.active >= max) {
    await new Promise<void>(r => setTimeout(r, 50))
  }
  sem.active++
  try {
    return await fn()
  } finally {
    sem.active--
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getErrorOutputDir = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object' || !('outputDir' in error)) {
    return undefined
  }

  const outputDir = (error as { outputDir?: unknown }).outputDir
  return typeof outputDir === 'string' && outputDir.length > 0 ? outputDir : undefined
}

const readBatchManifestEntry = async (
  outputDir: string,
  command: ProcessCommand
): Promise<BatchManifestEntry | null> => {
  const manifest = await readRunManifest(outputDir, toManifestKind(command)).catch(() => undefined)
  if (!manifest) {
    return null
  }
  return manifest.metadata
}

const attachOutputDir = (
  manifestEntry: BatchManifestEntry | null,
  outputDir: string
): BatchManifestEntry =>
  manifestEntry
    ? { ...manifestEntry, outputDir }
    : { outputDir }

const getBatchManifestCompletionStatus = (
  entry: BatchManifestEntry | null
): 'full' | 'incomplete' | 'failed' | 'skipped' | undefined => {
  if (!entry) {
    return undefined
  }

  const completionStatus = entry['completionStatus']
  if (completionStatus === 'full' || completionStatus === 'incomplete' || completionStatus === 'failed' || completionStatus === 'skipped') {
    return completionStatus
  }

  return undefined
}

export const processBatch = async (
  items: string[],
  batchLabel: string,
  command: ProcessCommand,
  opts: RuntimeOptions,
  processSingleTarget: BatchItemProcessor,
  runOpts: BatchRunOptions = {}
): Promise<BatchProcessResult> => {
  const prefilledEntries = runOpts.initialEntries ? [...runOpts.initialEntries] : undefined

  if (items.length === 0 && (!prefilledEntries || prefilledEntries.length === 0)) {
    l.warn('No inputs to process')
    return { ok: 0, partial: 0, incomplete: 0, fail: 0 }
  }

  if (typeof runOpts.totalCount === 'number' && runOpts.totalCount > items.length) {
    const selectedCount = prefilledEntries?.length ?? items.length
    if (selectedCount < runOpts.totalCount) {
      if (items.length < selectedCount) {
        l.warn(`Processing ${items.length} runnable items from ${selectedCount} selected of ${runOpts.totalCount} total. Some selected inputs were skipped as unsupported for this command; use --batch-all to select more items.`)
      } else {
        l.warn(`Processing ${items.length} of ${runOpts.totalCount} items. Use --batch-all to process all.`)
      }
    } else {
      l.warn(`Processing ${items.length} of ${selectedCount} selected items. Some inputs were skipped as unsupported for this command.`)
    }
  }

  const batchDirName = createUniqueDirectoryName(batchLabel)
  const batchDir = runOpts.parentBatchDir
    ? join(runOpts.parentBatchDir, toManifestKind(command))
    : joinOutputRoot(batchDirName)
  await ensureDirectory(batchDir)
  logLocationsTable(l, [{ artifact: 'outputDir', path: batchDir }])

  if (runOpts.source) {
    const sourceData = {
      sourceKind: runOpts.source.sourceKind,
      sourceUrl: runOpts.source.sourceUrl,
      title: runOpts.source.title,
      author: runOpts.source.author,
      selectedCount: prefilledEntries?.length ?? items.length
    }
    await writeFile(`${batchDir}/source.json`, JSON.stringify(sourceData, null, 2))
  }

  const batchSource = runOpts.source
    ? {
        sourceKind: runOpts.source.sourceKind,
        sourceUrl: runOpts.source.sourceUrl,
        title: runOpts.source.title,
        author: runOpts.source.author,
        selectedCount: prefilledEntries?.length ?? items.length
      }
    : undefined

  let infoEntries: BatchManifestEntry[]
  if (prefilledEntries && prefilledEntries.length > 0) {
    infoEntries = prefilledEntries
  } else if (runOpts.selectedItems && runOpts.selectedItems.length > 0) {
    infoEntries = runOpts.selectedItems.map((item, index) =>
      item
        ? buildBatchManifestEntryForItem(item.url, item)
        : buildBatchManifestEntryForItem(items[index] ?? `item-${index + 1}`)
    )
  } else {
    infoEntries = items.map((item) => buildBatchManifestEntryForItem(item))
  }

  if (infoEntries.length === 0) {
    l.warn('No supported inputs to process')
    return { ok: 0, partial: 0, incomplete: 0, fail: 0, batchDir }
  }

  await writeBatchManifest(batchDir, toManifestKind(command), infoEntries, batchSource)
  logLocationsTable(l, [{ artifact: 'batchManifest', path: `${batchDir}/batch.json` }])

  const concurrency = Math.max(1, runOpts.concurrency ?? 1)
  let ok = 0
  let partial = 0
  let incomplete = 0
  let fail = 0
  let failureExitCode: number | undefined
  let hasMixedFailureCodes = false
  const finalInfoEntries = [...infoEntries]
  const partialFailureEntries: BatchManifestErrorEntry[] = []
  const resultEntryIndexes = runOpts.resultEntryIndexes ?? items.map((_, index) => index)

  const recordFailureExitCode = (error: unknown): void => {
    const exitCode = error instanceof Error && 'exitCode' in error
      ? (error as Error & { exitCode?: unknown }).exitCode
      : undefined
    if (typeof exitCode !== 'number' || !Number.isFinite(exitCode) || exitCode < 1) {
      hasMixedFailureCodes = true
      return
    }
    if (failureExitCode === undefined) {
      failureExitCode = exitCode
      return
    }
    if (failureExitCode !== exitCode) {
      hasMixedFailureCodes = true
    }
  }

  const executeBatchItem = async (
    item: string,
    index: number
  ): Promise<{
    manifestEntry: BatchManifestEntry | null
    errorCount: number
    status: 'ok' | 'partial' | 'incomplete' | 'failed'
    failureError?: unknown
  }> =>
    await runWithLogContext({ batchId: batchDirName, itemIndex: index + 1, itemCount: items.length }, async () => {
      logBatchItemStatus('info', item, 'processing')

      try {
        const batchItem = runOpts.selectedItems?.[index]
        const processed = await processSingleTarget(command, item, batchDir, opts, batchItem)
        const manifestEntry = processed?.manifestEntry
          ? (processed.outputDir ? attachOutputDir(processed.manifestEntry, processed.outputDir) : processed.manifestEntry)
          : processed?.outputDir
            ? attachOutputDir(await readBatchManifestEntry(processed.outputDir, command), processed.outputDir)
            : null
        const errorCount = getBatchManifestErrorCount(manifestEntry)

        if (isSttCommand(command)) {
          const completionStatus = getBatchManifestCompletionStatus(manifestEntry) ?? (errorCount > 0 ? 'incomplete' : 'full')
          if (completionStatus === 'full') {
            logBatchItemStatus('success', item, 'done')
            return { manifestEntry, errorCount, status: 'ok' }
          }

          if (completionStatus === 'failed') {
            logBatchItemStatus('error', item, 'failed', 'no STT provider outputs completed')
            return { manifestEntry, errorCount, status: 'failed' }
          }

          logBatchItemStatus('warn', item, 'incomplete', buildSttBatchItemDetail(manifestEntry))
          return { manifestEntry, errorCount, status: 'incomplete' }
        }

        if (errorCount > 0) {
          logBatchItemStatus('warn', item, 'done', formatProviderFailureDetail(errorCount))
          return { manifestEntry, errorCount, status: 'partial' }
        }

        logBatchItemStatus('success', item, 'done')
        return { manifestEntry, errorCount, status: 'ok' }
      } catch (error) {
        if (isSttCommand(command) && isSttPartialCompletionError(error)) {
          const manifestEntry = attachOutputDir(await readBatchManifestEntry(error.outputDir, command), error.outputDir)
          const errorCount = getBatchManifestErrorCount(manifestEntry)
          if (error.completionStatus === 'failed') {
            logBatchItemStatus('error', item, 'failed', error.message)
            return { manifestEntry, errorCount, status: 'failed', failureError: error }
          }

          logBatchItemStatus('warn', item, 'incomplete', buildSttBatchItemDetail(manifestEntry))
          return { manifestEntry, errorCount, status: 'incomplete', failureError: error }
        }

        const errorOutputDir = getErrorOutputDir(error)
        if (errorOutputDir && !isSttCommand(command)) {
          const manifestEntry = attachOutputDir(await readBatchManifestEntry(errorOutputDir, command), errorOutputDir)
          const errorCount = getBatchManifestErrorCount(manifestEntry)
          const completionStatus = getBatchManifestCompletionStatus(manifestEntry) ?? (errorCount > 0 ? 'incomplete' : undefined)

          if (completionStatus === 'failed') {
            logBatchItemStatus('error', item, 'failed', error instanceof Error ? error.message : String(error))
            return { manifestEntry, errorCount, status: 'failed', failureError: error }
          }

          if (completionStatus === 'incomplete') {
            logBatchItemStatus('warn', item, 'done', formatProviderFailureDetail(errorCount))
            return { manifestEntry, errorCount, status: 'partial', failureError: error }
          }
        }

        const message = error instanceof Error ? error.message : String(error)
        logBatchItemStatus('error', item, 'failed', message)
        return { manifestEntry: null, errorCount: 0, status: 'failed', failureError: error }
      }
    })

  if (concurrency === 1) {
    for (let index = 0; index < items.length; index++) {
      const item = items[index] as string
      const result = await executeBatchItem(item, index)
      if (result.manifestEntry) {
        const entryIndex = resultEntryIndexes[index] ?? index
        finalInfoEntries[entryIndex] = {
          ...(finalInfoEntries[entryIndex] ?? {}),
          ...result.manifestEntry
        }
      }
      partialFailureEntries.push(...getBatchManifestErrors(result.manifestEntry))

      if (result.status === 'ok') {
        ok++
      } else if (result.status === 'partial') {
        ok++
        partial++
      } else if (result.status === 'incomplete') {
        incomplete++
        recordFailureExitCode(result.failureError)
      } else {
        fail++
        recordFailureExitCode(result.failureError)
      }
    }
  } else {
    l.write('info', `Processing ${items.length} items with concurrency ${concurrency}`)
    const sem = { active: 0 }
    const results = await Promise.allSettled(
      items.map((item, index) =>
        runWithSemaphore(concurrency, sem, async () => await executeBatchItem(item, index))
      )
    )
    for (const [index, r] of results.entries()) {
      if (r.status === 'fulfilled') {
        if (r.value.manifestEntry) {
          const entryIndex = resultEntryIndexes[index] ?? index
          finalInfoEntries[entryIndex] = {
            ...(finalInfoEntries[entryIndex] ?? {}),
            ...r.value.manifestEntry
          }
        }
        partialFailureEntries.push(...getBatchManifestErrors(r.value.manifestEntry))

        if (r.value.status === 'ok') {
          ok++
        } else if (r.value.status === 'partial') {
          ok++
          partial++
        } else if (r.value.status === 'incomplete') {
          incomplete++
          recordFailureExitCode(r.value.failureError)
        } else {
          fail++
          recordFailureExitCode(r.value.failureError)
        }
      } else {
        fail++
        recordFailureExitCode(r.reason)
        const message = r.reason instanceof Error ? r.reason.message : String(r.reason)
        l.error(`Batch item failed: ${message}`)
      }
    }
  }

  if (partialFailureEntries.length > 0) {
    const partialFailureTable = buildBatchPartialFailureTable(partialFailureEntries)
    if (partialFailureTable.rows.length > 0) {
      l.write('warn', 'Partial provider failures', {
        category: 'pipeline',
        humanTable: partialFailureTable,
        metadata: {
          failures: partialFailureTable.rows
        }
      })
    }
  }

  logBatchCompletionTable(command, ok, partial, incomplete, fail)
  if (isSttCommand(command)) {
    await writeSttBatchManifest(batchDir, finalInfoEntries, batchSource)
  } else {
    await writeBatchManifest(batchDir, toManifestKind(command), finalInfoEntries, batchSource)
  }

  return {
    ok,
    partial,
    incomplete,
    fail,
    batchDir,
    ...(!hasMixedFailureCodes && failureExitCode !== undefined ? { failureExitCode } : {})
  }
}

export const isDirectoryPath = async (path: string): Promise<boolean> => {
  const result = await Bun.$`test -d ${path}`.quiet().nothrow()
  return result.exitCode === 0
}

export const isUrlListFilePath = (path: string): boolean => {
  return URL_LIST_EXTENSIONS.includes(extname(path).toLowerCase())
}

export const isInputDirectoryPath = (path: string): boolean => {
  return basename(path).toLowerCase() === 'input'
}

export const classifyTopLevelTarget = async (target: string): Promise<TopLevelTargetInfo> => {
  const exists = await fileExists(target)
  if (!exists) {
    return { kind: 'single', exists: false, isDirectory: false, isFile: false }
  }

  const isDirectory = await isDirectoryPath(target)
  if (isDirectory) {
    return { kind: 'directory', exists: true, isDirectory: true, isFile: false }
  }

  const isFile = true
  if (isUrlListFilePath(target)) {
    return { kind: 'input_list', exists: true, isDirectory: false, isFile }
  }

  return { kind: 'single', exists: true, isDirectory: false, isFile }
}
