import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'

const APP_NAME = 'autoshow-cli'

export function getConfigDir(): string {
  const xdgConfigHome = process.env['XDG_CONFIG_HOME']
  const baseDir = xdgConfigHome || join(homedir(), '.config')
  return join(baseDir, APP_NAME)
}

export function getDataDir(): string {
  const xdgDataHome = process.env['XDG_DATA_HOME']
  const baseDir = xdgDataHome || join(homedir(), '.local', 'share')
  return join(baseDir, APP_NAME)
}

export function getCacheDir(): string {
  const xdgCacheHome = process.env['XDG_CACHE_HOME']
  const baseDir = xdgCacheHome || join(homedir(), '.cache')
  return join(baseDir, APP_NAME)
}

export function getTempDir(): string {
  const baseTmpDir = process.env['TMPDIR'] || tmpdir()
  return join(baseTmpDir, APP_NAME)
}

export function getUserConfigPath(): string {
  return join(getConfigDir(), 'config.json')
}

export interface UserConfig {
  api_keys?: {
    OPENAI_API_KEY?: string
    ANTHROPIC_API_KEY?: string
    GEMINI_API_KEY?: string
    DEEPGRAM_API_KEY?: string
    ASSEMBLY_API_KEY?: string
    ELEVENLABS_API_KEY?: string
    BFL_API_KEY?: string
    RUNWAYML_API_SECRET?: string
    MINIMAX_API_KEY?: string
    AWS_ACCESS_KEY_ID?: string
    AWS_SECRET_ACCESS_KEY?: string
    AWS_REGION?: string
    [key: string]: string | undefined
  }
  tts?: {
    python?: string
    default_engine?: string
    voices?: {
      [engine: string]: {
        [speaker: string]: string
      }
    }
    [key: string]: unknown
  }
  defaults?: {
    transcription?: string
    llm?: string
    timeout?: number
    max_retries?: number
    [key: string]: unknown
  }
}

export function loadUserConfig(): UserConfig {
  const configPath = getUserConfigPath()
  
  if (!existsSync(configPath)) {
    return {}
  }
  
  try {
    const content = readFileSync(configPath, 'utf8')
    return JSON.parse(content) as UserConfig
  } catch {
    return {}
  }
}

export function saveUserConfig(config: UserConfig): void {
  const configDir = getConfigDir()
  const configPath = getUserConfigPath()
  
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }
  
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
}

export function getUserApiKey(keyName: string): string | undefined {
  const config = loadUserConfig()
  return config.api_keys?.[keyName]
}

export function setUserApiKey(keyName: string, value: string): void {
  const config = loadUserConfig()
  
  if (!config.api_keys) {
    config.api_keys = {}
  }
  
  config.api_keys[keyName] = value
  saveUserConfig(config)
}

export function hasUserConfig(): boolean {
  return existsSync(getUserConfigPath())
}

export function getUserVoice(
  engine: string,
  speaker: string,
  defaultValue?: string
): string | undefined {
  const config = loadUserConfig()
  
  const configVoice = config.tts?.voices?.[engine.toLowerCase()]?.[speaker]
  if (configVoice) return configVoice
  
  const envKey = `${engine.toUpperCase()}_VOICE_${speaker.toUpperCase()}`
  const envValue = process.env[envKey]
  if (envValue) return envValue
  
  return defaultValue
}

export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true })
  }
}

export function ensureXdgDirs(): void {
  ensureDir(getConfigDir())
  ensureDir(getDataDir())
  ensureDir(getCacheDir())
}
