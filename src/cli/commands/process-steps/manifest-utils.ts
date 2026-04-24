import { join } from 'node:path'
import type {
  BatchManifestKind,
  BatchManifest,
  BatchManifestEntry,
  ExtractBatchManifest,
  ExtractBatchManifestItem,
  ProviderResult,
  RunManifestKind,
  RunManifest,
  RoutedChildKind
} from '~/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseRunManifest = (
  value: unknown,
  expectedKind?: RunManifestKind
): RunManifest | undefined => {
  if (
    !isRecord(value)
    || value['schemaVersion'] !== 2
    || typeof value['kind'] !== 'string'
    || !isRecord(value['metadata'])
  ) {
    return undefined
  }

  const kind = value['kind']
  if (
    kind !== 'metadata'
    && kind !== 'download'
    && kind !== 'ocr'
    && kind !== 'stt'
    && kind !== 'write'
    && kind !== 'tts'
    && kind !== 'image'
    && kind !== 'video'
    && kind !== 'music'
  ) {
    return undefined
  }

  if (expectedKind !== undefined && kind !== expectedKind) {
    return undefined
  }

  return {
    schemaVersion: 2,
    kind,
    metadata: value['metadata']
  }
}

const parseBatchManifest = (
  value: unknown,
  expectedKind?: BatchManifestKind
): BatchManifest | undefined => {
  if (
    !isRecord(value)
    || value['schemaVersion'] !== 2
    || typeof value['kind'] !== 'string'
    || !Array.isArray(value['items'])
  ) {
    return undefined
  }

  const kind = value['kind']
  if (
    kind !== 'metadata'
    && kind !== 'download'
    && kind !== 'ocr'
    && kind !== 'stt'
    && kind !== 'write'
    && kind !== 'tts'
    && kind !== 'image'
    && kind !== 'video'
    && kind !== 'music'
  ) {
    return undefined
  }

  if (expectedKind !== undefined && kind !== expectedKind) {
    return undefined
  }

  return {
    schemaVersion: 2,
    kind,
    items: value['items'].filter((entry): entry is Record<string, unknown> => isRecord(entry)),
    ...(isRecord(value['source']) ? { source: value['source'] } : {})
  }
}

const parseProviderResult = (
  value: unknown
): ProviderResult | undefined => {
  if (
    !isRecord(value)
    || value['schemaVersion'] !== 2
    || value['kind'] !== 'provider-result'
    || typeof value['provider'] !== 'string'
    || !isRecord(value['metadata'])
    || !isRecord(value['result'])
  ) {
    return undefined
  }

  return {
    schemaVersion: 2,
    kind: 'provider-result',
    provider: value['provider'],
    ...(typeof value['model'] === 'string' ? { model: value['model'] } : {}),
    metadata: value['metadata'],
    result: value['result']
  }
}

const isInputFamily = (value: unknown): value is ExtractBatchManifestItem['inputFamily'] =>
  value === 'media' || value === 'document' || value === 'html_article' || value === 'unsupported'

const isRoutedChildKind = (value: unknown): value is RoutedChildKind =>
  value === 'stt' || value === 'ocr'

const isExtractBatchCompletionStatus = (
  value: unknown
): value is ExtractBatchManifestItem['completionStatus'] =>
  value === 'full' || value === 'incomplete' || value === 'failed' || value === 'skipped'

const parseExtractBatchManifestItem = (
  value: unknown
): ExtractBatchManifestItem | undefined => {
  if (
    !isRecord(value)
    || typeof value['input'] !== 'string'
    || !isInputFamily(value['inputFamily'])
    || !isExtractBatchCompletionStatus(value['completionStatus'])
  ) {
    return undefined
  }

  const childBatchEntry: ExtractBatchManifestItem['childBatchEntry'] = isRecord(value['childBatchEntry'])
    && isRoutedChildKind(value['childBatchEntry']['kind'])
    && typeof value['childBatchEntry']['index'] === 'number'
    && Number.isFinite(value['childBatchEntry']['index'])
    ? {
        kind: value['childBatchEntry']['kind'],
        index: value['childBatchEntry']['index']
      }
    : undefined

  return {
    input: value['input'],
    inputFamily: value['inputFamily'],
    ...(isRoutedChildKind(value['routedChildKind']) ? { routedChildKind: value['routedChildKind'] } : {}),
    ...(childBatchEntry ? { childBatchEntry } : {}),
    completionStatus: value['completionStatus'],
    ...(typeof value['skipReason'] === 'string' ? { skipReason: value['skipReason'] } : {}),
    ...(typeof value['outputDir'] === 'string' ? { outputDir: value['outputDir'] } : {})
  }
}

const parseExtractBatchManifest = (
  value: unknown
): ExtractBatchManifest | undefined => {
  if (
    !isRecord(value)
    || value['schemaVersion'] !== 1
    || typeof value['createdAt'] !== 'string'
    || !Array.isArray(value['items'])
    || !isRecord(value['childBatches'])
  ) {
    return undefined
  }

  const items = value['items']
    .map(parseExtractBatchManifestItem)
    .filter((entry): entry is ExtractBatchManifestItem => entry !== undefined)

  return {
    schemaVersion: 1,
    createdAt: value['createdAt'],
    items,
    childBatches: {
      ...(typeof value['childBatches']['stt'] === 'string' ? { stt: value['childBatches']['stt'] } : {}),
      ...(typeof value['childBatches']['ocr'] === 'string' ? { ocr: value['childBatches']['ocr'] } : {})
    }
  }
}

export const writeRunManifest = async (
  outputDir: string,
  kind: RunManifestKind,
  metadata: Record<string, unknown>
): Promise<void> => {
  const manifest: RunManifest = {
    schemaVersion: 2,
    kind,
    metadata
  }
  await Bun.write(join(outputDir, 'run.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

export const readRunManifestEntry = async (
  outputDir: string,
  expectedKind: RunManifestKind
): Promise<Record<string, unknown> | undefined> => {
  return (await readRunManifest(outputDir, expectedKind))?.metadata
}

export const readRunManifest = async (
  outputDir: string,
  expectedKind?: RunManifestKind
): Promise<RunManifest | undefined> => {
  const runPath = join(outputDir, 'run.json')
  if (!await Bun.file(runPath).exists()) {
    return undefined
  }

  const raw = await Bun.file(runPath).json() as unknown
  return parseRunManifest(raw, expectedKind)
}

export const writeBatchManifest = async (
  batchDir: string,
  kind: BatchManifestKind,
  items: BatchManifestEntry[],
  source?: Record<string, unknown>
): Promise<void> => {
  const manifest: BatchManifest = {
    schemaVersion: 2,
    kind,
    items,
    ...(source ? { source } : {})
  }
  await Bun.write(join(batchDir, 'batch.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

export const readBatchManifestEntries = async (
  batchDir: string,
  expectedKind: BatchManifestKind
): Promise<{ manifestPath: string, entries: BatchManifestEntry[] } | undefined> => {
  const manifest = await readBatchManifest(batchDir, expectedKind)
  if (!manifest) {
    return undefined
  }

  return {
    manifestPath: manifest.manifestPath,
    entries: manifest.manifest.items
  }
}

export const readBatchManifest = async (
  batchDir: string,
  expectedKind?: BatchManifestKind
): Promise<{ manifestPath: string, manifest: BatchManifest } | undefined> => {
  const batchPath = join(batchDir, 'batch.json')
  if (!await Bun.file(batchPath).exists()) {
    return undefined
  }

  const raw = await Bun.file(batchPath).json() as unknown
  const manifest = parseBatchManifest(raw, expectedKind)
  if (!manifest) {
    return undefined
  }

  return {
    manifestPath: batchPath,
    manifest
  }
}

export const writeExtractBatchManifest = async (
  batchDir: string,
  manifest: ExtractBatchManifest
): Promise<void> => {
  await Bun.write(join(batchDir, 'extract-batch.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

export const readExtractBatchManifest = async (
  batchDir: string
): Promise<{ manifestPath: string, manifest: ExtractBatchManifest } | undefined> => {
  const manifestPath = join(batchDir, 'extract-batch.json')
  if (!await Bun.file(manifestPath).exists()) {
    return undefined
  }

  const raw = await Bun.file(manifestPath).json() as unknown
  const manifest = parseExtractBatchManifest(raw)
  if (!manifest) {
    return undefined
  }

  return {
    manifestPath,
    manifest
  }
}

export const writeProviderResult = async (
  providerDir: string,
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

  await Bun.write(join(providerDir, 'result.json'), `${JSON.stringify(envelope, null, 2)}\n`)
}

export const readProviderResultEntry = async (
  providerDir: string
): Promise<ProviderResult | undefined> => {
  const resultPath = join(providerDir, 'result.json')
  if (!await Bun.file(resultPath).exists()) {
    return undefined
  }

  const raw = await Bun.file(resultPath).json() as unknown
  return parseProviderResult(raw)
}
