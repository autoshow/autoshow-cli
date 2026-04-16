import { readdir } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'
import { fileExists, ensureDirectory, writeFile } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { isSttCommand, type ProcessCommand, type RuntimeOptions } from '~/types'
import type { TopLevelTargetInfo, BatchItemProcessor, BatchRunOptions, BatchProcessResult } from '~/types'
import { formatSttTargetLabel } from '~/cli/commands/process-steps/step-2-stt/stt-targets'
import { isSttPartialCompletionError } from '~/cli/commands/process-steps/step-2-stt/stt-batch/stt-run-state'

export { buildOptsFromFlags } from './build-opts-from-flags'

export type BatchManifestEntry = Record<string, unknown>
type BatchManifestErrorEntry = {
  service?: string
  model?: string
  message?: string
}

type SttManifestProviderStatus = 'succeeded' | 'missing' | 'failed' | 'skipped'

type SttManifestProviderSummary = {
  label: string
  status: SttManifestProviderStatus
  message?: string
}

type SttBatchItemSummary = {
  label: string
  completionStatus: 'full' | 'incomplete' | 'failed'
  providers: SttManifestProviderSummary[]
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
  const infoPath = `${batchDir}/info.json`
  if (!await fileExists(infoPath)) {
    return
  }

  let raw: unknown
  try {
    raw = JSON.parse(await Bun.file(infoPath).text()) as unknown
  } catch {
    return
  }

  if (!Array.isArray(raw)) {
    return
  }

  const entries = raw.filter((value): value is BatchManifestEntry => isRecord(value))
  const lines = buildSttBatchFinalSummaryLines(entries)
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
  '.mobi', '.azw3', '.azw', '.fb2', '.lit', '.cbz', '.rtf', '.csv'
]
export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.bmp', '.gif']
export const MEDIA_EXTENSIONS = ['.wav', '.mp3', '.m4a', '.mp4', '.webm', '.mkv', '.opus', '.ogg', '.aac', '.mov', '.flac']
const URL_LIST_EXTENSIONS = ['.md', '.txt']

export const isLikelyUrl = (input: string): boolean => {
  try {
    const parsed = new URL(input)
    return !!parsed.protocol && !!parsed.host
  } catch {
    return false
  }
}

const hasSupportedExtension = (path: string): boolean => {
  const lower = path.toLowerCase()
  return [...MEDIA_EXTENSIONS, ...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS].some(ext => lower.endsWith(ext))
}

export const isDocumentByExtension = (path: string): boolean => {
  const lower = path.toLowerCase()
  return [...DOCUMENT_EXTENSIONS, ...IMAGE_EXTENSIONS].some(ext => lower.endsWith(ext))
}

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

const readBatchManifestEntry = async (outputDir: string): Promise<BatchManifestEntry | null> => {
  const metadataPath = `${outputDir}/metadata.json`
  if (!await fileExists(metadataPath)) {
    return null
  }

  try {
    const raw = JSON.parse(await Bun.file(metadataPath).text()) as unknown
    return isRecord(raw) ? raw : null
  } catch {
    return null
  }
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

  await writeFile(`${batchDir}/info.json`, JSON.stringify(infoEntries, null, 2))

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
          ? attachOutputDir(await readBatchManifestEntry(processed.outputDir), processed.outputDir)
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
        const manifestEntry = attachOutputDir(await readBatchManifestEntry(error.outputDir), error.outputDir)
        const errorCount = getBatchManifestErrorCount(manifestEntry)
        if (error.completionStatus === 'failed') {
          l.error(`Failed ${index + 1}/${items.length}: ${error.message}`)
          return { manifestEntry, errorCount, status: 'failed', failureError: error }
        }

        l.warn(`Incomplete ${index + 1}/${items.length} (${errorCount} provider failure${errorCount === 1 ? '' : 's'})`)
        return { manifestEntry, errorCount, status: 'incomplete', failureError: error }
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
  await writeFile(`${batchDir}/info.json`, JSON.stringify(finalInfoEntries, null, 2))

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
