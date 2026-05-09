import * as l from '~/utils/logger'
import { pollUntil } from '~/utils/retries'
import {
  LLAMA_BASE_URL,
  LLAMA_SERVER_HEALTH_HEARTBEAT_MS,
  LLAMA_SERVER_HEALTH_POLL_INTERVAL_MS,
  LLAMA_SERVER_STOP_TIMEOUT_MS
} from './llama-constants'
import {
  clearLlamaServerState,
  readLlamaServerState,
  type LlamaServerResourceOptions
} from './llama-server-state'

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

const getErrorCode = (error: unknown): string | undefined =>
  error instanceof Error && 'code' in error ? (error as Error & { code?: string }).code : undefined

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

export const tryFindLlamaServerPids = (): number[] => {
  try {
    return findLlamaServerPidsFromPsOutput(readPsOutput())
  } catch (error) {
    l.debug(`Unable to inspect llama-server processes: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
}

export const checkLlamaHealthQuiet = async (): Promise<boolean> => {
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

const isPidRunning = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return getErrorCode(error) === 'EPERM'
  }
}

const waitForPidsExit = async (pids: number[], timeoutMs: number): Promise<boolean> => {
  try {
    await pollUntil({
      operationName: 'llama-server-wait-process-exit',
      intervalMs: 100,
      deadlineMs: timeoutMs,
      pollFn: async () => pids.every((pid) => !isPidRunning(pid)),
      isDone: (allExited) => allExited
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
      if (getErrorCode(error) !== 'ESRCH') {
        throw error
      }
    }
  }
}

export const stopLlamaServerPids = async (
  pids: number[],
  options: LlamaServerResourceOptions = {}
): Promise<void> => {
  stopLlamaServerProcesses(pids, 'SIGTERM')
  const stoppedAfterTerm = await waitForLlamaHealthState(false, LLAMA_SERVER_STOP_TIMEOUT_MS)
    && await waitForPidsExit(pids, LLAMA_SERVER_STOP_TIMEOUT_MS)
  if (stoppedAfterTerm) {
    await clearLlamaServerState(undefined, options)
    return
  }

  stopLlamaServerProcesses(pids, 'SIGKILL')
  const stoppedAfterKill = await waitForLlamaHealthState(false, LLAMA_SERVER_STOP_TIMEOUT_MS)
    && await waitForPidsExit(pids, LLAMA_SERVER_STOP_TIMEOUT_MS)
  if (stoppedAfterKill) {
    await clearLlamaServerState(undefined, options)
    return
  }

  throw new Error(`Failed to stop existing llama-server on localhost:8080 (pids: ${pids.join(', ')})`)
}

const stopRecordedDefaultLlamaServer = async (
  options: LlamaServerResourceOptions = {}
): Promise<boolean> => {
  const state = await readLlamaServerState(options)
  if (!state) {
    return false
  }

  if (!isPidRunning(state.pid)) {
    await clearLlamaServerState(state.pid, options)
    return false
  }

  try {
    process.kill(state.pid, 'SIGTERM')
  } catch (error) {
    if (getErrorCode(error) === 'ESRCH') {
      await clearLlamaServerState(state.pid, options)
      return false
    }
    throw error
  }

  const stoppedAfterTerm = await waitForLlamaHealthState(false, LLAMA_SERVER_STOP_TIMEOUT_MS)
    && await waitForPidsExit([state.pid], LLAMA_SERVER_STOP_TIMEOUT_MS)
  if (stoppedAfterTerm) {
    await clearLlamaServerState(state.pid, options)
    return true
  }

  try {
    process.kill(state.pid, 'SIGKILL')
  } catch (error) {
    if (getErrorCode(error) !== 'ESRCH') {
      throw error
    }
  }

  const stoppedAfterKill = await waitForLlamaHealthState(false, LLAMA_SERVER_STOP_TIMEOUT_MS)
    && await waitForPidsExit([state.pid], LLAMA_SERVER_STOP_TIMEOUT_MS)
  if (stoppedAfterKill) {
    await clearLlamaServerState(state.pid, options)
    return true
  }

  throw new Error(`Failed to stop recorded llama-server on localhost:8080 (pid: ${state.pid})`)
}

export const stopDefaultLlamaServer = async (
  options: LlamaServerResourceOptions = {}
): Promise<void> => {
  if (await stopRecordedDefaultLlamaServer(options)) {
    return
  }

  const pids = tryFindLlamaServerPids()
  if (!await checkLlamaHealthQuiet()) {
    if (pids.length > 0) {
      await stopLlamaServerPids(pids, options)
      return
    }
    await clearLlamaServerState(undefined, options)
    return
  }

  if (pids.length === 0) {
    return
  }

  await stopLlamaServerPids(pids, options)
}

export const stopRunningLlamaServerForRestart = async (): Promise<void> => {
  if (await stopRecordedDefaultLlamaServer()) {
    return
  }

  const pids = findLlamaServerPidsFromPsOutput(readPsOutput())

  if (pids.length === 0) {
    throw new Error('A healthy service is already running on localhost:8080, but no restartable llama-server process targeting --port 8080 was found.')
  }

  await stopLlamaServerPids(pids)
}

export const waitForLlamaHealth = async (
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

const waitForSpawnedProcessExit = async (
  proc: ReturnType<typeof Bun.spawn>,
  timeoutMs: number
): Promise<boolean> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      proc.exited.then(() => true).catch(() => true),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs)
      })
    ])
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

export const stopSpawnedLlamaServer = async (proc: ReturnType<typeof Bun.spawn>): Promise<void> => {
  proc.kill('SIGTERM')
  if (await waitForSpawnedProcessExit(proc, LLAMA_SERVER_STOP_TIMEOUT_MS)) {
    return
  }

  proc.kill('SIGKILL')
  await waitForSpawnedProcessExit(proc, LLAMA_SERVER_STOP_TIMEOUT_MS)
}
