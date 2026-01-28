import type { ChildProcess } from 'child_process'
import { rm } from 'fs/promises'

export const EXIT_SIGINT = 130

const CLEANUP_TIMEOUT_MS = 5000

let isShuttingDown = false

let receivedFirstInterrupt = false

const childProcesses = new Set<ChildProcess>()

const tempDirectories = new Set<string>()

const abortControllers = new Set<AbortController>()

const cleanupCallbacks = new Set<() => void | Promise<void>>()

let cancelled = false

export function registerProcess(process: ChildProcess): () => void {
  childProcesses.add(process)
  
  process.once('exit', () => {
    childProcesses.delete(process)
  })
  process.once('error', () => {
    childProcesses.delete(process)
  })
  
  return () => {
    childProcesses.delete(process)
  }
}

export function registerTempDir(dirPath: string): () => void {
  tempDirectories.add(dirPath)
  return () => {
    tempDirectories.delete(dirPath)
  }
}

export function registerAbortController(controller: AbortController): () => void {
  abortControllers.add(controller)
  return () => {
    abortControllers.delete(controller)
  }
}

export function registerCleanup(callback: () => void | Promise<void>): () => void {
  cleanupCallbacks.add(callback)
  return () => {
    cleanupCallbacks.delete(callback)
  }
}

export function isCancelled(): boolean {
  return cancelled
}

function killProcesses(): void {
  for (const proc of childProcesses) {
    try {
      if (proc.exitCode === null && proc.signalCode === null) {
        proc.kill('SIGTERM')
      }
    } catch {
    }
  }
  childProcesses.clear()
}

function abortRequests(): void {
  for (const controller of abortControllers) {
    try {
      if (!controller.signal.aborted) {
        controller.abort()
      }
    } catch {
    }
  }
  abortControllers.clear()
}

async function cleanupTempDirs(): Promise<void> {
  const promises: Promise<void>[] = []
  for (const dir of tempDirectories) {
    promises.push(
      rm(dir, { recursive: true, force: true }).catch(() => {
      })
    )
  }
  await Promise.all(promises)
  tempDirectories.clear()
}

async function runCleanupCallbacks(): Promise<void> {
  const promises: Promise<void>[] = []
  for (const callback of cleanupCallbacks) {
    promises.push(
      Promise.resolve().then(callback).catch(() => {
      })
    )
  }
  await Promise.all(promises)
  cleanupCallbacks.clear()
}

async function performCleanup(): Promise<void> {
  cancelled = true
  
  abortRequests()
  
  killProcesses()
  
  const cleanupPromise = Promise.all([
    runCleanupCallbacks(),
    cleanupTempDirs()
  ])
  
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      process.stderr.write('\nCleanup timed out, forcing exit.\n')
      resolve()
    }, CLEANUP_TIMEOUT_MS)
  })
  
  await Promise.race([cleanupPromise, timeoutPromise])
}

function handleSigint(): void {
  if (isShuttingDown) {
    process.stderr.write('\nForce quit.\n')
    process.exit(EXIT_SIGINT)
  }
  
  if (receivedFirstInterrupt) {
    process.exit(EXIT_SIGINT)
  }
  
  receivedFirstInterrupt = true
  isShuttingDown = true
  
  process.stderr.write('\nInterrupted. Cleaning up... (press Ctrl+C again to force quit)\n')
  
  performCleanup()
    .finally(() => {
      process.exit(EXIT_SIGINT)
    })
}

function handleSigterm(): void {
  if (isShuttingDown) {
    process.exit(EXIT_SIGINT)
  }
  
  isShuttingDown = true
  
  process.stderr.write('\nTermination requested. Cleaning up...\n')
  
  performCleanup()
    .finally(() => {
      process.exit(EXIT_SIGINT)
    })
}

export function installSignalHandlers(): void {
  process.on('SIGINT', handleSigint)
  process.on('SIGTERM', handleSigterm)
}

export function resetSignalHandler(): void {
  isShuttingDown = false
  receivedFirstInterrupt = false
  cancelled = false
  childProcesses.clear()
  tempDirectories.clear()
  abortControllers.clear()
  cleanupCallbacks.clear()
}

export function getRegistryCounts(): {
  processes: number
  tempDirs: number
  abortControllers: number
  callbacks: number
} {
  return {
    processes: childProcesses.size,
    tempDirs: tempDirectories.size,
    abortControllers: abortControllers.size,
    callbacks: cleanupCallbacks.size
  }
}
