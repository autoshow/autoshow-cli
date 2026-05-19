import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, stat, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { withCacheLock } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-media-cache'

const tempDirs: string[] = []

const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

const withEnv = async (
  updates: Record<string, string>,
  fn: () => Promise<void>
): Promise<void> => {
  const previous = Object.fromEntries(
    Object.keys(updates).map((key) => [key, process.env[key]])
  )

  try {
    Object.assign(process.env, updates)
    await fn()
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

test('media cache lock reaps stale ownerless directory locks', async () => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'autoshow-cache-lock-'))
  tempDirs.push(cacheDir)

  await withEnv({
    AUTOSHOW_CACHE_DIR: cacheDir,
    AUTOSHOW_MEDIA_CACHE_LOCK_STALE_MS: '10000',
    AUTOSHOW_MEDIA_CACHE_LOCK_WAIT_MS: '10000'
  }, async () => {
    const cacheKey = 'stale-ownerless-lock'
    const lockDir = join(cacheDir, 'media', cacheKey, '.lock')
    await mkdir(lockDir, { recursive: true })

    const staleTime = new Date(Date.now() - 60_000)
    await utimes(lockDir, staleTime, staleTime)

    let ownerFileCreated = false
    await withCacheLock(cacheKey, async () => {
      ownerFileCreated = await exists(join(lockDir, 'owner.json'))
    })

    expect(ownerFileCreated).toBe(true)
    expect(await exists(lockDir)).toBe(false)
  })
})
