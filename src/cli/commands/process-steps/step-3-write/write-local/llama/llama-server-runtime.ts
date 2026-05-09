import type { LlamaServerIdentity, LlamaServerTarget } from '~/types'
import * as l from '~/utils/logger'
import {
  getLlamaServerStartTimeoutMs,
  resolveLlamaServerBinary,
  resolveLlamaServerTarget
} from './llama-config'
import { LLAMA_SERVER_STDERR_TAIL_LIMIT } from './llama-constants'
import {
  collectStreamTail,
  parseDownloadInfo,
  startDownloadProgressWatch,
  stripAnsi
} from './llama-download-progress'
import {
  describeLlamaServerIdentity,
  describeLlamaServerTarget,
  evaluateLlamaServerIdentityMatch,
  inspectRunningLlamaServer
} from './llama-server-identity'
import {
  checkLlamaHealthQuiet,
  stopLlamaServerPids,
  stopRunningLlamaServerForRestart,
  tryFindLlamaServerPids,
  waitForLlamaHealth
} from './llama-server-process'
import { writeLlamaServerState } from './llama-server-state'

export const startLlamaServer = async (target: LlamaServerTarget): Promise<LlamaServerIdentity> => {
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

  await writeLlamaServerState(proc.pid, target, identity)
  return identity
}

export const ensureLlamaServerRunning = async (model: string): Promise<LlamaServerIdentity> => {
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

  const stalePids = tryFindLlamaServerPids()
  if (stalePids.length > 0) {
    l.write('info', `Stopping stale llama-server process before startup (pids: ${stalePids.join(', ')})`)
    await stopLlamaServerPids(stalePids)
  }

  return await startLlamaServer(target)
}
