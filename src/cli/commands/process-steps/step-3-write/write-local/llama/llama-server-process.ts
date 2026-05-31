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

const getErrorCode = (error: unknown): string | undefined =>
  error instanceof Error && 'code' in error ? (error as Error & { code?: string }).code : undefined

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

  if (!await checkLlamaHealthQuiet()) {
    await clearLlamaServerState(undefined, options)
    return
  }

  l.debug('A healthy unrecorded llama-server is running on localhost:8080; leaving it untouched')
}

export const stopRunningLlamaServerForRestart = async (): Promise<void> => {
  if (await stopRecordedDefaultLlamaServer()) {
    return
  }

  throw new Error('A healthy service is already running on localhost:8080, but no recorded AutoShow-managed llama-server state was found. Stop that service manually before restarting with a different model.')
}

export const stopRecordedLlamaServerIfPresent = async (): Promise<boolean> =>
  await stopRecordedDefaultLlamaServer()

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
