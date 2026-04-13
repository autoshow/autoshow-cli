import { readdir } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'
import { fileExists, ensureDirectory, writeFile } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import type { ProcessCommand, RuntimeOptions } from '~/types'
import type { TopLevelTargetInfo, BatchItemProcessor, BatchRunOptions } from '~/types'

export { buildOptsFromFlags } from './build-opts-from-flags'

type BatchManifestEntry = Record<string, unknown>
type BatchManifestErrorEntry = {
  service?: string
  model?: string
  message?: string
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

export const processBatch = async (
  items: string[],
  batchLabel: string,
  command: ProcessCommand,
  opts: RuntimeOptions,
  processSingleTarget: BatchItemProcessor,
  runOpts: BatchRunOptions = {}
): Promise<{ ok: number, fail: number, failureExitCode?: number }> => {
  if (items.length === 0) {
    l.warn('No inputs to process')
    return { ok: 0, fail: 0 }
  }

  if (typeof runOpts.totalCount === 'number' && runOpts.totalCount > items.length) {
    l.warn(`Processing ${items.length} of ${runOpts.totalCount} items. Use --batch-all to process all.`)
  }

  const batchDirName = createUniqueDirectoryName(batchLabel)
  const batchDir = `./output/${batchDirName}`
  await ensureDirectory(batchDir)

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

  if (concurrency === 1) {

    for (let index = 0; index < items.length; index++) {
        const item = items[index] as string
        l.info(`Processing ${index + 1}/${items.length}: ${item}`)
        try {
          const processed = await runWithLogContext({ batchId: batchDirName, itemIndex: index + 1, itemCount: items.length }, async () =>
            await processSingleTarget(command, item, batchDir, opts)
          )
          const manifestEntry = processed?.outputDir ? await readBatchManifestEntry(processed.outputDir) : null
          const errorCount = getBatchManifestErrorCount(manifestEntry)
          if (manifestEntry) {
            finalInfoEntries[index] = manifestEntry
          }
          partialFailureEntries.push(...getBatchManifestErrors(manifestEntry))
          ok++
          if (errorCount > 0) {
            partial++
            l.warn(`Done ${index + 1}/${items.length} with partial failures (${errorCount} provider failure${errorCount === 1 ? '' : 's'})`)
          } else {
            l.success(`Done ${index + 1}/${items.length}`)
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
          const processed = await runWithLogContext({ batchId: batchDirName, itemIndex: index + 1, itemCount: items.length }, async () =>
            await processSingleTarget(command, item, batchDir, opts)
          )
          const manifestEntry = processed?.outputDir ? await readBatchManifestEntry(processed.outputDir) : null
          const errorCount = getBatchManifestErrorCount(manifestEntry)
          if (errorCount > 0) {
            l.warn(`Done ${index + 1}/${items.length} with partial failures (${errorCount} provider failure${errorCount === 1 ? '' : 's'})`)
          } else {
            l.success(`Done ${index + 1}/${items.length}`)
          }
          return { manifestEntry, errorCount }
        })
      )
    )
    for (const [index, r] of results.entries()) {
      if (r.status === 'fulfilled') {
        ok++
        if (r.value.manifestEntry) {
          finalInfoEntries[index] = r.value.manifestEntry
        }
        partialFailureEntries.push(...getBatchManifestErrors(r.value.manifestEntry))
        if (r.value.errorCount > 0) {
          partial++
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

  l.info(formatBatchCompletionSummary(ok, partial, fail))
  await writeFile(`${batchDir}/info.json`, JSON.stringify(finalInfoEntries, null, 2))

  return {
    ok,
    fail,
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
