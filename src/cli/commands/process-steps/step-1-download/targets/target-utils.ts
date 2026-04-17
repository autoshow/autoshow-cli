import { readdir } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'
import { fileExists, ensureDirectory, writeFile } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import type { ProcessCommand, RuntimeOptions } from '~/types'
import { isSttCommand } from '~/cli/commands/process-steps/process-command-kinds'
import type {
  BatchManifestEntry,
  BatchManifestErrorEntry,
  BatchItemProcessor,
  BatchProcessResult,
  BatchRunOptions,
  InputKind,
  SttBatchItemSummary,
  SttManifestProviderSummary,
  TopLevelTargetInfo
} from '~/types'
import { formatSttTargetLabel } from '~/cli/commands/process-steps/step-2-stt/stt-targets'
import { isSttPartialCompletionError } from '~/cli/commands/process-steps/step-2-stt/batch'
import { readBatchManifest, readRunManifest, writeBatchManifest } from '~/cli/commands/process-steps/manifest-utils'

export { buildOptsFromFlags } from './build-opts-from-flags'

const toManifestKind = (command: ProcessCommand): 'metadata' | 'download' | 'ocr' | 'stt' | 'write' => {
  if (command === 'metadata' || command === 'download' || command === 'ocr' || command === 'stt' || command === 'write') {
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

const summarizeSttBatchManifestEntries = (
  entries: BatchManifestEntry[]
): SttBatchItemSummary[] =>
  entries.map((entry, index) => ({
    label: getBatchManifestTitle(entry, index),
    completionStatus: getBatchManifestCompletionStatus(entry)
      ?? (getBatchManifestErrorCount(entry) > 0 ? 'incomplete' : 'full'),
    providers: parseSttManifestProviderSummaries(entry)
  }))

const formatSttProviderSummaryLine = (
  label: 'working' | 'failed' | 'skipped' | 'missing',
  providers: SttManifestProviderSummary[]
): string => {
  if (label === 'working') {
    return `working: ${providers.map((provider) => provider.label).join(', ')}`
  }

  return `${label}: ${providers.map((provider) =>
    provider.message ? `${provider.label} — ${provider.message}` : provider.label
  ).join('; ')}`
}

export const buildSttBatchFinalSummaryLines = (
  entries: BatchManifestEntry[]
): string[] => {
  const summaries = summarizeSttBatchManifestEntries(entries)
  if (summaries.length === 0) {
    return []
  }

  const lines = ['STT final provider status by item:']
  for (const [index, summary] of summaries.entries()) {
    lines.push(`${index + 1}/${summaries.length} ${summary.label} [${summary.completionStatus}]`)

    const working = summary.providers.filter((provider) => provider.status === 'succeeded')
    const failed = summary.providers.filter((provider) => provider.status === 'failed')
    const skipped = summary.providers.filter((provider) => provider.status === 'skipped')
    const missing = summary.providers.filter((provider) => provider.status === 'missing')

    if (working.length > 0) {
      lines.push(formatSttProviderSummaryLine('working', working))
    }
    if (failed.length > 0) {
      lines.push(formatSttProviderSummaryLine('failed', failed))
    }
    if (skipped.length > 0) {
      lines.push(formatSttProviderSummaryLine('skipped', skipped))
    }
    if (missing.length > 0) {
      lines.push(formatSttProviderSummaryLine('missing', missing))
    }
    if (summary.providers.length === 0) {
      lines.push('providers: unavailable')
    }
  }

  return lines
}

export const logSttBatchFinalSummary = async (batchDir: string): Promise<void> => {
  const manifest = await readBatchManifest(batchDir, 'stt').catch(() => undefined)
  if (!manifest) {
    return
  }

  const lines = buildSttBatchFinalSummaryLines(manifest.manifest.items)
  if (lines.length === 0) {
    return
  }

  lines.forEach((line, index) => {
    if (index === 0) {
      l.info(line)
      return
    }

    if (line.includes('[full]')) {
      l.success(line)
      return
    }

    if (line.includes('[failed]')) {
      l.error(line)
      return
    }

    if (line.includes('[incomplete]') || line.startsWith('failed:') || line.startsWith('skipped:') || line.startsWith('missing:')) {
      l.warn(line)
      return
    }

    l.info(line)
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

export const formatBatchCompletionSummary = (
  ok: number,
  partial: number,
  fail: number
): string =>
  `Batch complete: ${ok} completed (${ok - partial} full, ${partial} partial, ${fail} failed)`

export const formatSttBatchCompletionSummary = (
  ok: number,
  incomplete: number,
  fail: number
): string => `Batch complete: ${ok} full, ${incomplete} incomplete, ${fail} failed`

export const formatBatchPartialFailureSummary = (
  entries: BatchManifestErrorEntry[]
): string | undefined => {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    if (typeof entry.service !== 'string' || typeof entry.model !== 'string') {
      continue
    }

    const key = `${entry.service}/${entry.model}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  if (counts.size === 0) {
    return undefined
  }

  return `Partial provider failures: ${[...counts.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([label, count]) => `${label} x${count}`)
    .join(', ')}`
}

export const DOCUMENT_EXTENSIONS = [
  '.pdf', '.epub', '.docx', '.pptx', '.xlsx', '.odt', '.ods', '.odp',
  '.mobi', '.azw3', '.azw', '.fb2', '.lit', '.cbz', '.rtf', '.csv',
  '.html', '.htm'
]
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.bmp', '.gif']
export const MEDIA_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.mp4', '.webm', '.mkv', '.opus', '.ogg', '.aac', '.mov', '.flac']
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

export const isLikelyDocumentTarget = (target: string): boolean => {
  if (isLikelyUrl(target)) {
    try {
      return isDocumentByExtension(new URL(target).pathname)
    } catch {
      return false
    }
  }

  return isDocumentByExtension(target)
}

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

    l.info(`Loaded ${valid.length} inputs from ${filePath}`)
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
): 'full' | 'incomplete' | 'failed' | undefined => {
  if (!entry) {
    return undefined
  }

  const completionStatus = entry['completionStatus']
  if (completionStatus === 'full' || completionStatus === 'incomplete' || completionStatus === 'failed') {
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
  if (items.length === 0) {
    l.warn('No inputs to process')
    return { ok: 0, partial: 0, incomplete: 0, fail: 0 }
  }

  if (typeof runOpts.totalCount === 'number' && runOpts.totalCount > items.length) {
    l.warn(`Processing ${items.length} of ${runOpts.totalCount} items. Use --batch-all to process all.`)
  }

  const batchDirName = createUniqueDirectoryName(batchLabel)
  const batchDir = `./output/${batchDirName}`
  await ensureDirectory(batchDir)
  l.info(`Output directory: ${batchDir}`)

  if (runOpts.source) {
    const sourceData = {
      sourceKind: runOpts.source.sourceKind,
      sourceUrl: runOpts.source.sourceUrl,
      title: runOpts.source.title,
      author: runOpts.source.author,
      selectedCount: items.length
    }
    await writeFile(`${batchDir}/source.json`, JSON.stringify(sourceData, null, 2))
  }

  const batchSource = runOpts.source
    ? {
        sourceKind: runOpts.source.sourceKind,
        sourceUrl: runOpts.source.sourceUrl,
        title: runOpts.source.title,
        author: runOpts.source.author,
        selectedCount: items.length
      }
    : undefined

  let infoEntries: BatchManifestEntry[]
  if (runOpts.selectedItems && runOpts.selectedItems.length > 0) {
    infoEntries = runOpts.selectedItems.map(i => ({
      url: i.url,
      title: i.title ?? 'Untitled',
      channel: i.author ?? runOpts.source?.title ?? 'Unknown',
      duration: i.duration ?? 'Unknown',
      ...(i.publishedAt ? { publishedAt: i.publishedAt } : {})
    }))
  } else {
    infoEntries = items.map(item => {
      const isUrl = isLikelyUrl(item)
      const title = basename(item).replace(/\.[^.]+$/, '')
      if (isUrl) {
        return { url: item, title, channel: 'URL', duration: 'Unknown' }
      } else {
        return { url: `file://${item}`, title, channel: 'Local', duration: 'Unknown' }
      }
    })
  }

  await writeBatchManifest(batchDir, toManifestKind(command), infoEntries, batchSource)

  const concurrency = Math.max(1, runOpts.concurrency ?? 1)
  let ok = 0
  let partial = 0
  let incomplete = 0
  let fail = 0
  let failureExitCode: number | undefined
  let hasMixedFailureCodes = false
  const finalInfoEntries = [...infoEntries]
  const partialFailureEntries: BatchManifestErrorEntry[] = []

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
  }> => {
    try {
      const batchItem = runOpts.selectedItems?.[index]
      const processed = await runWithLogContext({ batchId: batchDirName, itemIndex: index + 1, itemCount: items.length }, async () =>
        await processSingleTarget(command, item, batchDir, opts, batchItem)
      )
      const manifestEntry = processed?.manifestEntry
        ? (processed.outputDir ? attachOutputDir(processed.manifestEntry, processed.outputDir) : processed.manifestEntry)
        : processed?.outputDir
          ? attachOutputDir(await readBatchManifestEntry(processed.outputDir, command), processed.outputDir)
          : null
      const errorCount = getBatchManifestErrorCount(manifestEntry)

      if (isSttCommand(command)) {
        const completionStatus = getBatchManifestCompletionStatus(manifestEntry) ?? (errorCount > 0 ? 'incomplete' : 'full')
        if (completionStatus === 'full') {
          l.success(`Done ${index + 1}/${items.length}`)
          return { manifestEntry, errorCount, status: 'ok' }
        }

        if (completionStatus === 'failed') {
          l.error(`Failed ${index + 1}/${items.length}: no STT provider outputs completed`)
          return { manifestEntry, errorCount, status: 'failed' }
        }

        l.warn(`Incomplete ${index + 1}/${items.length} (${errorCount} provider failure${errorCount === 1 ? '' : 's'})`)
        return { manifestEntry, errorCount, status: 'incomplete' }
      }

      if (errorCount > 0) {
        l.warn(`Done ${index + 1}/${items.length} with partial failures (${errorCount} provider failure${errorCount === 1 ? '' : 's'})`)
        return { manifestEntry, errorCount, status: 'partial' }
      }

      l.success(`Done ${index + 1}/${items.length}`)
      return { manifestEntry, errorCount, status: 'ok' }
    } catch (error) {
      if (isSttCommand(command) && isSttPartialCompletionError(error)) {
        const manifestEntry = attachOutputDir(await readBatchManifestEntry(error.outputDir, command), error.outputDir)
        const errorCount = getBatchManifestErrorCount(manifestEntry)
        if (error.completionStatus === 'failed') {
          l.error(`Failed ${index + 1}/${items.length}: ${error.message}`)
          return { manifestEntry, errorCount, status: 'failed', failureError: error }
        }

        l.warn(`Incomplete ${index + 1}/${items.length} (${errorCount} provider failure${errorCount === 1 ? '' : 's'})`)
        return { manifestEntry, errorCount, status: 'incomplete', failureError: error }
      }

      const errorOutputDir = getErrorOutputDir(error)
      if (errorOutputDir && !isSttCommand(command)) {
        const manifestEntry = attachOutputDir(await readBatchManifestEntry(errorOutputDir, command), errorOutputDir)
        const errorCount = getBatchManifestErrorCount(manifestEntry)
        const completionStatus = getBatchManifestCompletionStatus(manifestEntry) ?? (errorCount > 0 ? 'incomplete' : undefined)

        if (completionStatus === 'failed') {
          l.error(`Failed ${index + 1}/${items.length}: ${error instanceof Error ? error.message : String(error)}`)
          return { manifestEntry, errorCount, status: 'failed', failureError: error }
        }

        if (completionStatus === 'incomplete') {
          l.warn(`Done ${index + 1}/${items.length} with partial failures (${errorCount} provider failure${errorCount === 1 ? '' : 's'})`)
          return { manifestEntry, errorCount, status: 'partial', failureError: error }
        }
      }

      throw error
    }
  }

  if (concurrency === 1) {

    for (let index = 0; index < items.length; index++) {
      const item = items[index] as string
      l.info(`Processing ${index + 1}/${items.length}: ${item}`)
      try {
        const result = await executeBatchItem(item, index)
        if (result.manifestEntry) {
          finalInfoEntries[index] = result.manifestEntry
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
      } catch (error) {
        fail++
        recordFailureExitCode(error)
        const message = error instanceof Error ? error.message : String(error)
        l.error(`Failed ${index + 1}/${items.length}: ${message}`)
      }
    }
  } else {

    l.info(`Processing ${items.length} items with concurrency ${concurrency}`)
    const sem = { active: 0 }
    const results = await Promise.allSettled(
      items.map((item, index) =>
        runWithSemaphore(concurrency, sem, async () => {
          l.info(`Processing ${index + 1}/${items.length}: ${item}`)
          return await executeBatchItem(item, index)
        })
      )
    )
    for (const [index, r] of results.entries()) {
      if (r.status === 'fulfilled') {
        if (r.value.manifestEntry) {
          finalInfoEntries[index] = r.value.manifestEntry
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

  const partialFailureSummary = formatBatchPartialFailureSummary(partialFailureEntries)
  if (partialFailureSummary) {
    l.warn(partialFailureSummary)
  }

  l.info(isSttCommand(command)
    ? formatSttBatchCompletionSummary(ok, incomplete, fail)
    : formatBatchCompletionSummary(ok, partial, fail))
  await writeBatchManifest(batchDir, toManifestKind(command), finalInfoEntries, batchSource)

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
