import { basename } from 'node:path'
import { readRunManifest } from '~/cli/commands/process-steps/manifest-utils'
import type { BatchItem, BatchManifestEntry, BatchManifestErrorEntry, ProcessCommand } from '~/types'
import { isLikelyUrl } from '../input/input-classifier'

export const toManifestKind = (command: ProcessCommand): 'metadata' | 'download' | 'extract' | 'write' => {
  if (command === 'metadata' || command === 'download' || command === 'extract' || command === 'write') {
    return command
  }

  throw new Error('Unsupported batch manifest command: ' + command)
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const buildBatchManifestEntryForItem = (
  item: string,
  batchItem?: BatchItem
): BatchManifestEntry => {
  if (batchItem) {
    return {
      url: batchItem.url,
      title: batchItem.title ?? 'Untitled',
      channel: batchItem.author ?? 'Unknown',
      duration: batchItem.duration ?? 'Unknown',
      ...(batchItem.publishedAt ? { publishedAt: batchItem.publishedAt } : {}),
      ...(batchItem.description ? { description: batchItem.description } : {})
    }
  }

  const isUrl = isLikelyUrl(item)
  const title = basename(item).replace(/\.[^.]+$/, '')
  if (isUrl) {
    return { url: item, title, channel: 'URL', duration: 'Unknown' }
  }

  return { url: 'file://' + item, title, channel: 'Local', duration: 'Unknown' }
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

export const getErrorOutputDir = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object' || !('outputDir' in error)) {
    return undefined
  }

  const outputDir = (error as { outputDir?: unknown }).outputDir
  return typeof outputDir === 'string' && outputDir.length > 0 ? outputDir : undefined
}

export const readBatchManifestEntry = async (
  outputDir: string,
  command: ProcessCommand
): Promise<BatchManifestEntry | null> => {
  const manifest = await readRunManifest(outputDir, toManifestKind(command)).catch(() => undefined)
  if (!manifest) {
    return null
  }
  return manifest.metadata
}

export const attachOutputDir = (
  manifestEntry: BatchManifestEntry | null,
  outputDir: string
): BatchManifestEntry =>
  manifestEntry
    ? { ...manifestEntry, outputDir }
    : { outputDir }

export const getBatchManifestCompletionStatus = (
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
