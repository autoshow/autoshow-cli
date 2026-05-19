import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { collectMusicTargets } from '~/cli/commands/process-steps/step-7-music/music-targets'
import { runDeapiMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/deapi/run-deapi-music-gen'
import { runElevenLabsMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/elevenlabs/run-elevenlabs-music-gen'
import { writeGeminiMusicInlineAudio } from '~/cli/commands/process-steps/step-7-music/music-services/gemini/run-gemini-music-gen'
import { runMinimaxMusicGen } from '~/cli/commands/process-steps/step-7-music/music-services/minimax/run-minimax-music-gen'

const audioBytes = new Uint8Array([1, 2, 3, 4])
const audioHex = Buffer.from(audioBytes).toString('hex')
const audioBase64 = Buffer.from(audioBytes).toString('base64')

const withEnvAndFetch = async <T,>(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
  fn: () => Promise<T>
): Promise<T> => {
  const previousFetch = globalThis.fetch
  const previousEnv = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]))

  try {
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
    globalThis.fetch = fetchImpl
    return await fn()
  } finally {
    globalThis.fetch = previousFetch
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

const withTempDir = async <T,>(fn: (dir: string) => Promise<T>): Promise<T> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-music-provider-'))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

const readJsonBody = (body: RequestInit['body'] | null | undefined): Record<string, unknown> =>
  JSON.parse(String(body ?? '{}')) as Record<string, unknown>

describe('music provider contracts', () => {
  test('MiniMax music accepts 2.6 models and rejects unsupported cover models', () => {
    const opts = buildOptsFromFlags(false, {
      'minimax-music': ['music-2.6', 'music-2.6-free']
    })

    expect(opts.minimaxMusicModels).toEqual(['music-2.6', 'music-2.6-free'])
    expect(collectMusicTargets(opts).map((target) => `${target.service}:${target.model}`)).toEqual([
      'minimax:music-2.6',
      'minimax:music-2.6-free'
    ])
    expect(() => buildOptsFromFlags(false, {
      'minimax-music': 'music-cover'
    })).toThrow('Invalid --minimax-music model "music-cover"')
  })

  test('MiniMax instrumental flow sends is_instrumental and skips lyrics generation', async () => {
    const calls: Array<Record<string, unknown>> = []

    await withTempDir(async (dir) => {
      await withEnvAndFetch({
        MINIMAX_API_KEY: 'test-key',
        MINIMAX_BASE_URL: 'https://mock.minimax.local'
      }, (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        if (url.endsWith('/v1/lyrics_generation')) {
          throw new Error('MiniMax lyrics generation should not be called for instrumental runs')
        }
        if (url.endsWith('/v1/music_generation')) {
          const body = readJsonBody(init?.body)
          calls.push(body)
          return new Response(JSON.stringify({
            data: { audio: audioHex, status: 2 },
            trace_id: 'trace-instrumental',
            extra_info: {
              music_duration: 32100,
              music_sample_rate: 44100,
              music_channel: 2,
              bitrate: 256000,
              music_size: audioBytes.byteLength
            },
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`Unexpected MiniMax mock fetch: ${init?.method ?? 'GET'} ${url}`)
      }) as typeof fetch, async () => {
        const opts = buildOptsFromFlags(false, {
          'minimax-music': 'music-2.6',
          'music-instrumental': true
        })
        const [target] = collectMusicTargets(opts)
        expect(target).toBeDefined()
        const result = await target!.run('ambient piano instrumental', dir)

        expect(await Bun.file(result.musicPath).exists()).toBe(true)
        expect(calls).toHaveLength(1)
        expect(calls[0]).toMatchObject({
          model: 'music-2.6',
          prompt: 'ambient piano instrumental',
          is_instrumental: true,
          output_format: 'hex',
          audio_setting: {
            sample_rate: 44100,
            bitrate: 256000,
            format: 'mp3'
          }
        })
        expect('lyrics' in calls[0]!).toBe(false)
        expect(result.metadata).toMatchObject({
          musicService: 'minimax',
          musicModel: 'music-2.6',
          lyricsSource: 'none',
          musicDurationMs: 32100,
          providerTraceId: 'trace-instrumental',
          audioSampleRate: 44100,
          audioChannelCount: 2,
          audioBitrate: 256000,
          providerAudioByteSize: audioBytes.byteLength,
          outputFormat: 'mp3'
        })
      })
    })
  })

  test('MiniMax auto-lyrics metadata captures generated title, style, and lyrics', async () => {
    const calls: Array<{ url: string, body: Record<string, unknown> }> = []

    await withTempDir(async (dir) => {
      await withEnvAndFetch({
        MINIMAX_API_KEY: 'test-key',
        MINIMAX_BASE_URL: 'https://mock.minimax.local'
      }, (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const body = readJsonBody(init?.body)
        calls.push({ url, body })
        if (url.endsWith('/v1/lyrics_generation')) {
          return new Response(JSON.stringify({
            song_title: 'Neon Rain',
            style_tags: 'synth pop, nocturnal',
            lyrics: '[Verse]\nNeon rain on the avenue',
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url.endsWith('/v1/music_generation')) {
          return new Response(JSON.stringify({
            data: { audio: audioHex, status: 2 },
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`Unexpected MiniMax mock fetch: ${init?.method ?? 'GET'} ${url}`)
      }) as typeof fetch, async () => {
        const result = await runMinimaxMusicGen('synth pop about neon rain', dir, {
          model: 'music-2.6'
        })

        expect(calls.map((call) => call.url)).toEqual([
          'https://mock.minimax.local/v1/lyrics_generation',
          'https://mock.minimax.local/v1/music_generation'
        ])
        expect(calls[1]?.body).toMatchObject({
          model: 'music-2.6',
          lyrics: '[Verse]\nNeon rain on the avenue'
        })
        expect(result.metadata).toMatchObject({
          lyricsSource: 'generated',
          generatedSongTitle: 'Neon Rain',
          generatedStyleTags: 'synth pop, nocturnal',
          generatedLyrics: '[Verse]\nNeon rain on the avenue'
        })
      })
    })
  })

  test('MiniMax caps prompt length and validates lyrics length before generation requests', async () => {
    const calls: Array<Record<string, unknown>> = []

    await withTempDir(async (dir) => {
      await withEnvAndFetch({
        MINIMAX_API_KEY: 'test-key',
        MINIMAX_BASE_URL: 'https://mock.minimax.local'
      }, (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        if (url.endsWith('/v1/music_generation')) {
          calls.push(readJsonBody(init?.body))
          return new Response(JSON.stringify({
            data: { audio: audioHex, status: 2 },
            base_resp: { status_code: 0, status_msg: 'success' }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        throw new Error(`Unexpected MiniMax mock fetch: ${init?.method ?? 'GET'} ${url}`)
      }) as typeof fetch, async () => {
        const longPrompt = 'x'.repeat(2001)
        await runMinimaxMusicGen(longPrompt, dir, {
          model: 'music-2.6',
          forceInstrumental: true
        })

        expect(calls).toHaveLength(1)
        expect(calls[0]?.['prompt']).toBe('x'.repeat(2000))

        const lyricsPath = join(dir, 'lyrics.txt')
        await writeFile(lyricsPath, 'y'.repeat(3501))
        const callCountBeforeLyricsValidation = calls.length
        await expect(runMinimaxMusicGen('valid prompt', dir, {
          model: 'music-2.6',
          lyricsFile: lyricsPath
        })).rejects.toThrow('must be 3500 characters or fewer')

        expect(calls).toHaveLength(callCountBeforeLyricsValidation)
      })
    })
  })

  test('Gemini text parts are preserved while audio inline data is written', async () => {
    await withTempDir(async (dir) => {
      const musicPath = join(dir, 'generated-music.mp3')
      const result = await writeGeminiMusicInlineAudio([
        { thought: true, text: 'hidden scratchpad' },
        { text: '[Verse]\nSilver static in the sky' },
        { inlineData: { data: Buffer.alloc(0).toString('base64'), mimeType: 'audio/mpeg' } },
        { inlineData: { data: audioBase64, mimeType: 'audio/mpeg' } }
      ], musicPath)

      expect(new Uint8Array(await Bun.file(musicPath).arrayBuffer())).toEqual(audioBytes)
      expect(result).toEqual({
        audioMimeType: 'audio/mpeg',
        outputFormat: 'mp3',
        generatedText: '[Verse]\nSilver static in the sky'
      })
    })
  })

  test('deAPI music metadata records request, seed, steps, guidance, and format', async () => {
    const formRequests: Array<Record<string, unknown>> = []

    await withTempDir(async (dir) => {
      await withEnvAndFetch({
        DEAPI_API_KEY: 'test-key',
        DEAPI_BASE_URL: 'https://mock.deapi.local'
      }, (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        if (url.endsWith('/api/v2/audio/music/price')) {
          return new Response(JSON.stringify({ data: { price: 0.123 } }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
        if (url.endsWith('/api/v2/audio/music') && init?.body instanceof FormData) {
          formRequests.push({
            caption: init.body.get('caption'),
            model: init.body.get('model'),
            lyrics: init.body.get('lyrics'),
            duration: init.body.get('duration'),
            inference_steps: init.body.get('inference_steps'),
            guidance_scale: init.body.get('guidance_scale'),
            seed: init.body.get('seed'),
            format: init.body.get('format')
          })
          return new Response(JSON.stringify({ request_id: 'deapi-request-123' }), {
            status: 200,
            headers: { 'content-type': 'application/json' }
          })
        }
        if (url.endsWith('/api/v2/jobs/deapi-request-123')) {
          return new Response(JSON.stringify({
            data: {
              status: 'done',
              result_url: 'https://mock.deapi.local/result.mp3'
            }
          }), { status: 200, headers: { 'content-type': 'application/json' } })
        }
        if (url === 'https://mock.deapi.local/result.mp3') {
          return new Response(audioBytes, {
            status: 200,
            headers: { 'content-type': 'audio/mpeg' }
          })
        }
        throw new Error(`Unexpected deAPI mock fetch: ${init?.method ?? 'GET'} ${url}`)
      }) as typeof fetch, async () => {
        const result = await runDeapiMusicGen('bright synth pop', dir, {
          model: 'AceStep_1_5_Turbo',
          durationSeconds: 20,
          forceInstrumental: true
        })

        expect(formRequests).toEqual([{
          caption: 'bright synth pop',
          model: 'AceStep_1_5_Turbo',
          lyrics: '[Instrumental]',
          duration: '20',
          inference_steps: '8',
          guidance_scale: '1',
          seed: '-1',
          format: 'mp3'
        }])
        expect(result.metadata).toMatchObject({
          providerRequestId: 'deapi-request-123',
          providerCostCents: 12.3,
          providerCostSource: 'provider_quote',
          seed: -1,
          inferenceSteps: 8,
          guidanceScale: 1,
          outputFormat: 'mp3',
          providerAudioByteSize: audioBytes.byteLength,
          audioMimeType: 'audio/mpeg'
        })
      })
    })
  })

  test('ElevenLabs music metadata records output format and response headers', async () => {
    const requests: Array<Record<string, unknown>> = []

    await withTempDir(async (dir) => {
      await withEnvAndFetch({
        ELEVENLABS_API_KEY: 'test-key',
        ELEVENLABS_BASE_URL: 'https://mock.elevenlabs.local/v1'
      }, (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        if (url === 'https://mock.elevenlabs.local/v1/music?output_format=mp3_44100_128') {
          requests.push(readJsonBody(init?.body))
          return new Response(audioBytes, {
            status: 200,
            headers: {
              'content-type': 'audio/mpeg',
              'request-id': 'eleven-request-123'
            }
          })
        }
        throw new Error(`Unexpected ElevenLabs mock fetch: ${init?.method ?? 'GET'} ${url}`)
      }) as typeof fetch, async () => {
        const result = await runElevenLabsMusicGen('lo-fi instrumental', dir, {
          model: 'music_v1',
          durationSeconds: 12,
          forceInstrumental: true
        })

        expect(requests).toEqual([{
          model_id: 'music_v1',
          prompt: 'lo-fi instrumental',
          music_length_ms: 12000,
          force_instrumental: true
        }])
        expect(result.metadata).toMatchObject({
          providerRequestId: 'eleven-request-123',
          audioMimeType: 'audio/mpeg',
          audioSampleRate: 44100,
          audioBitrate: 128000,
          providerAudioByteSize: audioBytes.byteLength,
          outputFormat: 'mp3_44100_128'
        })
      })
    })
  })
})
