import { stat } from 'node:fs/promises'
import type { DownloadInfo } from '~/types'
import * as l from '~/utils/logger'
import {
  LLAMA_DOWNLOAD_PROGRESS_POLL_MS,
  LLAMA_DOWNLOAD_STALLED_LOG_MS
} from './llama-constants'

export const collectStreamTail = (stream: ReadableStream<Uint8Array> | null, onChunk: (chunk: string) => void): (() => void) => {
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

export const stripAnsi = (text: string): string => text.replace(/\x1B\[[0-9;]*m/g, '')

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

export const parseDownloadInfo = (line: string): DownloadInfo | null => {
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

export const startDownloadProgressWatch = (downloadInfo: DownloadInfo): (() => void) => {
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
