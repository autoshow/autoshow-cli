import { afterEach, expect, test } from 'bun:test'
import { once } from 'node:events'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareSttMedia } from '~/cli/commands/process-steps/step-2-stt/media'
import type { SttTarget } from '~/types'

const SAMPLE_AUDIO_PATH = 'input/examples/audio/1-audio.mp3'
const CLOUD_STT_TARGET: SttTarget = {
  service: 'groq',
  model: 'whisper-large-v3-turbo',
  local: false
}

const tempDirs: string[] = []

const createTempDir = async (prefix: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

const withYtDlpHidden = async <T>(fn: () => Promise<T>): Promise<T> => {
  const ffmpegPath = Bun.which('ffmpeg')
  const ffprobePath = Bun.which('ffprobe')

  if (!ffmpegPath || !ffprobePath) {
    throw new Error('ffmpeg and ffprobe are required for the direct-media regression test')
  }

  const binDir = await createTempDir('autoshow-direct-media-bin-')
  await symlink(ffmpegPath, join(binDir, 'ffmpeg'))
  await symlink(ffprobePath, join(binDir, 'ffprobe'))

  const originalPath = process.env['PATH']
  process.env['PATH'] = binDir

  try {
    return await fn()
  } finally {
    if (originalPath === undefined) {
      delete process.env['PATH']
    } else {
      process.env['PATH'] = originalPath
    }
  }
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

test('prepareSttMedia accepts direct .mpga URLs with query params without requiring yt-dlp', async () => {
  const audioBytes = await Bun.file(SAMPLE_AUDIO_PATH).bytes()
  let addressPort = 0

  const server = createServer((req, res) => {
    const url = req.url ? new URL(req.url, `http://127.0.0.1:${addressPort}`) : null

    if (url?.pathname === '/episode.mpga') {
      res.statusCode = 200
      res.setHeader('content-type', 'audio/mpeg')
      res.setHeader('content-length', String(audioBytes.length))
      if (req.method === 'HEAD') {
        res.end()
        return
      }
      res.end(Buffer.from(audioBytes))
      return
    }

    res.statusCode = 404
    res.end('not found')
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to determine test server port')
  }
  addressPort = address.port

  const tempDir = await createTempDir('autoshow-direct-media-')
  const outputDir = join(tempDir, 'output')
  const inputUrl = `http://127.0.0.1:${addressPort}/episode.mpga?download=true`

  try {
    const prepared = await withYtDlpHidden(async () => prepareSttMedia({
      source: { url: inputUrl },
      targets: [CLOUD_STT_TARGET],
      outputDir,
      noCache: true
    }))

    try {
      expect(prepared.metadata.title).toBe('episode')
      expect(prepared.executionArtifacts.sourceMediaPath.endsWith('.mp3')).toBe(true)
      expect(prepared.outputArtifacts.sourceMediaPath.endsWith('.mp3')).toBe(true)
      expect(prepared.step1Metadata.audioFileName.endsWith('.mp3')).toBe(true)
      expect(await Bun.file(prepared.executionArtifacts.sourceMediaPath).exists()).toBe(true)
      expect(await Bun.file(prepared.outputArtifacts.sourceMediaPath).exists()).toBe(true)
    } finally {
      await prepared.cleanup?.()
    }
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }
})
