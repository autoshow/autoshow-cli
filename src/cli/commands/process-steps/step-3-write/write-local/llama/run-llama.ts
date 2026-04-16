import * as l from '~/logger'
import { pollUntil } from '~/utils/retries'
import { resolveLlamaDownloadRepo } from '~/cli/commands/setup-and-utilities/models/model-options'
import { countTokens } from '~/cli/commands/process-steps/step-2-stt/stt-utils/stt-utils'
import { validateData } from '~/utils/validate/validation'
import { LlamaResponseSchema, type Step3Metadata } from '~/types'
import { llamaBinaryPath } from '~/cli/commands/setup-and-utilities/setup/setup-orchestrator/run-complete-setup'
import { existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { readEnv } from '~/utils/validate/env-utils'
import type { DownloadInfo } from '~/types'
import type { StructuredRequestOptions } from '~/cli/commands/process-steps/step-3-write/structured-output/types'


const LLAMA_BASE_URL = 'http://localhost:8080'
const DEFAULT_LLAMA_SERVER_START_TIMEOUT_MS = 1800000
const LLAMA_SERVER_START_TIMEOUT_ENV = 'LLAMA_SERVER_START_TIMEOUT_MS'
const LLAMA_SERVER_HEALTH_POLL_INTERVAL_MS = 1000
const LLAMA_SERVER_HEALTH_HEARTBEAT_MS = 15000
const LLAMA_SERVER_STDERR_TAIL_LIMIT = 12000
const LLAMA_DOWNLOAD_PROGRESS_POLL_MS = 3000
const LLAMA_DOWNLOAD_STALLED_LOG_MS = 15000

const resolveLlamaServerBinary = (): string => {

  if (existsSync(llamaBinaryPath)) {
    return llamaBinaryPath
  }
  

  const systemPath = Bun.which('llama-server')
  if (systemPath) {
    return systemPath
  }
  
  throw new Error('llama-server is not installed. Run `bun as setup` first.')
}

const checkLlamaHealthQuiet = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${LLAMA_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    })
    if (!response.ok) {
      return false
    }
    const body = await response.json() as { status?: string }
    return body?.status === 'ok'
  } catch {
    return false
  }
}

const getLlamaServerStartTimeoutMs = (): number => {
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

const collectStreamTail = (stream: ReadableStream<Uint8Array> | null, onChunk: (chunk: string) => void): (() => void) => {
  if (!stream) {
    return () => {}
  }

  const reader = stream.getReader()
  let cancelled = false

  void (async () => {
    const decoder = new TextDecoder()

    try {
      while (true) {
        const result = await reader.read()
        if (result.done) {
          break
        }
        if (result.value) {
          onChunk(decoder.decode(result.value, { stream: true }))
        }
      }

      const trailing = decoder.decode()
      if (trailing.length > 0) {
        onChunk(trailing)
      }
    } catch {

    } finally {
      reader.releaseLock()
    }
  })()

  return () => {
    if (!cancelled) {
      cancelled = true
      reader.cancel().catch(() => {})
    }
  }
}

const stripAnsi = (text: string): string => text.replace(/\x1B\[[0-9;]*m/g, '')

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < (1024 * 1024)) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < (1024 * 1024 * 1024)) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const renderProgressBar = (percent: number, width: number = 24): string => {
  const clamped = Math.max(0, Math.min(100, percent))
  const filled = Math.round((clamped / 100) * width)
  if (filled >= width) {
    return `[${'='.repeat(width)}]`
  }
  if (filled <= 0) {
    return `[>${' '.repeat(width - 1)}]`
  }
  return `[${'='.repeat(filled - 1)}>${' '.repeat(width - filled)}]`
}

const parseDownloadInfo = (line: string): DownloadInfo | null => {
  const clean = stripAnsi(line)
  const match = clean.match(/trying to download model from (\S+) to (\S+\.downloadInProgress)/)
  if (!match || !match[1] || !match[2]) {
    return null
  }
  return {
    sourceUrl: match[1],
    destinationPath: match[2]
  }
}

const lookupContentLength = async (sourceUrl: string): Promise<number | null> => {
  try {
    const response = await fetch(sourceUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000)
    })
    if (!response.ok) {
      return null
    }
    const header = response.headers.get('content-length')
    if (!header) {
      return null
    }
    const total = Number.parseInt(header, 10)
    if (!Number.isFinite(total) || total <= 0) {
      return null
    }
    return total
  } catch {
    return null
  }
}

const startDownloadProgressWatch = (downloadInfo: DownloadInfo): (() => void) => {
  let stopped = false
  let totalBytes: number | null = null
  let lastBytes = 0
  let lastSampleAt = Date.now()
  let lastLogAt = 0
  let fileSeen = false
  const startedAt = Date.now()
  const spinnerFrames = ['-', '\\', '|', '/']
  let spinnerIndex = 0

  void (async () => {
    totalBytes = await lookupContentLength(downloadInfo.sourceUrl)
    if (!stopped && totalBytes !== null) {
      l.info(`  llama model size: ${formatBytes(totalBytes)}`)
    }
  })()

  const timer = setInterval(async () => {
    if (stopped) {
      return
    }

    let currentBytes: number
    try {
      currentBytes = (await stat(downloadInfo.destinationPath)).size
      fileSeen = true
    } catch {
      if (fileSeen) {
        const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1)
        l.info(`  llama model download finished after ${elapsedSec}s`)
      }
      clearInterval(timer)
      return
    }

    const now = Date.now()
    const deltaBytes = Math.max(0, currentBytes - lastBytes)
    const deltaSec = Math.max(0.001, (now - lastSampleAt) / 1000)
    const bytesPerSec = deltaBytes / deltaSec
    const stalled = currentBytes === lastBytes
    if (stalled && (now - lastLogAt) < LLAMA_DOWNLOAD_STALLED_LOG_MS) {
      return
    }
    if (!stalled && (now - lastLogAt) < LLAMA_DOWNLOAD_PROGRESS_POLL_MS) {
      return
    }

    if (totalBytes !== null && totalBytes > 0) {
      const percent = (currentBytes / totalBytes) * 100
      const bar = renderProgressBar(percent)
      l.info(`  llama model download ${bar} ${percent.toFixed(1)}% (${formatBytes(currentBytes)}/${formatBytes(totalBytes)} @ ${formatBytes(bytesPerSec)}/s)`)
    } else {
      const spinner = spinnerFrames[spinnerIndex % spinnerFrames.length] || '-'
      spinnerIndex++
      l.info(`  llama model download ${spinner} ${formatBytes(currentBytes)} @ ${formatBytes(bytesPerSec)}/s`)
    }

    lastBytes = currentBytes
    lastSampleAt = now
    lastLogAt = now
  }, LLAMA_DOWNLOAD_PROGRESS_POLL_MS)

  return () => {
    stopped = true
    clearInterval(timer)
  }
}

const waitForLlamaHealth = async (
  timeoutMs: number,
  proc: ReturnType<typeof Bun.spawn>
): Promise<
  | { healthy: true }
  | { healthy: false, reason: 'timeout' }
  | { healthy: false, reason: 'process_exit', exitCode: number | null }
> => {
  const startedAt = Date.now()
  let lastHeartbeatAt = startedAt
  let exitCode: number | null = null

  void proc.exited.then(code => {
    exitCode = code
  }).catch(() => {
    exitCode = -1
  })

  try {
    await pollUntil({
      operationName: 'llama-server-health',
      intervalMs: LLAMA_SERVER_HEALTH_POLL_INTERVAL_MS,
      deadlineMs: timeoutMs,
      pollFn: async () => {
        const healthy = await checkLlamaHealthQuiet()
        const now = Date.now()
        if ((now - lastHeartbeatAt) >= LLAMA_SERVER_HEALTH_HEARTBEAT_MS) {
          const elapsedSec = Math.floor((now - startedAt) / 1000)
          l.info(`  waiting for llama-server to become healthy (${elapsedSec}s elapsed)`)
          lastHeartbeatAt = now
        }
        return { healthy, exitCode }
      },
      isDone: (result) => result.healthy,
      isFailed: (result) => {
        if (result.exitCode !== null) {
          return { failed: true, reason: `process exited with code ${result.exitCode}` }
        }
        return { failed: false }
      }
    })
    return { healthy: true }
  } catch (error) {
    if (exitCode !== null) {
      return { healthy: false, reason: 'process_exit', exitCode }
    }
    return { healthy: false, reason: 'timeout' }
  }
}

const ensureLlamaServerRunning = async (model: string): Promise<void> => {
  if (await checkLlamaHealthQuiet()) {
    return
  }

  const llamaServerPath = resolveLlamaServerBinary()

  const modelPath = readEnv('LLAMA_MODEL_PATH')
  const modelRepo = readEnv('LLAMA_MODEL_REPO') || resolveLlamaDownloadRepo(model)
  const modelArgs = modelPath
    ? ['-m', modelPath]
    : ['-hf', modelRepo]

  if (!modelPath && modelRepo !== model) {
    l.info(`Resolved llama model alias ${model} -> ${modelRepo}`)
  }
  l.info(`Starting llama-server (${modelPath ? 'local model path' : `hf repo: ${modelRepo}`})`)
  const proc = Bun.spawn([llamaServerPath, ...modelArgs, '--host', '127.0.0.1', '--port', '8080', '--jinja'], {
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'pipe'
  })
  let stderrTail = ''
  let stderrBuffer = ''
  let stopDownloadWatch: (() => void) | null = null
  const stopActiveDownloadWatch = (): void => {
    if (stopDownloadWatch) {
      stopDownloadWatch()
      stopDownloadWatch = null
    }
  }
  const cancelStderrReader = collectStreamTail(proc.stderr, chunk => {
    stderrTail = (stderrTail + chunk).slice(-LLAMA_SERVER_STDERR_TAIL_LIMIT)

    stderrBuffer += chunk
    const lines = stderrBuffer.split(/[\r\n]+/)
    stderrBuffer = lines.pop() || ''
    for (const rawLine of lines) {
      const line = stripAnsi(rawLine).trim()
      if (!line) {
        continue
      }
      const downloadInfo = parseDownloadInfo(line)
      if (!downloadInfo) {
        continue
      }
      stopActiveDownloadWatch()
      l.info(`  llama model download started`)
      stopDownloadWatch = startDownloadProgressWatch(downloadInfo)
    }
  })
  proc.unref()

  const startTimeoutMs = getLlamaServerStartTimeoutMs()
  const healthResult = await waitForLlamaHealth(startTimeoutMs, proc)
  stopActiveDownloadWatch()

  cancelStderrReader()
  if (!healthResult.healthy) {
    const details = stderrTail.trim()
    if (healthResult.reason === 'process_exit') {
      const exitLabel = healthResult.exitCode ?? 'unknown'
      throw new Error(
        details.length > 0
          ? `llama-server exited before becoming healthy (exit code ${exitLabel}).\nllama-server stderr:\n${details}`
          : `llama-server exited before becoming healthy (exit code ${exitLabel})`
      )
    }

    const timeoutSeconds = Math.floor(startTimeoutMs / 1000)
    throw new Error(
      details.length > 0
        ? `llama-server failed to become healthy within ${timeoutSeconds} seconds.\nllama-server stderr (tail):\n${details}`
        : `llama-server failed to become healthy within ${timeoutSeconds} seconds`
    )
  }
}

const requestLlamaCompletion = async (prompt: string, model: string, signal?: AbortSignal): Promise<{ responseText: string, outputTokenCount: number }> => {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      stream: false,
      temperature: 0.7,
      max_tokens: 4096
    }),
    ...(signal ? { signal } : {})
  }

  const response = await fetch(`${LLAMA_BASE_URL}/v1/chat/completions`, init)

  if (!response.ok) {
    throw new Error(`llama.cpp API error: ${response.status} ${response.statusText}`)
  }

  const rawData = await response.json()
  const data = validateData(LlamaResponseSchema, rawData, 'llama.cpp API response')
  const responseText = data.choices?.[0]?.message?.content || ''

  if (!responseText) {
    throw new Error('No response from llama.cpp model')
  }

  return {
    responseText,
    outputTokenCount: data.usage?.completion_tokens || countTokens(responseText)
  }
}

export const ensureLlamaModelDownloaded = async (model: string): Promise<void> => {
  const llamaServerPath = resolveLlamaServerBinary()

  const modelRepo = readEnv('LLAMA_MODEL_REPO') || resolveLlamaDownloadRepo(model)
  l.info(`Downloading llama model: ${modelRepo}`)

  const proc = Bun.spawn([llamaServerPath, '-hf', modelRepo, '--host', '127.0.0.1', '--port', '8080', '--jinja'], {
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'pipe'
  })

  let stderrTail = ''
  let stderrBuffer = ''
  let stopDownloadWatch: (() => void) | null = null
  const stopActiveDownloadWatch = (): void => {
    if (stopDownloadWatch) {
      stopDownloadWatch()
      stopDownloadWatch = null
    }
  }
  const cancelStderrReader = collectStreamTail(proc.stderr, chunk => {
    stderrTail = (stderrTail + chunk).slice(-LLAMA_SERVER_STDERR_TAIL_LIMIT)
    stderrBuffer += chunk
    const lines = stderrBuffer.split(/[\r\n]+/)
    stderrBuffer = lines.pop() || ''
    for (const rawLine of lines) {
      const line = stripAnsi(rawLine).trim()
      if (!line) continue
      const downloadInfo = parseDownloadInfo(line)
      if (!downloadInfo) continue
      stopActiveDownloadWatch()
      l.info(`  llama model download started`)
      stopDownloadWatch = startDownloadProgressWatch(downloadInfo)
    }
  })
  proc.unref()

  const startTimeoutMs = getLlamaServerStartTimeoutMs()
  const healthResult = await waitForLlamaHealth(startTimeoutMs, proc)
  stopActiveDownloadWatch()
  cancelStderrReader()

  proc.kill()

  if (!healthResult.healthy) {
    const details = stderrTail.trim()
    if (healthResult.reason === 'process_exit') {
      const exitLabel = healthResult.exitCode ?? 'unknown'
      throw new Error(
        details.length > 0
          ? `llama-server exited before becoming healthy (exit code ${exitLabel}).\nllama-server stderr:\n${details}`
          : `llama-server exited before becoming healthy (exit code ${exitLabel})`
      )
    }
    const timeoutSeconds = Math.floor(startTimeoutMs / 1000)
    throw new Error(
      details.length > 0
        ? `llama-server failed to become healthy within ${timeoutSeconds} seconds.\nllama-server stderr (tail):\n${details}`
        : `llama-server failed to become healthy within ${timeoutSeconds} seconds`
    )
  }

  l.success(`Model downloaded and ready: ${modelRepo}`)
}

export const runLlamaModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    await ensureLlamaServerRunning(model)
    
    const requestModel = readEnv('LLAMA_MODEL_PATH')
      ? model
      : (readEnv('LLAMA_MODEL_REPO') || resolveLlamaDownloadRepo(model))
    
    const inputTokenCount = countTokens(prompt)
    const startTime = Date.now()
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1800000)
    try {
      const completion = await requestLlamaCompletion(prompt, requestModel, controller.signal)
      const processingTime = Date.now() - startTime
      const responseText = completion.responseText
      const outputTokenCount = completion.outputTokenCount
      
      const metadata: Step3Metadata = {
        llmService: 'llama.cpp',
        llmModel: model,
        processingTime,
        inputTokenCount,
        outputTokenCount,
        outputFileName: '',
        outputFormat: structuredOpts ? 'json' : 'markdown',
        structuredMode: structuredOpts?.modeHint ?? 'off',
        structuredPresetNames: []
      }
      
      return { result: responseText, metadata }
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      l.error(`llama.cpp request timed out after 30 minutes`)
      throw new Error('llama.cpp processing timed out after 30 minutes')
    }
    l.error(`Failed to run llama.cpp model`, error)
    throw error
  }
}

export const checkLlamaHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${LLAMA_BASE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })
    
    if (!response.ok) {
      return false
    }
    
    const body = await response.json() as { status?: string }
    return body?.status === 'ok'
  } catch (error) {
    l.error(`llama.cpp health check failed`, error)
    return false
  }
}

export const getAvailableModels = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${LLAMA_BASE_URL}/v1/models`)
    
    if (response.ok) {
      const data = await response.json() as { data?: { id: string }[] }
      const models = data.data?.map(m => m.id) || []
      return models
    }
    
    return []
  } catch (error) {
    l.error(`Error fetching available models`, error)
    return []
  }
}

export const streamLlamaResponse = async function* (prompt: string, model: string): AsyncGenerator<string> {
  try {

    await ensureLlamaServerRunning(model)
    
    const requestModel = readEnv('LLAMA_MODEL_PATH')
      ? model
      : (readEnv('LLAMA_MODEL_REPO') || resolveLlamaDownloadRepo(model))
    
    const response = await fetch(`${LLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: requestModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 4096
      })
    })
    
    if (!response.ok) {
      throw new Error(`llama.cpp API error: ${response.statusText}`)
    }
    
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get response reader')
    }
    
    const decoder = new TextDecoder()
    let buffer = ''
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          
          try {
            const json = JSON.parse(data)
            if (json.choices?.[0]?.delta?.content) {
              yield json.choices[0].delta.content
            }
          } catch {
          }
        }
      }
    }
    
  } catch (error) {
    l.error(`Streaming failed`, error)
    throw error
  }
}
