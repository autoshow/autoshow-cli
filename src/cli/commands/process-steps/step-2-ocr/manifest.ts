import type { BatchManifestEntry } from '~/types'
import { readBatchManifestEntries, readRunManifestEntry, writeBatchManifest, writeRunManifest } from '../manifest-utils'

export const writeOcrRunManifest = async (
  outputDir: string,
  metadata: Record<string, unknown>
): Promise<void> => {
  await writeRunManifest(outputDir, 'ocr', metadata)
}

export const readOcrRunManifestEntry = async (
  outputDir: string
): Promise<Record<string, unknown> | undefined> => {
  return await readRunManifestEntry(outputDir, 'ocr')
}

export const writeOcrBatchManifest = async (
  batchDir: string,
  items: BatchManifestEntry[],
  source?: Record<string, unknown>
): Promise<void> => {
  await writeBatchManifest(batchDir, 'ocr', items, source)
}

export const readOcrBatchManifestEntries = async (
  batchDir: string
): Promise<{ manifestPath: string, entries: BatchManifestEntry[] } | undefined> => {
  return await readBatchManifestEntries(batchDir, 'ocr')
}
