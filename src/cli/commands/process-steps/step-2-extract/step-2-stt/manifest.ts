import { join } from 'node:path'
import type { BatchManifestEntry, ProviderCheckpoint, SttBatchSummary, SttBatchSummaryItem } from '~/types'
import { readRunManifestEntry, writeBatchManifest, writeRunManifest } from '../../manifest-utils'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCompletionStatus = (value: unknown): value is SttBatchSummaryItem['completionStatus'] =>
  value === 'full' || value === 'incomplete' || value === 'failed' || value === 'skipped'

const getStep2Entries = (entry: BatchManifestEntry): Record<string, unknown>[] => {
  const step2 = entry['step2']
  if (Array.isArray(step2)) {
    return step2.filter((value): value is Record<string, unknown> => isRecord(value))
  }
  return isRecord(step2) ? [step2] : []
}

const getPrimaryTranscriptionMetadata = (
  entry: BatchManifestEntry
): { metadata?: Record<string, unknown>, captionMetadata?: Record<string, unknown>, captionUsed: boolean } => {
  const step2Entries = getStep2Entries(entry)
  const captionMetadata = step2Entries.find((value) => value['transcriptionService'] === 'youtube-captions')
  return {
    ...(captionMetadata ?? step2Entries[0] ? { metadata: captionMetadata ?? step2Entries[0] } : {}),
    ...(captionMetadata ? { captionMetadata } : {}),
    captionUsed: captionMetadata !== undefined
  }
}

const countManifestErrors = (entry: BatchManifestEntry): number =>
  Array.isArray(entry['errors']) ? entry['errors'].length : 0

const resolveCompletionStatus = (entry: BatchManifestEntry): SttBatchSummaryItem['completionStatus'] => {
  if (isCompletionStatus(entry['completionStatus'])) {
    return entry['completionStatus']
  }

  if (countManifestErrors(entry) > 0) {
    return 'incomplete'
  }

  return getStep2Entries(entry).length > 0 ? 'full' : 'failed'
}

const buildSttBatchSummaryItem = (entry: BatchManifestEntry): SttBatchSummaryItem => {
  const step1 = isRecord(entry['step1']) ? entry['step1'] : undefined
  const { metadata, captionMetadata, captionUsed } = getPrimaryTranscriptionMetadata(entry)
  const outputDir = typeof entry['outputDir'] === 'string'
    ? entry['outputDir']
    : ''

  return {
    ...(typeof step1?.['url'] === 'string' ? { url: step1['url'] } : typeof entry['url'] === 'string' ? { url: entry['url'] } : {}),
    ...(typeof step1?.['title'] === 'string' ? { title: step1['title'] } : typeof entry['title'] === 'string' ? { title: entry['title'] } : {}),
    ...(typeof step1?.['publishDate'] === 'string'
      ? { publishedAt: step1['publishDate'] }
      : typeof entry['publishedAt'] === 'string'
        ? { publishedAt: entry['publishedAt'] }
        : {}),
    outputDir,
    completionStatus: resolveCompletionStatus(entry),
    ...(typeof metadata?.['transcriptionService'] === 'string'
      ? { transcriptionService: metadata['transcriptionService'] }
      : {}),
    ...(typeof metadata?.['transcriptionModel'] === 'string'
      ? { transcriptionModel: metadata['transcriptionModel'] }
      : {}),
    captionUsed,
    ...(typeof captionMetadata?.['captionKind'] === 'string'
      && (captionMetadata['captionKind'] === 'manual' || captionMetadata['captionKind'] === 'auto')
      ? { captionKind: captionMetadata['captionKind'] }
      : {}),
    ...(typeof captionMetadata?.['captionLanguage'] === 'string'
      ? { captionLanguage: captionMetadata['captionLanguage'] }
      : {})
  }
}

export const buildSttBatchSummary = (
  items: BatchManifestEntry[],
  source?: Record<string, unknown>
): SttBatchSummary => {
  const summaryItems = items.map(buildSttBatchSummaryItem)

  return {
    schemaVersion: 2,
    kind: 'stt-batch-summary',
    ...(isRecord(source)
      ? {
          source: {
            ...(typeof source['sourceKind'] === 'string' ? { sourceKind: source['sourceKind'] } : {}),
            ...(typeof source['sourceUrl'] === 'string' ? { sourceUrl: source['sourceUrl'] } : {}),
            ...(typeof source['title'] === 'string' ? { title: source['title'] } : {}),
            ...(typeof source['author'] === 'string' ? { author: source['author'] } : {}),
            ...(typeof source['selectedCount'] === 'number' ? { selectedCount: source['selectedCount'] } : {})
          }
        }
      : {}),
    totals: {
      items: summaryItems.length,
      captionBacked: summaryItems.filter((item) => item.captionUsed).length,
      sttFallback: summaryItems.filter((item) => !item.captionUsed && typeof item.transcriptionService === 'string').length,
      skipped: summaryItems.filter((item) => item.completionStatus === 'skipped').length,
      incomplete: summaryItems.filter((item) => item.completionStatus === 'incomplete').length,
      failed: summaryItems.filter((item) => item.completionStatus === 'failed').length
    },
    items: summaryItems
  }
}

export const writeSttBatchSummary = async (
  batchDir: string,
  items: BatchManifestEntry[],
  source?: Record<string, unknown>
): Promise<void> => {
  const summary = buildSttBatchSummary(items, source)
  await Bun.write(join(batchDir, 'stt-summary.json'), `${JSON.stringify(summary, null, 2)}\n`)
}

const parseCheckpoint = (
  value: unknown
): ProviderCheckpoint | undefined => {
  if (
    !isRecord(value)
    || value['schemaVersion'] !== 2
    || value['kind'] !== 'provider-checkpoint'
    || typeof value['provider'] !== 'string'
    || !isRecord(value['metadata'])
  ) {
    return undefined
  }

  return {
    schemaVersion: 2,
    kind: 'provider-checkpoint',
    provider: value['provider'],
    ...(typeof value['model'] === 'string' ? { model: value['model'] } : {}),
    metadata: value['metadata']
  }
}

export const writeSttRunManifest = async (
  outputDir: string,
  metadata: Record<string, unknown>
): Promise<void> => {
  await writeRunManifest(outputDir, 'stt', metadata)
}

export const readSttRunManifestEntry = async (
  outputDir: string
): Promise<Record<string, unknown> | undefined> => {
  return await readRunManifestEntry(outputDir, 'stt')
}

export const writeSttBatchManifest = async (
  batchDir: string,
  items: BatchManifestEntry[],
  source?: Record<string, unknown>
): Promise<void> => {
  await writeBatchManifest(batchDir, 'stt', items, source)
  await writeSttBatchSummary(batchDir, items, source)
}

export const writeSttProviderCheckpoint = async (
  providerDir: string,
  provider: string,
  model: string,
  metadata: Record<string, unknown>
): Promise<void> => {
  const checkpoint: ProviderCheckpoint = {
    schemaVersion: 2,
    kind: 'provider-checkpoint',
    provider,
    model,
    metadata
  }
  await Bun.write(join(providerDir, 'checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`)
}

export const readSttProviderCheckpoint = async (
  providerDir: string
): Promise<Record<string, unknown> | undefined> => {
  const checkpointPath = join(providerDir, 'checkpoint.json')
  if (!await Bun.file(checkpointPath).exists()) {
    return undefined
  }

  const raw = await Bun.file(checkpointPath).json() as unknown
  return parseCheckpoint(raw)?.metadata
}
