import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runMinimaxMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/minimax/run-minimax-music-gen'

const originalFetch = globalThis.fetch
const originalApiKey = process.env['MINIMAX_API_KEY']
const originalBaseUrl = process.env['MINIMAX_BASE_URL']
const tempDirs: string[] = []

const createFixture = async (lyrics = '[verse]\nTest lyrics\n'): Promise<{ outputDir: string, lyricsPath: string }> => {
  const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-minimax-music-'))
  tempDirs.push(outputDir)

  const lyricsPath = join(outputDir, 'lyrics.txt')
  await Bun.write(lyricsPath, lyrics)

  return { outputDir, lyricsPath }
}

const jsonResponse = (payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  })

afterEach(async () => {
  globalThis.fetch = originalFetch

  if (originalApiKey === undefined) {
    delete process.env['MINIMAX_API_KEY']
  } else {
    process.env['MINIMAX_API_KEY'] = originalApiKey
  }

  if (originalBaseUrl === undefined) {
    delete process.env['MINIMAX_BASE_URL']
  } else {
    process.env['MINIMAX_BASE_URL'] = originalBaseUrl
  }

  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('runMinimaxMusicGen', () => {
  test('uses a single long-running music generation request and writes the audio artifact', async () => {
    const { outputDir, lyricsPath } = await createFixture()
    process.env['MINIMAX_API_KEY'] = 'test-key'
    process.env['MINIMAX_BASE_URL'] = 'https://minimax.test'

    let attempts = 0
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      attempts += 1
      expect(String(input)).toBe('https://minimax.test/v1/music_generation')
      expect(init?.method).toBe('POST')
      expect(init?.signal).toBeDefined()

      const body = JSON.parse(String(init?.body)) as {
        model: string
        prompt: string
        lyrics: string
        output_format: string
      }
      expect(body).toMatchObject({
        model: 'music-2.5',
        prompt: 'indie pop road trip',
        lyrics: '[verse]\nTest lyrics',
        output_format: 'hex'
      })

      await Bun.sleep(25)
      return jsonResponse({
        data: {
          status: 2,
          audio: '01020304'
        },
        extra_info: {
          music_duration: 25364
        },
        base_resp: {
          status_code: 0,
          status_msg: 'success'
        }
      })
    }) as unknown as typeof fetch

    const { musicPath, metadata } = await runMinimaxMusicGen('indie pop road trip', outputDir, {
      model: 'music-2.5',
      lyricsFile: lyricsPath
    })

    expect(attempts).toBe(1)
    expect(musicPath).toBe(`${outputDir}/generated-music.mp3`)
    expect(metadata.musicService).toBe('minimax')
    expect(metadata.musicModel).toBe('music-2.5')
    expect(metadata.musicDurationMs).toBe(25364)
    expect(metadata.lyricsSource).toBe('provided')
    expect(metadata.musicFileName).toBe('generated-music.mp3')

    const bytes = new Uint8Array(await Bun.file(musicPath).arrayBuffer())
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4])
  })

  test('truncates overlong music prompts before the MiniMax request', async () => {
    const { outputDir, lyricsPath } = await createFixture()
    process.env['MINIMAX_API_KEY'] = 'test-key'
    process.env['MINIMAX_BASE_URL'] = 'https://minimax.test'

    const overlongPrompt = 'word '.repeat(500)

    globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        model: string
        prompt: string
        lyrics: string
      }

      expect(body.model).toBe('music-2.5')
      expect(body.lyrics).toBe('[verse]\nTest lyrics')
      expect(body.prompt.length).toBeLessThanOrEqual(2000)
      expect(body.prompt.length).toBeLessThan(overlongPrompt.length)
      expect(body.prompt.endsWith('word')).toBe(true)
      expect(body.prompt.endsWith(' ')).toBe(false)

      return jsonResponse({
        data: {
          status: 2,
          audio: '0102'
        },
        extra_info: {
          music_duration: 1234
        },
        base_resp: {
          status_code: 0,
          status_msg: 'success'
        }
      })
    }) as unknown as typeof fetch

    const { metadata } = await runMinimaxMusicGen(overlongPrompt, outputDir, {
      model: 'music-2.5',
      lyricsFile: lyricsPath
    })

    expect(metadata.musicDurationMs).toBe(1234)
  })

  test('retries once when MiniMax returns an incomplete success envelope', async () => {
    const { outputDir, lyricsPath } = await createFixture()
    process.env['MINIMAX_API_KEY'] = 'test-key'
    process.env['MINIMAX_BASE_URL'] = 'https://minimax.test'

    let attempts = 0
    globalThis.fetch = (async () => {
      attempts += 1

      if (attempts === 1) {
        return jsonResponse({
          data: null,
          extra_info: null,
          base_resp: {
            status_code: 0,
            status_msg: 'success'
          }
        })
      }

      return jsonResponse({
        data: {
          status: 2,
          audio: '0a0b0c'
        },
        extra_info: {
          music_duration: 777
        },
        base_resp: {
          status_code: 0,
          status_msg: 'success'
        }
      })
    }) as unknown as typeof fetch

    const { musicPath, metadata } = await runMinimaxMusicGen('nostalgic synthwave', outputDir, {
      model: 'music-2.5',
      lyricsFile: lyricsPath
    })

    expect(attempts).toBe(2)
    expect(metadata.musicDurationMs).toBe(777)
    expect(await Bun.file(musicPath).exists()).toBe(true)
  })

  test('fails clearly when the incomplete success envelope repeats after the single retry', async () => {
    const { outputDir, lyricsPath } = await createFixture()
    process.env['MINIMAX_API_KEY'] = 'test-key'
    process.env['MINIMAX_BASE_URL'] = 'https://minimax.test'

    let attempts = 0
    globalThis.fetch = (async () => {
      attempts += 1
      return jsonResponse({
        data: null,
        extra_info: null,
        base_resp: {
          status_code: 0,
          status_msg: 'success'
        }
      })
    }) as unknown as typeof fetch

    await expect(runMinimaxMusicGen('late night city pop', outputDir, {
      model: 'music-2.5',
      lyricsFile: lyricsPath
    })).rejects.toThrow('MiniMax music generation returned an incomplete success response after retry')

    expect(attempts).toBe(2)
  })

  test('throws a contextual error when the response completes without audio', async () => {
    const { outputDir, lyricsPath } = await createFixture()
    process.env['MINIMAX_API_KEY'] = 'test-key'
    process.env['MINIMAX_BASE_URL'] = 'https://minimax.test'

    globalThis.fetch = (async () => {
      return jsonResponse({
        data: {
          status: 'processing'
        },
        extra_info: {
          music_duration: 123
        },
        base_resp: {
          status_code: 0,
          status_msg: 'success'
        }
      })
    }) as unknown as typeof fetch

    await expect(runMinimaxMusicGen('dream pop chorus', outputDir, {
      model: 'music-2.5',
      lyricsFile: lyricsPath
    })).rejects.toThrow('MiniMax music generation completed without audio payload')
  })
})
