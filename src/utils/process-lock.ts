import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { hostname } from 'node:os'
import { join, resolve } from 'node:path'

const DEFAULT_LOCK_STALE_MS = 60_000
const DEFAULT_LOCK_WAIT_TIMEOUT_MS = 2 * 60 * 60 * 1000
const DEFAULT_LOCK_WAIT_MS = 100
const DEFAULT_LOCK_HEARTBEAT_MS = 5_000
const LOCK_OWNER_FILE = 'owner.json'
const CURRENT_HOSTNAME = hostname()

type ProcessLockOptions = {
  lockRoot?: string
  staleMs?: number
  waitTimeoutMs?: number
  waitMs?: number
  heartbeatMs?: number
}

type ProcessLockOwner = {
  ownerId?: string | undefined
  lockName?: string | undefined
  pid?: number | undefined
  hostname?: string | undefined
  createdAt?: string | undefined
  updatedAt?: string | undefined
}

type ActiveProcessLockOwner = {
  ownerId: string
  lockName: string
  pid: number
  hostname: string
  createdAt: string
  updatedAt: string
}

const getErrorCode = (error: unknown): string | undefined =>
  error instanceof Error && 'code' in error ? (error as Error & { code?: string }).code : undefined

const resolvePositiveInteger = (
  optionValue: number | undefined,
  fallback: number
): number => {
  if (typeof optionValue === 'number' && Number.isFinite(optionValue) && optionValue > 0) {
    return Math.floor(optionValue)
  }
  return fallback
}

const sanitizeLockName = (lockName: string): string => {
  const sanitized = lockName
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120)

  if (!sanitized || sanitized === '.' || sanitized === '..') {
    return 'process-lock'
  }

  return sanitized
}

let configuredCacheDir: string | undefined

export const configureCacheDir = (dir?: string): void => {
  configuredCacheDir = dir?.trim() || undefined
}

export const getDefaultCacheDir = (): string =>
  configuredCacheDir ?? join(process.env['HOME'] ?? resolve('.'), '.cache', 'autoshow-cli')

export const resolveProcessLockRoot = (options: ProcessLockOptions = {}): string =>
  options.lockRoot ?? join(getDefaultCacheDir(), 'process-locks')

const getLockOwnerPath = (lockDir: string): string => join(lockDir, LOCK_OWNER_FILE)

const readProcessLockOwner = async (lockDir: string): Promise<ProcessLockOwner | null> => {
  try {
    const parsed = JSON.parse(await readFile(getLockOwnerPath(lockDir), 'utf-8')) as Record<string, unknown>
    return {
      ...(typeof parsed['ownerId'] === 'string' ? { ownerId: parsed['ownerId'] } : {}),
      ...(typeof parsed['lockName'] === 'string' ? { lockName: parsed['lockName'] } : {}),
      ...(typeof parsed['pid'] === 'number' ? { pid: parsed['pid'] } : {}),
      ...(typeof parsed['hostname'] === 'string' ? { hostname: parsed['hostname'] } : {}),
      ...(typeof parsed['createdAt'] === 'string' ? { createdAt: parsed['createdAt'] } : {}),
      ...(typeof parsed['updatedAt'] === 'string' ? { updatedAt: parsed['updatedAt'] } : {})
    }
  } catch {
    return null
  }
}

const isProcessRunning = (pid: number | undefined): boolean => {
  if (!Number.isInteger(pid) || (pid ?? 0) < 1) {
    return false
  }

  try {
    process.kill(pid as number, 0)
    return true
  } catch (error) {
    return getErrorCode(error) === 'EPERM'
  }
}

const writeProcessLockOwner = async (
  lockDir: string,
  owner: ActiveProcessLockOwner
): Promise<void> => {
  const ownerPath = getLockOwnerPath(lockDir)
  const tempOwnerPath = join(lockDir, `${LOCK_OWNER_FILE}.${owner.ownerId}.${randomUUID()}.tmp`)
  await writeFile(tempOwnerPath, JSON.stringify(owner, null, 2))
  await rename(tempOwnerPath, ownerPath)
}

const refreshProcessLockOwner = async (
  lockDir: string,
  owner: ActiveProcessLockOwner
): Promise<void> => {
  const currentOwner = await readProcessLockOwner(lockDir)
  if (currentOwner?.ownerId !== owner.ownerId) {
    return
  }

  await writeProcessLockOwner(lockDir, {
    ...owner,
    updatedAt: new Date().toISOString()
  })
}

const getProcessLockAgeMs = async (
  lockDir: string,
  owner: ProcessLockOwner | null
): Promise<number | null> => {
  try {
    const lockStats = await stat(owner ? getLockOwnerPath(lockDir) : lockDir)
    return Date.now() - lockStats.mtimeMs
  } catch {
    return null
  }
}

const removeStaleProcessLock = async (
  lockDir: string,
  staleMs: number
): Promise<boolean> => {
  const owner = await readProcessLockOwner(lockDir)
  const sameHost = owner?.hostname === CURRENT_HOSTNAME
  const ownerIsGone = sameHost && owner?.pid !== undefined && !isProcessRunning(owner.pid)
  const ageMs = await getProcessLockAgeMs(lockDir, owner)
  const heartbeatIsStale = ageMs !== null && ageMs > staleMs

  if (!ownerIsGone && !heartbeatIsStale) {
    return false
  }

  await rm(lockDir, { recursive: true, force: true })
  return true
}

const releaseProcessLock = async (
  lockDir: string,
  ownerId: string
): Promise<void> => {
  const owner = await readProcessLockOwner(lockDir)
  if (owner?.ownerId !== ownerId) {
    return
  }

  await rm(lockDir, { recursive: true, force: true })
}

export const withProcessLock = async <T,>(
  lockName: string,
  fn: () => Promise<T>,
  options: ProcessLockOptions = {}
): Promise<T> => {
  const lockRoot = resolveProcessLockRoot(options)
  const lockDir = join(lockRoot, sanitizeLockName(lockName))
  const heartbeatMs = resolvePositiveInteger(options.heartbeatMs, DEFAULT_LOCK_HEARTBEAT_MS)
  const staleMs = Math.max(
    heartbeatMs * 2,
    resolvePositiveInteger(options.staleMs, DEFAULT_LOCK_STALE_MS)
  )
  const waitTimeoutMs = resolvePositiveInteger(options.waitTimeoutMs, DEFAULT_LOCK_WAIT_TIMEOUT_MS)
  const waitMs = resolvePositiveInteger(options.waitMs, DEFAULT_LOCK_WAIT_MS)
  const startedAt = Date.now()

  await mkdir(lockRoot, { recursive: true })

  let owner: ActiveProcessLockOwner | null = null
  while (owner === null) {
    try {
      await mkdir(lockDir)
      const now = new Date().toISOString()
      const acquiredOwner: ActiveProcessLockOwner = {
        ownerId: randomUUID(),
        lockName,
        pid: process.pid,
        hostname: CURRENT_HOSTNAME,
        createdAt: now,
        updatedAt: now
      }

      try {
        await writeProcessLockOwner(lockDir, acquiredOwner)
      } catch (error) {
        await rm(lockDir, { recursive: true, force: true })
        throw error
      }
      owner = acquiredOwner
    } catch (error) {
      if (getErrorCode(error) !== 'EEXIST') {
        throw error
      }

      if (await removeStaleProcessLock(lockDir, staleMs)) {
        continue
      }

      if (Date.now() - startedAt > waitTimeoutMs) {
        throw new Error(`Timed out waiting for process lock ${lockName} at ${lockDir}`)
      }

      await Bun.sleep(waitMs)
    }
  }

  const activeOwner = owner
  const heartbeat = setInterval(() => {
    void refreshProcessLockOwner(lockDir, activeOwner).catch(() => {})
  }, heartbeatMs)
  heartbeat.unref?.()

  try {
    return await fn()
  } finally {
    clearInterval(heartbeat)
    await releaseProcessLock(lockDir, activeOwner.ownerId)
  }
}
