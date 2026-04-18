import { AutoshowConfigSchema, type AutoshowConfig } from '~/types'
import { validateData } from '~/utils/validate/validation'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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

  return validateData(AutoshowConfigSchema, parsed, 'autoshow config')
}

export const resolveMaxCents = (pricing: AutoshowConfig['pricing']): number | undefined =>
  pricing?.maxCents
