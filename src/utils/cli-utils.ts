import { mkdir, stat } from 'node:fs/promises'
import * as l from './logger'

let envFileLoaded = false
let lastEnvPath = ''

const readStreamText = async (
  stream: ReadableStream<Uint8Array> | null,
  onLine?: (line: string) => void
): Promise<string> => {
  if (!stream) {
    return ''
  }

  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let fullText = ''
  let pending = ''

  const flushLines = (chunk: string, allowPartial: boolean): void => {
    if (!onLine || chunk.length === 0) {
      return
    }

    pending += chunk

    while (true) {
      const lineBreakIndex = pending.search(/[\r\n]/)
      if (lineBreakIndex < 0) {
        break
      }

      const line = pending.slice(0, lineBreakIndex)
      let nextIndex = lineBreakIndex + 1
      if (pending[lineBreakIndex] === '\r' && pending[nextIndex] === '\n') {
        nextIndex++
      }
      pending = pending.slice(nextIndex)
      onLine(line)
    }

    if (allowPartial && pending.length > 0) {
      onLine(pending)
      pending = ''
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      const chunk = decoder.decode(value, { stream: true })
      fullText += chunk
      flushLines(chunk, false)
    }

    const trailing = decoder.decode()
    fullText += trailing
    flushLines(trailing, true)
  } finally {
    reader.releaseLock()
  }

  return fullText
}

export const exec = async (
  command: string,
  args: string[] = [],
  opts?: {
    env?: Record<string, string | undefined>
    onStdoutLine?: (line: string) => void
    onStderrLine?: (line: string) => void
  }
): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
  const env = opts?.env ? { ...process.env, ...opts.env } : undefined
  const proc = Bun.spawn([command, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    ...(env ? { env: env as Record<string, string | undefined> } : {})
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    readStreamText(proc.stdout, opts?.onStdoutLine),
    readStreamText(proc.stderr, opts?.onStderrLine),
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
        if (!key || valueParts.length === 0) {
          l.warn(`Skipping malformed .env line: ${trimmedLine.slice(0, 40)}${trimmedLine.length > 40 ? '...' : ''}`)
          return
        }
        const value = valueParts.join('=').replace(/^["']|["']$/g, '')
        process.env[key.trim()] = value.trim()
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
