import { join } from 'node:path'
import type { BatchManifest, ExtractBatchManifest, ProviderCheckpoint, ProviderResult, RunManifest, SttBatchSummary } from '~/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const resolveArtifactPath = (pathOrDir: string, fileName: string): string =>
  pathOrDir.endsWith(`/${fileName}`) ? pathOrDir : join(pathOrDir, fileName)

export const unwrapRunMetadataValue = (value: unknown): Record<string, unknown> | null => {
  if (!isRecord(value)) {
    return null
  }

  if (value['schemaVersion'] === 2 && typeof value['kind'] === 'string' && isRecord(value['metadata'])) {
    return value['metadata']
  }

  return value
}

export const readRunManifest = async (pathOrDir: string): Promise<RunManifest> => {
  const raw = await Bun.file(resolveArtifactPath(pathOrDir, 'run.json')).json() as unknown
  if (!isRecord(raw) || raw['schemaVersion'] !== 2 || typeof raw['kind'] !== 'string' || !isRecord(raw['metadata'])) {
    throw new Error(`Invalid run manifest at ${resolveArtifactPath(pathOrDir, 'run.json')}`)
  }

  return raw as RunManifest
}

export const readRunMetadata = async (pathOrDir: string): Promise<Record<string, unknown>> =>
  (await readRunManifest(pathOrDir)).metadata

export const writeRunManifestFixture = async (
  pathOrDir: string,
  kind: RunManifest['kind'],
  metadata: Record<string, unknown>
): Promise<void> => {
  const manifest: RunManifest = {
    schemaVersion: 2,
    kind,
    metadata
  }
  await Bun.write(resolveArtifactPath(pathOrDir, 'run.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

export const readBatchManifest = async (pathOrDir: string): Promise<BatchManifest> => {
  const raw = await Bun.file(resolveArtifactPath(pathOrDir, 'batch.json')).json() as unknown
  if (!isRecord(raw) || raw['schemaVersion'] !== 2 || typeof raw['kind'] !== 'string' || !Array.isArray(raw['items'])) {
    throw new Error(`Invalid batch manifest at ${resolveArtifactPath(pathOrDir, 'batch.json')}`)
  }

  return raw as BatchManifest
}

export const readBatchItems = async (pathOrDir: string): Promise<Record<string, unknown>[]> =>
  (await readBatchManifest(pathOrDir)).items

export const readBatchSource = async (pathOrDir: string): Promise<Record<string, unknown> | undefined> => {
  const manifest = await readBatchManifest(pathOrDir)
  return isRecord(manifest.source) ? manifest.source : undefined
}

export const writeBatchManifestFixture = async (
  pathOrDir: string,
  kind: BatchManifest['kind'],
  items: Record<string, unknown>[],
  source?: Record<string, unknown>
): Promise<void> => {
  const manifest: BatchManifest = {
    schemaVersion: 2,
    kind,
    items,
    ...(source ? { source } : {})
  }
  await Bun.write(resolveArtifactPath(pathOrDir, 'batch.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

export const readExtractBatchManifest = async (pathOrDir: string): Promise<ExtractBatchManifest> => {
  const raw = await Bun.file(resolveArtifactPath(pathOrDir, 'extract-batch.json')).json() as unknown
  if (
    !isRecord(raw)
    || raw['schemaVersion'] !== 2
    || typeof raw['createdAt'] !== 'string'
    || !Array.isArray(raw['items'])
    || !isRecord(raw['childBatches'])
  ) {
    throw new Error(`Invalid extract batch manifest at ${resolveArtifactPath(pathOrDir, 'extract-batch.json')}`)
  }

  return raw as ExtractBatchManifest
}

export const readSttBatchSummary = async (pathOrDir: string): Promise<SttBatchSummary> => {
  const raw = await Bun.file(resolveArtifactPath(pathOrDir, 'stt-summary.json')).json() as unknown
  if (
    !isRecord(raw)
    || raw['schemaVersion'] !== 2
    || raw['kind'] !== 'stt-batch-summary'
    || !isRecord(raw['totals'])
    || !Array.isArray(raw['items'])
  ) {
    throw new Error(`Invalid STT batch summary at ${resolveArtifactPath(pathOrDir, 'stt-summary.json')}`)
  }

  return raw as SttBatchSummary
}

export const readProviderResult = async (pathOrDir: string): Promise<ProviderResult> => {
  const raw = await Bun.file(resolveArtifactPath(pathOrDir, 'result.json')).json() as unknown
  if (
    !isRecord(raw)
    || raw['schemaVersion'] !== 2
    || raw['kind'] !== 'provider-result'
    || typeof raw['provider'] !== 'string'
    || !isRecord(raw['metadata'])
    || !isRecord(raw['result'])
  ) {
    throw new Error(`Invalid provider result at ${resolveArtifactPath(pathOrDir, 'result.json')}`)
  }

  return raw as ProviderResult
}

export const readProviderResultMetadata = async (pathOrDir: string): Promise<Record<string, unknown>> =>
  (await readProviderResult(pathOrDir)).metadata

export const readProviderResultValue = async (pathOrDir: string): Promise<Record<string, unknown>> =>
  (await readProviderResult(pathOrDir)).result

export const writeProviderResultFixture = async (
  pathOrDir: string,
  provider: string,
  model: string | undefined,
  metadata: Record<string, unknown>,
  result: Record<string, unknown>
): Promise<void> => {
  const envelope: ProviderResult = {
    schemaVersion: 2,
    kind: 'provider-result',
    provider,
    ...(model ? { model } : {}),
    metadata,
    result
  }
  await Bun.write(resolveArtifactPath(pathOrDir, 'result.json'), `${JSON.stringify(envelope, null, 2)}\n`)
}

export const readProviderCheckpointMetadata = async (pathOrDir: string): Promise<Record<string, unknown>> => {
  const raw = await Bun.file(resolveArtifactPath(pathOrDir, 'checkpoint.json')).json() as unknown
  if (
    !isRecord(raw)
    || raw['schemaVersion'] !== 2
    || raw['kind'] !== 'provider-checkpoint'
    || typeof raw['provider'] !== 'string'
    || !isRecord(raw['metadata'])
  ) {
    throw new Error(`Invalid provider checkpoint at ${resolveArtifactPath(pathOrDir, 'checkpoint.json')}`)
  }

  return raw['metadata']
}

export const writeProviderCheckpointFixture = async (
  pathOrDir: string,
  provider: string,
  model: string | undefined,
  metadata: Record<string, unknown>
): Promise<void> => {
  const checkpoint: ProviderCheckpoint = {
    schemaVersion: 2,
    kind: 'provider-checkpoint',
    provider,
    ...(model ? { model } : {}),
    metadata
  }
  await Bun.write(resolveArtifactPath(pathOrDir, 'checkpoint.json'), `${JSON.stringify(checkpoint, null, 2)}\n`)
}
