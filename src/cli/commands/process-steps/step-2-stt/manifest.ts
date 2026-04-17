import { join } from 'node:path'
import type { BatchManifestEntry, ProviderCheckpoint } from '~/types'
import { readBatchManifestEntries, readRunManifestEntry, writeBatchManifest, writeRunManifest } from '../manifest-utils'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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
}

export const readSttBatchManifestEntries = async (
  batchDir: string
): Promise<{ manifestPath: string, entries: BatchManifestEntry[] } | undefined> => {
  return await readBatchManifestEntries(batchDir, 'stt')
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
