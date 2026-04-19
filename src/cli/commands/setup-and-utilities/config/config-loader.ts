import { AutoshowConfigSchema, type AutoshowConfig } from '~/types'
import { validateData } from '~/utils/validate/validation'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const REPEATABLE_CONFIG_MODEL_PATHS = [
  ['defaults', 'stt', 'whisper'],
  ['defaults', 'stt', 'awsStt'],
  ['defaults', 'stt', 'groqStt'],
  ['defaults', 'stt', 'elevenlabsStt'],
  ['defaults', 'stt', 'deepgramStt'],
  ['defaults', 'stt', 'sonioxStt'],
  ['defaults', 'stt', 'revStt'],
  ['defaults', 'stt', 'mistralStt'],
  ['defaults', 'stt', 'assemblyaiStt'],
  ['defaults', 'stt', 'gladiaStt'],
  ['defaults', 'stt', 'speechmaticsStt'],
  ['defaults', 'llm', 'llama'],
  ['defaults', 'llm', 'openai'],
  ['defaults', 'llm', 'groq'],
  ['defaults', 'llm', 'gemini'],
  ['defaults', 'llm', 'anthropic'],
  ['defaults', 'llm', 'minimax'],
  ['defaults', 'llm', 'grok'],
  ['defaults', 'post', 'tts', 'kittenTts'],
  ['defaults', 'post', 'tts', 'elevenlabsTts'],
  ['defaults', 'post', 'tts', 'minimaxTts'],
  ['defaults', 'post', 'tts', 'groqTts'],
  ['defaults', 'post', 'tts', 'openaiTts'],
  ['defaults', 'post', 'tts', 'geminiTts'],
  ['defaults', 'post', 'image', 'geminiImage'],
  ['defaults', 'post', 'image', 'openaiImage'],
  ['defaults', 'post', 'image', 'minimaxImage'],
  ['defaults', 'post', 'video', 'geminiVideo'],
  ['defaults', 'post', 'video', 'minimaxVideo'],
  ['defaults', 'post', 'music', 'elevenlabsMusic'],
  ['defaults', 'post', 'music', 'minimaxMusic'],
  ['defaults', 'extract', 'mistralOcr'],
  ['defaults', 'extract', 'glmOcr']
] as const

const cloneUnknown = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(cloneUnknown)
  }

  if (isRecord(value)) {
    const cloned: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) {
      cloned[key] = cloneUnknown(entry)
    }
    return cloned
  }

  return value
}

const getNestedValue = (obj: Record<string, unknown>, path: readonly string[]): unknown => {
  let current: unknown = obj
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined
    }
    current = current[key]
  }
  return current
}

const setNestedValue = (obj: Record<string, unknown>, path: readonly string[], value: unknown): void => {
  let current = obj
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i] as string
    const next = current[key]
    if (!isRecord(next)) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }
  current[path[path.length - 1] as string] = value
}

const normalizeLegacyConfigModelSelections = (value: unknown): unknown => {
  if (!isRecord(value)) {
    return value
  }

  const normalized = cloneUnknown(value) as Record<string, unknown>

  for (const path of REPEATABLE_CONFIG_MODEL_PATHS) {
    const current = getNestedValue(normalized, path)
    if (typeof current === 'string') {
      const trimmed = current.trim()
      if (trimmed.length > 0) {
        setNestedValue(normalized, path, [trimmed])
      }
      continue
    }

    if (Array.isArray(current)) {
      const models = current
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
      setNestedValue(normalized, path, models)
    }
  }

  return normalized
}

const findProjectRoot = async (startDir: string): Promise<string> => {
  let dir = startDir
  while (true) {
    if (await Bun.file(`${dir}/package.json`).exists()) {
      return dir
    }
    const parts = dir.split('/')
    if (parts.length <= 1) {
      return startDir
    }
    parts.pop()
    const parent = parts.join('/')
    if (!parent || parent === dir) {
      return startDir
    }
    dir = parent
  }
}

export const resolveConfigPath = async (configPathOverride?: string): Promise<string> => {
  if (configPathOverride) return configPathOverride
  const root = await findProjectRoot(process.cwd())
  return `${root}/config/autoshow.json`
}

export const loadConfig = async (configPath: string): Promise<AutoshowConfig> => {
  const file = Bun.file(configPath)
  if (!await file.exists()) {
    return { version: 2 }
  }

  let text: string
  try {
    text = await file.text()
  } catch {
    throw new Error(`Failed to read autoshow config at ${configPath}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`Invalid JSON in autoshow config at ${configPath}`)
  }

  if (isRecord(parsed) && isRecord(parsed['pricing']) && 'maxUsd' in parsed['pricing']) {
    throw new Error('Invalid data structure for autoshow config: pricing.maxUsd is no longer supported. Use pricing.maxCents.')
  }
  if (
    isRecord(parsed)
    && isRecord(parsed['defaults'])
    && isRecord(parsed['defaults']['stt'])
    && 'openaiStt' in parsed['defaults']['stt']
  ) {
    throw new Error('Invalid data structure for autoshow config: defaults.stt.openaiStt is no longer supported.')
  }

  return validateData(
    AutoshowConfigSchema,
    normalizeLegacyConfigModelSelections(parsed),
    'autoshow config'
  )
}

export const resolveMaxCents = (pricing: AutoshowConfig['pricing']): number | undefined =>
  pricing?.maxCents
