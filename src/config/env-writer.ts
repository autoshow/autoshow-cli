import { err } from '@/logging'
import { readFile, writeFile, existsSync } from '@/node-utils'
import type { EnvVariable } from '@/types'

export async function readEnvFile(): Promise<Record<string, string>> {
  const p = '[config/env-writer]'
  const envPath = '.env'
  
  if (!existsSync(envPath)) {
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
    
    return env
  } catch (error) {
    err(`${p} Error reading .env file: ${(error as Error).message}`)
    return {}
  }
}

export async function writeEnvFile(variables: EnvVariable[]): Promise<boolean> {
  const p = '[config/env-writer]'
  const envPath = '.env'
  
  try {
    let content = ''
    if (existsSync(envPath)) {
      content = await readFile(envPath, 'utf8')
    }
    
    const lines = content.split('\n')
    
    variables.forEach(({ key, value }) => {
      let keyFound = false
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (line && !line.startsWith('#')) {
          const [lineKey] = line.split('=')
          if (lineKey === key) {
            lines[i] = `${key}=${value}`
            keyFound = true
            break
          }
        }
      }
      
      if (!keyFound) {
        if (content && !content.endsWith('\n')) {
          lines.push('')
        }
        lines.push(`${key}=${value}`)
      }
    })
    
    await writeFile(envPath, lines.join('\n'))
    return true
  } catch (error) {
    err(`${p} Error writing .env file: ${(error as Error).message}`)
    return false
  }
}

export async function updateEnvVariable(key: string, value: string, description?: string): Promise<boolean> {
  return await writeEnvFile([{ key, value, description }])
}

export async function removeEnvVariable(key: string): Promise<boolean> {
  const p = '[config/env-writer]'
  const envPath = '.env'
  
  try {
    if (!existsSync(envPath)) {
      return true
    }
    
    const content = await readFile(envPath, 'utf8')
    const lines = content.split('\n')
    const newLines: string[] = []
    
    let removed = false
    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [lineKey] = line.split('=')
        if (lineKey === key) {
          removed = true
          continue
        }
      }
      newLines.push(line)
    }
    
    if (!removed) {
      return true
    }
    
    await writeFile(envPath, newLines.join('\n'))
    return true
  } catch (error) {
    err(`${p} Error removing variable from .env file: ${(error as Error).message}`)
    return false
  }
}