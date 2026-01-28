import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { getUserApiKey } from './xdg-paths.ts'

export async function loadApiKey(
  envVar: string,
  keyFilePath?: string
): Promise<string | undefined> {
  if (keyFilePath) {
    if (!existsSync(keyFilePath)) {
      throw new Error(`API key file not found: ${keyFilePath}`)
    }
    const content = await readFile(keyFilePath, 'utf8')
    const key = content.trim()
    if (!key) {
      throw new Error(`API key file is empty: ${keyFilePath}`)
    }
    return key
  }
  
  const envValue = process.env[envVar]
  if (envValue) {
    return envValue
  }
  
  return getUserApiKey(envVar)
}

export async function requireApiKey(
  envVar: string,
  keyFilePath?: string,
  serviceName?: string
): Promise<string> {
  const key = await loadApiKey(envVar, keyFilePath)
  if (!key) {
    const service = serviceName || envVar.replace(/_API_KEY$|_KEY$|_SECRET$/, '')
    throw new Error(
      `${service} API key not found. ` +
      `Set ${envVar} environment variable, use --${envVar.toLowerCase().replace(/_/g, '-')}-file option, ` +
      `or add to ~/.config/autoshow-cli/config.json`
    )
  }
  return key
}
