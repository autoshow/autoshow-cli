import { mkdir, stat } from 'node:fs/promises'
import * as l from '../logger'

let envFileLoaded = false
let lastEnvPath = ''

export const exec = async (
  command: string,
  args: string[] = [],
  opts?: { env?: Record<string, string | undefined> }
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  const env = opts?.env ? { ...process.env, ...opts.env } : undefined
  const proc = Bun.spawn([command, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    ...(env ? { env: env as Record<string, string | undefined> } : {})
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited
  ])
  return { stdout, stderr, exitCode }
}

export const commandExists = (command: string): boolean => {
  return Bun.which(command) !== null
}

export const loadEnvFile = async (): Promise<void> => {
  try {
    const envPath = process.env['ENV_FILE'] || '.env'
    if (envFileLoaded) {
      if (lastEnvPath === envPath) {
        return
      }
    }
    const exists = await fileExists(envPath)
    if (!exists) {
      return
    }
    const content = await Bun.file(envPath).text()
    const lines = content.split('\n')
    lines.forEach(line => {
      const trimmedLine = line.trim()
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=')
        if (key) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '')
          process.env[key.trim()] = value.trim()
        }
      }
    })
    envFileLoaded = true
    lastEnvPath = envPath
  } catch (error) {
    l.error(`Failed to load .env file`, error)
  }
}

export const ensureDirectory = async (dirPath: string): Promise<void> => {
  try {
    await mkdir(dirPath, { recursive: true })
  } catch (error) {
    l.error(`Failed to create directory: ${dirPath}`, error)
    throw error
  }
}

export const writeFile = async (filePath: string, content: string): Promise<void> => {
  try {
    await Bun.write(filePath, content)
  } catch (error) {
    l.error(`Failed to write file: ${filePath}`, error)
    throw error
  }
}

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}
