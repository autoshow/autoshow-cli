import * as l from '~/utils/logger'
import { pollUntil } from '~/utils/retries'
import { resolveLlamaDownloadRepo } from '~/cli/commands/setup-and-utilities/models/model-options'
import { countTokens } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import { validateData } from '~/utils/validate/validation'
import {
  LlamaResponseSchema,
  type DownloadInfo,
  type LlamaIdentityMatchResult,
  type LlamaServerIdentity,
  type LlamaServerTarget,
  type Step3Metadata,
  type StructuredRequestOptions
} from '~/types'
import { llamaBinaryPath } from '~/cli/commands/setup-and-utilities/setup/setup-orchestrator/run-complete-setup'
import { existsSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve as resolvePath } from 'node:path'
import { readEnv } from '~/utils/validate/env-utils'
const LLAMA_BASE_URL = 'http://localhost:8080'
const DEFAULT_LLAMA_SERVER_START_TIMEOUT_MS = 1800000
const LLAMA_SERVER_START_TIMEOUT_ENV = 'LLAMA_SERVER_START_TIMEOUT_MS'
const LLAMA_SERVER_HEALTH_POLL_INTERVAL_MS = 1000
const LLAMA_SERVER_HEALTH_HEARTBEAT_MS = 15000
const LLAMA_SERVER_STDERR_TAIL_LIMIT = 12000
const LLAMA_DOWNLOAD_PROGRESS_POLL_MS = 3000
const LLAMA_DOWNLOAD_STALLED_LOG_MS = 15000
const LLAMA_SERVER_STOP_TIMEOUT_MS = 5000
const LLAMA_CHAT_TEMPLATE_KWARGS = { enable_thinking: false } as const

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

const normalizeModelPath = (modelPath: string): string => resolvePath(modelPath.trim())

export const resolveLlamaServerTarget = (model: string): LlamaServerTarget => {
  const modelPath = readEnv('LLAMA_MODEL_PATH')
  if (modelPath) {
    return {
      mode: 'path',
      requestedModel: model,
      expectedPath: normalizeModelPath(modelPath),
      startupArgs: ['-m', modelPath]
    }
  }

  const modelRepo = readEnv('LLAMA_MODEL_REPO') || resolveLlamaDownloadRepo(model)
  return {
    mode: 'repo',
    requestedModel: model,
    expectedRepo: modelRepo,
    startupArgs: ['-hf', modelRepo]
  }
}

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

const mergeLlamaServerIdentity = (
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

const inspectRunningLlamaServer = async (): Promise<LlamaServerIdentity | null> => {
  const propsIdentity = parseLlamaServerIdentityFromProps(await fetchLlamaJsonQuiet('/props'))
  const modelsIdentity = parseLlamaServerIdentityFromModels(await fetchLlamaJsonQuiet('/v1/models'))
  return mergeLlamaServerIdentity(propsIdentity, modelsIdentity)
}

const describeLlamaServerTarget = (target: LlamaServerTarget): string => {
  if (target.mode === 'path') {
    return `model path ${target.expectedPath}`
  }
  return `hf repo ${target.expectedRepo}`
}

const describeLlamaServerIdentity = (identity: LlamaServerIdentity): string => {
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

const resolveLlamaRequestModel = (identity: LlamaServerIdentity): string => {
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

const readPsOutput = (): string => {
  const proc = Bun.spawnSync(['ps', '-ax', '-o', 'pid=,command='], {
    stdout: 'pipe',
    stderr: 'pipe'
  })

  if (proc.exitCode !== 0) {
    const stderr = proc.stderr.toString().trim()
    throw new Error(stderr ? `Failed to inspect running processes: ${stderr}` : 'Failed to inspect running processes')
  }

  return proc.stdout.toString()
}

const LLAMA_SERVER_PORT_PATTERN = /(?:^|\s)--port(?:=|\s+)8080(?:\s|$)/
const LLAMA_SERVER_COMMAND_PATTERN = /(?:^|\s)(?:\S+\/)?llama-server(?:\s|$)/

export const findLlamaServerPidsFromPsOutput = (psOutput: string): number[] => {
  const pids: number[] = []

  for (const rawLine of psOutput.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const match = line.match(/^(\d+)\s+(.*)$/)
    if (!match) continue

    const pid = Number.parseInt(match[1] || '', 10)
    const command = match[2] || ''
    if (!Number.isFinite(pid)) continue
    if (!LLAMA_SERVER_COMMAND_PATTERN.test(command)) continue
    if (!LLAMA_SERVER_PORT_PATTERN.test(command)) continue

    pids.push(pid)
  }

  return pids
}

const waitForLlamaHealthState = async (healthy: boolean, timeoutMs: number): Promise<boolean> => {
  try {
    await pollUntil({
      operationName: healthy ? 'llama-server-wait-healthy' : 'llama-server-wait-stopped',
      intervalMs: 250,
      deadlineMs: timeoutMs,
      pollFn: async () => await checkLlamaHealthQuiet(),
      isDone: (result) => result === healthy
    })
    return true
  } catch {
    return false
  }
}

const stopLlamaServerProcesses = (pids: number[], signal: NodeJS.Signals): void => {
  for (const pid of pids) {
    try {
      process.kill(pid, signal)
    } catch (error) {
      const errno = error as NodeJS.ErrnoException
      if (errno?.code !== 'ESRCH') {
        throw error
      }
    }
  }
}

const stopRunningLlamaServerForRestart = async (): Promise<void> => {
  const pids = findLlamaServerPidsFromPsOutput(readPsOutput())

  if (pids.length === 0) {
    throw new Error('A healthy service is already running on localhost:8080, but no restartable llama-server process targeting --port 8080 was found.')
  }

  stopLlamaServerProcesses(pids, 'SIGTERM')
  if (await waitForLlamaHealthState(false, LLAMA_SERVER_STOP_TIMEOUT_MS)) {
    return
  }

  stopLlamaServerProcesses(pids, 'SIGKILL')
  if (await waitForLlamaHealthState(false, LLAMA_SERVER_STOP_TIMEOUT_MS)) {
    return
  }

  throw new Error(`Failed to stop existing llama-server on localhost:8080 (pids: ${pids.join(', ')})`)
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
      l.write('info', `  llama model size: ${formatBytes(totalBytes)}`)
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
        l.debug(`llama model download finished after ${elapsedSec}s`)
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
      l.debug(`llama model download ${bar} ${percent.toFixed(1)}% (${formatBytes(currentBytes)}/${formatBytes(totalBytes)} @ ${formatBytes(bytesPerSec)}/s)`)
    } else {
      const spinner = spinnerFrames[spinnerIndex % spinnerFrames.length] || '-'
      spinnerIndex++
      l.debug(`llama model download ${spinner} ${formatBytes(currentBytes)} @ ${formatBytes(bytesPerSec)}/s`)
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
          l.debug(`waiting for llama-server to become healthy (${elapsedSec}s elapsed)`)
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

const startLlamaServer = async (target: LlamaServerTarget): Promise<LlamaServerIdentity> => {
  const llamaServerPath = resolveLlamaServerBinary()

  if (target.mode === 'repo' && target.expectedRepo !== target.requestedModel) {
    l.write('info', `Resolved llama model alias ${target.requestedModel} -> ${target.expectedRepo}`)
  }
  l.write('info', `Starting llama-server (${describeLlamaServerTarget(target)})`)
  const proc = Bun.spawn([llamaServerPath, ...target.startupArgs, '--host', '127.0.0.1', '--port', '8080', '--jinja'], {
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
      l.write('info', `  llama model download started`)
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

  const identity = await inspectRunningLlamaServer()
  if (!identity) {
    throw new Error(`llama-server became healthy but could not verify the loaded model for ${describeLlamaServerTarget(target)}`)
  }

  const match = evaluateLlamaServerIdentityMatch(target, identity)
  if (!match.matches) {
    throw new Error(
      `llama-server became healthy but loaded the wrong target (${describeLlamaServerIdentity(identity)}). Expected ${describeLlamaServerTarget(target)}. ${match.reason}`
    )
  }

  return identity
}

const ensureLlamaServerRunning = async (model: string): Promise<LlamaServerIdentity> => {
  const target = resolveLlamaServerTarget(model)

  if (await checkLlamaHealthQuiet()) {
    const identity = await inspectRunningLlamaServer()
    if (!identity) {
      throw new Error('A healthy service is already running on localhost:8080, but it could not be verified as llama.cpp.')
    }

    const match = evaluateLlamaServerIdentityMatch(target, identity)
    if (match.matches) {
      l.write('info', `Reusing llama-server (${describeLlamaServerIdentity(identity)})`)
      return identity
    }

    l.write('info', `Restarting llama-server on localhost:8080 (${describeLlamaServerIdentity(identity)}; expected ${describeLlamaServerTarget(target)})`)
    await stopRunningLlamaServerForRestart()
  }

  return await startLlamaServer(target)
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
      max_tokens: 4096,
      chat_template_kwargs: LLAMA_CHAT_TEMPLATE_KWARGS
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
  l.write('info', `Downloading llama model: ${modelRepo}`)

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
      l.write('info', `  llama model download started`)
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

  l.write('success', `Model downloaded and ready: ${modelRepo}`)
}

export const runLlamaModel = async (
  prompt: string,
  model: string,
  structuredOpts?: StructuredRequestOptions
): Promise<{ result: string, metadata: Step3Metadata }> => {
  try {
    const identity = await ensureLlamaServerRunning(model)
    const requestModel = resolveLlamaRequestModel(identity)
    
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
        outputFormat: 'json',
        structuredMode: structuredOpts?.strategy ?? 'schema-guided',
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
      const identity = parseLlamaServerIdentityFromModels(await response.json())
      const models = identity?.aliases ?? []
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

    const identity = await ensureLlamaServerRunning(model)
    const requestModel = resolveLlamaRequestModel(identity)
    
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
        max_tokens: 4096,
        chat_template_kwargs: LLAMA_CHAT_TEMPLATE_KWARGS
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
