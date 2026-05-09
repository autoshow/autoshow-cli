import type {
  LlamaIdentityMatchResult,
  LlamaServerIdentity,
  LlamaServerTarget
} from '~/types'
import { LLAMA_BASE_URL } from './llama-constants'
import { normalizeModelPath } from './llama-config'

const uniqueStrings = (values: Array<string | null | undefined>): string[] => {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    result.push(trimmed)
  }

  return result
}

export const parseLlamaServerIdentityFromProps = (raw: unknown): LlamaServerIdentity | null => {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Record<string, unknown>
  const modelAlias = typeof candidate['model_alias'] === 'string' ? candidate['model_alias'].trim() : ''
  const modelPath = typeof candidate['model_path'] === 'string' ? candidate['model_path'].trim() : ''

  if (!modelAlias && !modelPath) {
    return null
  }

  return {
    source: 'props',
    modelId: modelAlias || null,
    aliases: uniqueStrings([modelAlias]),
    modelPath: modelPath ? normalizeModelPath(modelPath) : null
  }
}

export const parseLlamaServerIdentityFromModels = (raw: unknown): LlamaServerIdentity | null => {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as Record<string, unknown>
  const aliases: string[] = []
  let primaryModelId: string | null = null
  let sawLlamaCppSignature = false

  const dataEntries = Array.isArray(candidate['data']) ? candidate['data'] : []
  for (const entry of dataEntries) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    if (record['owned_by'] === 'llamacpp') {
      sawLlamaCppSignature = true
    }

    const modelId = typeof record['id'] === 'string' ? record['id'].trim() : ''
    if (modelId && primaryModelId === null) {
      primaryModelId = modelId
    }
    if (modelId) {
      aliases.push(modelId)
    }

    if (Array.isArray(record['aliases'])) {
      for (const alias of record['aliases']) {
        if (typeof alias === 'string') {
          aliases.push(alias)
        }
      }
    }
  }

  const dedupedAliases = uniqueStrings(aliases)
  if (!sawLlamaCppSignature || dedupedAliases.length === 0) {
    return null
  }

  return {
    source: 'models',
    modelId: primaryModelId ?? dedupedAliases[0] ?? null,
    aliases: dedupedAliases,
    modelPath: null
  }
}

export const mergeLlamaServerIdentity = (
  propsIdentity: LlamaServerIdentity | null,
  modelsIdentity: LlamaServerIdentity | null
): LlamaServerIdentity | null => {
  if (!propsIdentity && !modelsIdentity) {
    return null
  }

  return {
    source: propsIdentity?.source ?? modelsIdentity?.source ?? 'models',
    modelId: propsIdentity?.modelId ?? modelsIdentity?.modelId ?? null,
    aliases: uniqueStrings([...(propsIdentity?.aliases ?? []), ...(modelsIdentity?.aliases ?? [])]),
    modelPath: propsIdentity?.modelPath ?? modelsIdentity?.modelPath ?? null
  }
}

const fetchLlamaJsonQuiet = async (path: string): Promise<unknown | null> => {
  try {
    const response = await fetch(`${LLAMA_BASE_URL}${path}`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    })
    if (!response.ok) {
      return null
    }
    return await response.json()
  } catch {
    return null
  }
}

export const inspectRunningLlamaServer = async (): Promise<LlamaServerIdentity | null> => {
  const propsIdentity = parseLlamaServerIdentityFromProps(await fetchLlamaJsonQuiet('/props'))
  const modelsIdentity = parseLlamaServerIdentityFromModels(await fetchLlamaJsonQuiet('/v1/models'))
  return mergeLlamaServerIdentity(propsIdentity, modelsIdentity)
}

export const describeLlamaServerTarget = (target: LlamaServerTarget): string => {
  if (target.mode === 'path') {
    return `model path ${target.expectedPath}`
  }
  return `hf repo ${target.expectedRepo}`
}

export const describeLlamaServerIdentity = (identity: LlamaServerIdentity): string => {
  const parts: string[] = []
  if (identity.modelId) {
    parts.push(`model ${identity.modelId}`)
  } else if (identity.aliases.length > 0) {
    parts.push(`aliases ${identity.aliases.join(', ')}`)
  } else {
    parts.push('unknown model')
  }
  if (identity.modelPath) {
    parts.push(`path ${identity.modelPath}`)
  }
  return parts.join(', ')
}

export const resolveLlamaRequestModel = (identity: LlamaServerIdentity): string => {
  const requestModel = identity.modelId ?? identity.aliases[0] ?? null
  if (!requestModel) {
    throw new Error(`llama-server is healthy but did not report a usable model id (${describeLlamaServerIdentity(identity)})`)
  }
  return requestModel
}

export const evaluateLlamaServerIdentityMatch = (
  target: LlamaServerTarget,
  identity: LlamaServerIdentity
): LlamaIdentityMatchResult => {
  if (target.mode === 'path') {
    if (!identity.modelPath) {
      return {
        matches: false,
        reason: `llama-server did not report model_path; cannot verify expected path ${target.expectedPath}`
      }
    }

    if (identity.modelPath === target.expectedPath) {
      return {
        matches: true,
        reason: `model path matches ${target.expectedPath}`
      }
    }

    return {
      matches: false,
      reason: `loaded path ${identity.modelPath} does not match expected path ${target.expectedPath}`
    }
  }

  const reportedModels = uniqueStrings([identity.modelId, ...identity.aliases])
  if (reportedModels.includes(target.expectedRepo)) {
    return {
      matches: true,
      reason: `loaded model matches ${target.expectedRepo}`
    }
  }

  return {
    matches: false,
    reason: `loaded models [${reportedModels.join(', ')}] do not include expected repo ${target.expectedRepo}`
  }
}
