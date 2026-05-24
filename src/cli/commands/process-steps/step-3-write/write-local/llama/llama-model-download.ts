import { resolveLlamaDownloadRepo } from '~/cli/commands/setup-and-utilities/models/model-options'
import * as l from '~/utils/logger'
import { withProcessLock } from '~/utils/process-lock'
import {
  getLlamaServerStartTimeoutMs,
  resolveLlamaServerBinary
} from './llama-config'
import {
  LLAMA_PROCESS_LOCK_NAME,
  LLAMA_SERVER_STDERR_TAIL_LIMIT
} from './llama-constants'
import {
  collectStreamTail,
  parseDownloadInfo,
  startDownloadProgressWatch,
  stripAnsi
} from './llama-download-progress'
import {
  describeLlamaServerIdentity,
  inspectRunningLlamaServer
} from './llama-server-identity'
import {
  checkLlamaHealthQuiet,
  stopRecordedLlamaServerIfPresent,
  stopRunningLlamaServerForRestart,
  stopSpawnedLlamaServer,
  waitForLlamaHealth
} from './llama-server-process'

const ensureLlamaModelDownloadedUnlocked = async (model: string): Promise<void> => {
  const llamaServerPath = resolveLlamaServerBinary()

  const modelRepo = resolveLlamaDownloadRepo(model)
  l.write('info', `Downloading llama model: ${modelRepo}`)

  if (await checkLlamaHealthQuiet()) {
    const identity = await inspectRunningLlamaServer()
    if (!identity) {
      throw new Error('A healthy service is already running on localhost:8080, but it could not be verified as llama.cpp.')
    }

    l.write('info', `Stopping llama-server before model download (${describeLlamaServerIdentity(identity)})`)
    await stopRunningLlamaServerForRestart()
  } else if (await stopRecordedLlamaServerIfPresent()) {
    l.write('info', 'Stopped stale recorded llama-server before model download')
  }

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

  await stopSpawnedLlamaServer(proc)

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

export const ensureLlamaModelDownloaded = async (model: string): Promise<void> =>
  await withProcessLock(LLAMA_PROCESS_LOCK_NAME, async () => await ensureLlamaModelDownloadedUnlocked(model))
