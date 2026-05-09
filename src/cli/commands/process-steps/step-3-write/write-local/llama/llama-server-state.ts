import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LlamaServerIdentity, LlamaServerTarget } from '~/types'
import { resolveProcessLockRoot } from '~/utils/process-lock'
import { LLAMA_PROCESS_LOCK_NAME } from './llama-constants'
import { describeLlamaServerTarget } from './llama-server-identity'

export type LlamaServerState = {
  pid: number
  host: string
  port: number
  target: string | null
  modelId: string | null
  modelPath: string | null
  aliases: string[]
  createdAt: string
  updatedAt: string
}

export type LlamaServerResourceOptions = {
  lockRoot?: string
}

const getLlamaServerStatePath = (options: LlamaServerResourceOptions = {}): string =>
  join(resolveProcessLockRoot(options), `${LLAMA_PROCESS_LOCK_NAME}.state.json`)

export const readLlamaServerState = async (options: LlamaServerResourceOptions = {}): Promise<LlamaServerState | null> => {
  try {
    const parsed = JSON.parse(await readFile(getLlamaServerStatePath(options), 'utf-8')) as Record<string, unknown>
    const pid = typeof parsed['pid'] === 'number' ? parsed['pid'] : null
    if (!Number.isInteger(pid) || (pid ?? 0) < 1) {
      return null
    }

    const aliases = Array.isArray(parsed['aliases'])
      ? parsed['aliases'].filter((alias): alias is string => typeof alias === 'string')
      : []

    return {
      pid: pid as number,
      host: typeof parsed['host'] === 'string' ? parsed['host'] : '127.0.0.1',
      port: typeof parsed['port'] === 'number' ? parsed['port'] : 8080,
      target: typeof parsed['target'] === 'string' ? parsed['target'] : null,
      modelId: typeof parsed['modelId'] === 'string' ? parsed['modelId'] : null,
      modelPath: typeof parsed['modelPath'] === 'string' ? parsed['modelPath'] : null,
      aliases,
      createdAt: typeof parsed['createdAt'] === 'string' ? parsed['createdAt'] : '',
      updatedAt: typeof parsed['updatedAt'] === 'string' ? parsed['updatedAt'] : ''
    }
  } catch {
    return null
  }
}

export const writeLlamaServerState = async (
  pid: number,
  target: LlamaServerTarget,
  identity: LlamaServerIdentity,
  options: LlamaServerResourceOptions = {}
): Promise<void> => {
  const now = new Date().toISOString()
  await mkdir(resolveProcessLockRoot(options), { recursive: true })
  await writeFile(getLlamaServerStatePath(options), JSON.stringify({
    pid,
    host: '127.0.0.1',
    port: 8080,
    target: describeLlamaServerTarget(target),
    modelId: identity.modelId,
    modelPath: identity.modelPath,
    aliases: identity.aliases,
    createdAt: now,
    updatedAt: now
  } satisfies LlamaServerState, null, 2))
}

export const clearLlamaServerState = async (
  pid?: number,
  options: LlamaServerResourceOptions = {}
): Promise<void> => {
  if (pid !== undefined) {
    const state = await readLlamaServerState(options)
    if (state?.pid !== pid) {
      return
    }
  }

  await rm(getLlamaServerStatePath(options), { force: true })
}
