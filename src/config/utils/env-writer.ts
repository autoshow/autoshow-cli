import { l, err } from '@/logging'
import { readFile, writeFile, existsSync } from '@/node-utils'
import type { EnvVariable } from '@/types'

export async function readEnvFile(): Promise<Record<string, string>> {
  const p = '[config/utils/env-writer]'
  const envPath = '.env'
  
  if (!existsSync(envPath)) {
    l.dim(`${p} No .env file found, returning empty configuration`)
    return {}
  }
  
  try {
    const content = await readFile(envPath, 'utf8')
    const env: Record<string, string> = {}
    
    content.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key) {
          env[key] = valueParts.join('=')
        }
      }
    })
    
    l.dim(`${p} Successfully read ${Object.keys(env).length} environment variables`)
    return env
  } catch (error) {
    err(`${p} Error reading .env file: ${(error as Error).message}`)
    return {}
  }
}

export async function writeEnvFile(variables: EnvVariable[]): Promise<boolean> {
  const p = '[config/utils/env-writer]'
  const envPath = '.env'
  
  try {
    const currentEnv = await readEnvFile()
    
    variables.forEach(({ key, value }) => {
      currentEnv[key] = value
      l.dim(`${p} Setting ${key}=${value ? `${value.slice(0, 8)}***` : '(empty)'}`)
    })
    
    const lines: string[] = []
    
    if (Object.keys(currentEnv).length > 0) {
      Object.entries(currentEnv)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([key, value]) => {
          lines.push(`${key}=${value}`)
        })
    }
    
    await writeFile(envPath, lines.join('\n') + '\n')
    l.dim(`${p} Successfully wrote ${variables.length} variables to .env file`)
    return true
  } catch (error) {
    err(`${p} Error writing .env file: ${(error as Error).message}`)
    return false
  }
}

export async function updateEnvVariable(key: string, value: string, description?: string): Promise<boolean> {
  const p = '[config/utils/env-writer]'
  l.dim(`${p} Updating environment variable: ${key}`)
  
  return await writeEnvFile([{ key, value, description }])
}

export async function removeEnvVariable(key: string): Promise<boolean> {
  const p = '[config/utils/env-writer]'
  const envPath = '.env'
  
  try {
    const currentEnv = await readEnvFile()
    
    if (!(key in currentEnv)) {
      l.dim(`${p} Variable ${key} does not exist in .env file`)
      return true
    }
    
    delete currentEnv[key]
    
    const lines: string[] = []
    Object.entries(currentEnv)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([envKey, value]) => {
        lines.push(`${envKey}=${value}`)
      })
    
    await writeFile(envPath, lines.join('\n') + '\n')
    l.dim(`${p} Successfully removed ${key} from .env file`)
    return true
  } catch (error) {
    err(`${p} Error removing variable from .env file: ${(error as Error).message}`)
    return false
  }
}