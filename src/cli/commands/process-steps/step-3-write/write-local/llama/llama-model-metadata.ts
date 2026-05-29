import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { resolveLlamaDownloadRepo } from '~/cli/commands/setup-and-utilities/models/model-options'
import { RUNTIME_DIR } from '~/utils/runtime-paths'

type LlamaSetupModelMetadataEntry = {
  requestedModel: string
  repo: string
  downloadedAt: string
}

export type LlamaSetupModelMetadata = {
  version: 1
  models: Record<string, LlamaSetupModelMetadataEntry>
}

export const llamaSetupModelsMetadataPath = join(RUNTIME_DIR, 'models/llama/setup-managed-models.json')

const emptyMetadata = (): LlamaSetupModelMetadata => ({
  version: 1,
  models: {}
})

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export const parseLlamaSetupModelMetadata = (raw: string): LlamaSetupModelMetadata => {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyMetadata()
  }

  if (!isRecord(parsed) || parsed['version'] !== 1 || !isRecord(parsed['models'])) {
    return emptyMetadata()
  }

  const models: Record<string, LlamaSetupModelMetadataEntry> = {}
  for (const [key, value] of Object.entries(parsed['models'])) {
    if (!isRecord(value)) continue
    const requestedModel = typeof value['requestedModel'] === 'string' ? value['requestedModel'].trim() : ''
    const repo = typeof value['repo'] === 'string' ? value['repo'].trim() : ''
    const downloadedAt = typeof value['downloadedAt'] === 'string' ? value['downloadedAt'].trim() : ''
    if (!requestedModel || !repo || !downloadedAt) continue
    models[key] = { requestedModel, repo, downloadedAt }
  }

  return {
    version: 1,
    models
  }
}

export const readLlamaSetupModelMetadata = async (
  metadataPath: string = llamaSetupModelsMetadataPath
): Promise<LlamaSetupModelMetadata> => {
  const file = Bun.file(metadataPath)
  if (!await file.exists()) {
    return emptyMetadata()
  }
  return parseLlamaSetupModelMetadata(await file.text())
}

const writeLlamaSetupModelMetadata = async (
  metadata: LlamaSetupModelMetadata,
  metadataPath: string = llamaSetupModelsMetadataPath
): Promise<void> => {
  await mkdir(dirname(metadataPath), { recursive: true })
  await Bun.write(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`)
}

export const recordSetupManagedLlamaModel = async (
  model: string,
  options: { metadataPath?: string, now?: Date } = {}
): Promise<void> => {
  const repo = resolveLlamaDownloadRepo(model)
  const metadataPath = options.metadataPath ?? llamaSetupModelsMetadataPath
  const metadata = await readLlamaSetupModelMetadata(metadataPath)
  metadata.models[repo] = {
    requestedModel: model,
    repo,
    downloadedAt: (options.now ?? new Date()).toISOString()
  }
  await writeLlamaSetupModelMetadata(metadata, metadataPath)
}

export const hasSetupManagedLlamaModel = async (
  model: string,
  metadataPath: string = llamaSetupModelsMetadataPath
): Promise<boolean> => {
  const repo = resolveLlamaDownloadRepo(model)
  const metadata = await readLlamaSetupModelMetadata(metadataPath)
  return metadata.models[repo] !== undefined
}
