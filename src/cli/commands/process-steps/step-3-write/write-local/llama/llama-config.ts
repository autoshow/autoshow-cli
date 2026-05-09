import { existsSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { resolveLlamaDownloadRepo } from '~/cli/commands/setup-and-utilities/models/model-options'
import { llamaBinaryPath } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import type { LlamaServerTarget } from '~/types'
import * as l from '~/utils/logger'
import { readEnv } from '~/utils/validate/env-utils'
import {
  DEFAULT_LLAMA_SERVER_START_TIMEOUT_MS,
  LLAMA_SERVER_START_TIMEOUT_ENV
} from './llama-constants'

export const resolveLlamaServerBinary = (): string => {
  if (existsSync(llamaBinaryPath)) {
    return llamaBinaryPath
  }

  const systemPath = Bun.which('llama-server')
  if (systemPath) {
    return systemPath
  }

  throw new Error('llama-server is not installed. Run `bun as setup` first.')
}

export const normalizeModelPath = (modelPath: string): string => resolvePath(modelPath.trim())

export const resolveLlamaServerTarget = (model: string): LlamaServerTarget => {
  const modelPath = readEnv('LLAMA_MODEL_PATH')
  if (modelPath) {
    return {
      mode: 'path',
      requestedModel: model,
      expectedPath: normalizeModelPath(modelPath),
      startupArgs: ['-m', modelPath]
    }
  }

  const modelRepo = readEnv('LLAMA_MODEL_REPO') || resolveLlamaDownloadRepo(model)
  return {
    mode: 'repo',
    requestedModel: model,
    expectedRepo: modelRepo,
    startupArgs: ['-hf', modelRepo]
  }
}

export const getLlamaServerStartTimeoutMs = (): number => {
  const raw = process.env[LLAMA_SERVER_START_TIMEOUT_ENV]
  if (!raw) {
    return DEFAULT_LLAMA_SERVER_START_TIMEOUT_MS
  }

  const parsed = Number.parseInt(raw, 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed
  }

  l.warn(`Invalid ${LLAMA_SERVER_START_TIMEOUT_ENV} value "${raw}", using default ${DEFAULT_LLAMA_SERVER_START_TIMEOUT_MS}ms`)
  return DEFAULT_LLAMA_SERVER_START_TIMEOUT_MS
}
