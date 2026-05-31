import { afterEach, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, stat, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  prepareSttMedia,
  withCacheLock
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-media-cache'
import { commandExists } from '~/utils/cli-utils'

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

test('media cache keeps source artifacts separate for local and hosted STT profiles', async () => {
  if (!commandExists('ffmpeg') || !commandExists('ffprobe')) {
    throw new Error('ffmpeg and ffprobe are required for STT media cache profile coverage')
  }

  const cacheDir = await mkdtemp(join(tmpdir(), 'autoshow-stt-profile-cache-'))
  tempDirs.push(cacheDir)

  await withEnv({
    AUTOSHOW_CACHE_DIR: cacheDir
  }, async () => {
    const source = { filePath: join(process.cwd(), 'input/examples/audio/0-audio-short.mp3') }

    const localPrepared = await prepareSttMedia({
      source,
      targets: [{ service: 'whisper', model: 'tiny', local: true }]
    })
    const localSourceMediaPath = localPrepared.executionArtifacts.sourceMediaPath
    expect(await exists(localSourceMediaPath)).toBe(true)

    const hostedPrepared = await prepareSttMedia({
      source,
      targets: [{ service: 'gladia', model: 'default', local: false }]
    })
    const hostedSourceMediaPath = hostedPrepared.executionArtifacts.sourceMediaPath

    expect(dirname(hostedSourceMediaPath)).not.toBe(dirname(localSourceMediaPath))
    expect(await exists(localSourceMediaPath)).toBe(true)
    expect(await exists(hostedSourceMediaPath)).toBe(true)
  })
})
