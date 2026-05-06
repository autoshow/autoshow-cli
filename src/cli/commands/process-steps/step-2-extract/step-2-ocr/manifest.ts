import type { BatchManifestEntry } from '~/types'
import { readRunManifestEntry, writeBatchManifest, writeRunManifest } from '../../manifest-utils'

export const writeOcrRunManifest = async (
  outputDir: string,
  metadata: Record<string, unknown>
): Promise<void> => {
  await writeRunManifest(outputDir, 'extract', {
    ...metadata,
    extractRoute: 'document'
  })
}

export const readOcrRunManifestEntry = async (
  outputDir: string
): Promise<Record<string, unknown> | undefined> => {
  const metadata = await readRunManifestEntry(outputDir, 'extract')
  return metadata?.['extractRoute'] === 'document' ? metadata : undefined
}

export const writeOcrBatchManifest = async (
  batchDir: string,
  items: BatchManifestEntry[],
  source?: Record<string, unknown>
): Promise<void> => {
  await writeBatchManifest(batchDir, 'extract', items.map((item) => ({
    ...item,
    extractRoute: 'document'
  })), source)
}
