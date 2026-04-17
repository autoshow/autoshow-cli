import { join } from 'node:path'
import type { BatchManifest, BatchManifestEntry, ProviderCheckpoint, RunManifest } from '~/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseRunManifest = (
  value: unknown
): RunManifest | undefined => {
  if (!isRecord(value) || value['schemaVersion'] !== 1 || value['kind'] !== 'stt' || !isRecord(value['metadata'])) {
    return undefined
  }

  return {
    schemaVersion: 1,
    kind: 'stt',
    metadata: value['metadata']
  }
}

const parseBatchManifest = (
  value: unknown
): BatchManifest | undefined => {
  if (
    !isRecord(value)
    || value['schemaVersion'] !== 1
    || value['kind'] !== 'stt'
    || !Array.isArray(value['items'])
  ) {
    return undefined
  }

  return {
    schemaVersion: 1,
    kind: 'stt',
    items: value['items'].filter((entry): entry is Record<string, unknown> => isRecord(entry)),
    ...(isRecord(value['source']) ? { source: value['source'] } : {})
  }
}

const parseCheckpoint = (
  value: unknown
): ProviderCheckpoint | undefined => {
  if (
    !isRecord(value)
    || value['schemaVersion'] !== 1
    || value['kind'] !== 'provider-checkpoint'
    || typeof value['provider'] !== 'string'
    || !isRecord(value['metadata'])
  ) {
    return undefined
  }

  return {
    schemaVersion: 1,
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
  const manifest: RunManifest = {
    schemaVersion: 1,
    kind: 'stt',
    metadata
  }
  await Bun.write(join(outputDir, 'run.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

export const readSttRunManifestEntry = async (
  outputDir: string
): Promise<Record<string, unknown> | undefined> => {
  const metadataPath = join(outputDir, 'metadata.json')
  if (await Bun.file(metadataPath).exists()) {
    const raw = await Bun.file(metadataPath).json() as unknown
    return isRecord(raw) ? raw : undefined
  }

  const runPath = join(outputDir, 'run.json')
  if (!await Bun.file(runPath).exists()) {
    return undefined
  }

  const raw = await Bun.file(runPath).json() as unknown
  return parseRunManifest(raw)?.metadata
}

export const writeSttBatchManifest = async (
  batchDir: string,
  items: BatchManifestEntry[],
  source?: Record<string, unknown>
): Promise<void> => {
  const manifest: BatchManifest = {
    schemaVersion: 1,
    kind: 'stt',
    items,
    ...(source ? { source } : {})
  }
  await Bun.write(join(batchDir, 'batch.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

export const readSttBatchManifestEntries = async (
  batchDir: string
): Promise<{ manifestPath: string, entries: BatchManifestEntry[] } | undefined> => {
  const legacyPath = join(batchDir, 'info.json')
  if (await Bun.file(legacyPath).exists()) {
    const raw = await Bun.file(legacyPath).json() as unknown
    if (Array.isArray(raw)) {
      return {
        manifestPath: legacyPath,
        entries: raw.filter((entry): entry is Record<string, unknown> => isRecord(entry))
      }
    }
  }

  const batchPath = join(batchDir, 'batch.json')
  if (!await Bun.file(batchPath).exists()) {
    return undefined
  }

  const raw = await Bun.file(batchPath).json() as unknown
  const manifest = parseBatchManifest(raw)
  if (!manifest) {
    return undefined
  }

  return {
    manifestPath: batchPath,
    entries: manifest.items
  }
}

export const writeSttProviderCheckpoint = async (
  providerDir: string,
  provider: string,
  model: string,
  metadata: Record<string, unknown>
): Promise<void> => {
  const checkpoint: ProviderCheckpoint = {
    schemaVersion: 1,
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
