import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runDeepgramTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/deepgram/run-deepgram-tts'
import { runElevenLabsTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/elevenlabs/run-elevenlabs-tts'
import { runCartesiaTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/cartesia/run-cartesia-tts'
import { runGrokTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/grok/run-grok-tts'
import { runGroqTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/groq/run-groq-tts'
import { runHumeTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/hume/run-hume-tts'
import { runMinimaxTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/minimax/run-minimax-tts'
import { runMistralTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/mistral/run-mistral-tts'
import { runOpenAITts } from '~/cli/commands/process-steps/step-4-tts/tts-services/openai/run-openai-tts'
import { runSpeechifyTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/run-speechify-tts'
import { runTts } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { splitTextIntoUtf8ByteChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'
import type { TtsOptions } from '~/types'
import { createMockWavBase64 } from '../../test-utils/media-fixtures'

const SHORT_AUDIO_URL = 'https://ajc.pics/autoshow/examples/0-audio-short.mp3'
const LOCAL_SHORT_AUDIO_PATH = join('input/examples/audio', '0-audio-short.mp3')
const LOCAL_AUDIO_PATH = join('input/examples/audio', '1-audio.mp3')

const tempDirs: string[] = []
const originalFetch = globalThis.fetch
const previousEnv: Record<string, string | undefined> = {}
const envKeys = [
  'SPEECHIFY_API_KEY',
  'HUME_API_KEY',
  'CARTESIA_API_KEY',
  'MISTRAL_API_KEY',
  'OPENAI_API_KEY',
  'GROQ_API_KEY',
  'XAI_API_KEY',
  'MINIMAX_API_KEY',
  'DEEPGRAM_API_KEY'
]

const restoreEnv = (): void => {
  for (const key of envKeys) {
    if (previousEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = previousEnv[key]
    }
  }
}

const makeTempDir = async (prefix: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

const readMockMp3Base64 = async (): Promise<string> =>
  Buffer.from(await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()).toString('base64')

beforeEach(() => {
  for (const key of envKeys) {
    previousEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(async () => {
  restoreEnv()
  globalThis.fetch = originalFetch
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('TTS provider service contracts', () => {
  test('OpenAI TTS sends instructions and speed in speech requests', async () => {
    const dir = await makeTempDir('autoshow-openai-tts-controls-')
    const audioBytes = Buffer.from(createMockWavBase64(), 'base64')
    const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

    process.env['OPENAI_API_KEY'] = 'openai-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const request = input instanceof Request ? input : undefined
      const bodyText = typeof init?.body === 'string'
        ? init.body
        : request
          ? await request.clone().text()
          : ''
      const headers = new Headers(init?.headers ?? request?.headers)
      calls.push({
        url: request?.url ?? String(input),
        method: init?.method ?? request?.method ?? 'GET',
        authorization: headers.get('authorization'),
        body: JSON.parse(bodyText) as Record<string, unknown>
      })
      return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
    }) as typeof fetch

    const result = await runOpenAITts('OpenAI control synthesis.', dir, {
      model: 'gpt-4o-mini-tts',
      voiceId: 'alloy',
      instructions: 'Speak with a warm documentary narration style.',
      speed: 1.25
    })

    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://api.openai.com/v1/audio/speech',
      method: 'POST',
      authorization: 'Bearer openai-key',
      body: {
        model: 'gpt-4o-mini-tts',
        voice: 'alloy',
        input: 'OpenAI control synthesis.',
        response_format: 'wav',
        instructions: 'Speak with a warm documentary narration style.',
        speed: 1.25
      }
    })
  }, 10_000)

  test('Grok TTS sends language, text normalization, and custom voice IDs', async () => {
    const dir = await makeTempDir('autoshow-grok-tts-controls-')
    const audioBytes = Buffer.from(createMockWavBase64(), 'base64')
    const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

    process.env['XAI_API_KEY'] = 'xai-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      })
      return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
    }) as typeof fetch

    const result = await runGrokTts('Grok control synthesis.', dir, {
      model: 'grok-tts',
      voiceId: 'AB12CD34',
      language: 'ar-SA',
      textNormalization: true
    })

    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(result.metadata).toMatchObject({
      ttsService: 'grok',
      ttsModel: 'grok-tts',
      speaker: 'ab12cd34'
    })
    expect(calls).toEqual([{
      url: 'https://api.x.ai/v1/tts',
      method: 'POST',
      authorization: 'Bearer xai-key',
      body: {
        text: 'Grok control synthesis.',
        voice_id: 'ab12cd34',
        language: 'ar-SA',
        text_normalization: true,
        output_format: {
          codec: 'wav',
          sample_rate: 24000
        }
      }
    }])
  }, 10_000)

  test('Groq TTS defaults to English Orpheus voice', async () => {
    const dir = await makeTempDir('autoshow-groq-tts-defaults-')
    const audioBytes = Buffer.from(createMockWavBase64(), 'base64')
    const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

    process.env['GROQ_API_KEY'] = 'groq-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      })
      return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
    }) as typeof fetch

    const result = await runGroqTts('Groq English synthesis.', dir, {
      model: 'canopylabs/orpheus-v1-english'
    })

    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(result.metadata).toMatchObject({
      ttsService: 'groq',
      ttsModel: 'canopylabs/orpheus-v1-english',
      speaker: 'troy'
    })
    expect(calls).toEqual([{
      url: 'https://api.groq.com/openai/v1/audio/speech',
      method: 'POST',
      authorization: 'Bearer groq-key',
      body: {
        model: 'canopylabs/orpheus-v1-english',
        voice: 'troy',
        input: 'Groq English synthesis.',
        response_format: 'wav'
      }
    }])
  }, 10_000)

  test('MiniMax TTS sends voice controls, language boost, and pronunciation rules', async () => {
    const dir = await makeTempDir('autoshow-minimax-tts-controls-')
    const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
    const calls: Array<{ url: string, method: string, body?: Record<string, unknown> }> = []

    process.env['MINIMAX_API_KEY'] = 'minimax-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      if (url.endsWith('/v1/t2a_async_v2')) {
        calls.push({
          url,
          method,
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        })
        return Response.json({
          task_id: 'task-1',
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (url.includes('/v1/query/t2a_async_query_v2')) {
        calls.push({ url, method })
        return Response.json({
          status: 2,
          file_id: 'speech-file-id',
          base_resp: { status_code: 0, status_msg: 'success' }
        })
      }
      if (url.includes('/v1/files/retrieve_content')) {
        calls.push({ url, method })
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
      }
      throw new Error(`Unexpected MiniMax mock fetch: ${method} ${url}`)
    }) as typeof fetch

    const result = await runMinimaxTts('MiniMax control synthesis.', dir, {
      model: 'speech-2.8-hd',
      voiceId: 'English_expressive_narrator',
      languageBoost: 'English',
      speed: 1.2,
      volume: 2.5,
      pitch: -2,
      emotion: 'calm',
      englishNormalization: true,
      pronunciations: ['AutoShow/auto show', 'TTS/tee tee ess']
    })

    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(calls[0]).toEqual({
      url: 'https://api.minimax.io/v1/t2a_async_v2',
      method: 'POST',
      body: {
        model: 'speech-2.8-hd',
        text: 'MiniMax control synthesis.',
        voice_setting: {
          voice_id: 'English_expressive_narrator',
          speed: 1.2,
          vol: 2.5,
          pitch: -2,
          emotion: 'calm',
          english_normalization: true
        },
        audio_setting: {
          format: 'mp3',
          audio_sample_rate: 32000,
          channel: 1
        },
        language_boost: 'English',
        pronunciation_dict: {
          tone: ['AutoShow/auto show', 'TTS/tee tee ess']
        }
      }
    })
    expect(calls.map((call) => call.method)).toEqual(['POST', 'GET', 'GET'])
  }, 10_000)

  test('Deepgram TTS sends documented output controls as query parameters', async () => {
    const dir = await makeTempDir('autoshow-deepgram-tts-controls-')
    const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
    const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

    process.env['DEEPGRAM_API_KEY'] = 'deepgram-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      })
      return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }) as typeof fetch

    const result = await runDeepgramTts('Deepgram control synthesis.', dir, {
      model: 'aura-2-thalia-en',
      voiceId: 'aura-2-andromeda-en',
      encoding: 'linear16',
      container: 'wav',
      bitRate: 128000,
      sampleRate: 24000,
      speed: 1.1
    })

    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(calls).toEqual([{
      url: 'https://api.deepgram.com/v1/speak?model=aura-2-andromeda-en&encoding=linear16&container=wav&bit_rate=128000&sample_rate=24000&speed=1.1',
      method: 'POST',
      authorization: 'Token deepgram-key',
      body: { text: 'Deepgram control synthesis.' }
    }])
  }, 10_000)

  test('Hume TTS posts Octave file requests with chunked utterances and default named voice', async () => {
    const dir = await makeTempDir('autoshow-hume-tts-default-')
    const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
    const calls: Array<{
      url: string
      method: string
      apiKey: string | null
      accept: string | null
      body: Record<string, unknown>
    }> = []

    process.env['HUME_API_KEY'] = 'hume-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const headers = new Headers(init?.headers)
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        apiKey: headers.get('x-hume-api-key'),
        accept: headers.get('accept'),
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      })
      return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }) as typeof fetch

    const result = await runHumeTts(`${'a'.repeat(5000)} ${'b'.repeat(100)}`, dir, {
      model: 'octave-2'
    })

    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(result.metadata).toMatchObject({
      ttsService: 'hume',
      ttsModel: 'octave-2',
      speaker: 'Male English Actor',
      chunkCount: 2
    })
    expect(calls).toHaveLength(2)
    expect(calls.every((call) => call.url === 'https://api.hume.ai/v0/tts/file')).toBe(true)
    expect(calls.every((call) => call.method === 'POST')).toBe(true)
    expect(calls.every((call) => call.apiKey === 'hume-key')).toBe(true)
    expect(calls.every((call) => call.accept === 'application/octet-stream')).toBe(true)
    expect(calls.map((call) => ((call.body['utterances'] as Array<{ text: string }>)[0] as { text: string }).text.length)).toEqual([5000, 100])
    expect(calls[0]?.body).toMatchObject({
      version: '2',
      format: { type: 'mp3' },
      num_generations: 1,
      utterances: [{
        text: 'a'.repeat(5000),
        voice: {
          name: 'Male English Actor',
          provider: 'HUME_AI'
        }
      }]
    })
  }, 10_000)

  test('Hume TTS sends UUID voice IDs unless a provider is explicit', async () => {
    const idDir = await makeTempDir('autoshow-hume-tts-id-')
    const providerDir = await makeTempDir('autoshow-hume-tts-provider-')
    const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
    const bodies: Record<string, unknown>[] = []

    process.env['HUME_API_KEY'] = 'hume-key'

    globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      bodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>)
      return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }) as typeof fetch

    await runHumeTts('Hume UUID voice synthesis.', idDir, {
      model: 'octave-2',
      voice: '123e4567-e89b-12d3-a456-426614174000'
    })
    await runHumeTts('Hume explicit provider synthesis.', providerDir, {
      model: 'octave-2',
      voice: 'Studio Voice',
      voiceProvider: 'CUSTOM_VOICE'
    })

    expect(((bodies[0]?.['utterances'] as Array<{ voice: unknown }>)[0] as { voice: unknown }).voice).toEqual({
      id: '123e4567-e89b-12d3-a456-426614174000'
    })
    expect(((bodies[1]?.['utterances'] as Array<{ voice: unknown }>)[0] as { voice: unknown }).voice).toEqual({
      name: 'Studio Voice',
      provider: 'CUSTOM_VOICE'
    })
  }, 10_000)

  test('Hume TTS includes non-OK response text in errors', async () => {
    const dir = await makeTempDir('autoshow-hume-tts-error-')
    process.env['HUME_API_KEY'] = 'hume-key'

    globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      return new Response('bad hume', { status: 400 })
    }) as typeof fetch

    await expect(runHumeTts('Hume error synthesis.', dir, {
      model: 'octave-2'
    })).rejects.toThrow('Hume TTS failed (400): bad hume')
  })

  test('Cartesia TTS posts byte synthesis requests with chunked WAV output', async () => {
    const dir = await makeTempDir('autoshow-cartesia-tts-')
    const audioBytes = Buffer.from(createMockWavBase64(), 'base64')
    const calls: Array<{
      url: string
      method: string
      authorization: string | null
      version: string | null
      accept: string | null
      body: Record<string, unknown>
    }> = []

    process.env['CARTESIA_API_KEY'] = 'cartesia-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const headers = new Headers(init?.headers)
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        authorization: headers.get('authorization'),
        version: headers.get('cartesia-version'),
        accept: headers.get('accept'),
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      })
      return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/wav' } })
    }) as typeof fetch

    const result = await runCartesiaTts(`${'a'.repeat(5000)} ${'b'.repeat(100)}`, dir, {
      model: 'sonic-3.5',
      voiceId: 'voice-id-123',
      language: 'en'
    })

    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(result.metadata).toMatchObject({
      ttsService: 'cartesia',
      ttsModel: 'sonic-3.5',
      speaker: 'voice-id-123',
      chunkCount: 2
    })
    expect(calls).toHaveLength(2)
    expect(calls.every((call) => call.url === 'https://api.cartesia.ai/tts/bytes')).toBe(true)
    expect(calls.every((call) => call.method === 'POST')).toBe(true)
    expect(calls.every((call) => call.authorization === 'Bearer cartesia-key')).toBe(true)
    expect(calls.every((call) => call.version === '2026-03-01')).toBe(true)
    expect(calls.every((call) => call.accept === 'application/octet-stream')).toBe(true)
    expect(calls.map((call) => String(call.body['transcript']).length)).toEqual([5000, 100])
    expect(calls[0]?.body).toMatchObject({
      model_id: 'sonic-3.5',
      transcript: 'a'.repeat(5000),
      voice: {
        mode: 'id',
        id: 'voice-id-123'
      },
      language: 'en',
      output_format: {
        container: 'wav',
        encoding: 'pcm_s16le',
        sample_rate: 24000
      }
    })
  }, 10_000)

  test('Cartesia TTS includes non-OK response text in errors', async () => {
    const dir = await makeTempDir('autoshow-cartesia-tts-error-')
    process.env['CARTESIA_API_KEY'] = 'cartesia-key'

    globalThis.fetch = (async (_input: Parameters<typeof fetch>[0], _init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      return new Response('bad cartesia', { status: 400 })
    }) as typeof fetch

    await expect(runCartesiaTts('Cartesia error synthesis.', dir, {
      model: 'sonic-3'
    })).rejects.toThrow('Cartesia TTS failed (400): bad cartesia')
  })

  test('Speechify posts authenticated JSON chunks, retries once, decodes audio, and finalizes metadata', async () => {
    const dir = await makeTempDir('autoshow-speechify-tts-')
    const audioBase64 = createMockWavBase64()
    const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []
    let attempt = 0

    process.env['SPEECHIFY_API_KEY'] = 'speechify-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
        body
      })
      attempt += 1
      if (attempt === 1) {
        return new Response('try again', { status: 500 })
      }
      return Response.json({ audio_data: audioBase64 })
    }) as typeof fetch

    const result = await runSpeechifyTts('a'.repeat(2100), dir, {
      model: 'simba-english',
      voiceId: 'narrator_voice',
      audioFormat: 'wav',
      language: 'en-US'
    })

    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(result.metadata).toMatchObject({
      ttsService: 'speechify',
      ttsModel: 'simba-english',
      speaker: 'narrator_voice',
      chunkCount: 2
    })
    expect(result.metadata.audioFileSize).toBeGreaterThan(0)
    expect(calls).toHaveLength(3)
    expect(calls.map((call) => ({
      url: call.url,
      method: call.method,
      authorization: call.authorization,
      voice: call.body['voice_id'],
      format: call.body['audio_format'],
      model: call.body['model'],
      language: call.body['language'],
      inputLength: String(call.body['input']).length
    }))).toEqual([
      {
        url: 'https://api.speechify.ai/v1/audio/speech',
        method: 'POST',
        authorization: 'Bearer speechify-key',
        voice: 'narrator_voice',
        format: 'wav',
        model: 'simba-english',
        language: 'en-US',
        inputLength: 2000
      },
      {
        url: 'https://api.speechify.ai/v1/audio/speech',
        method: 'POST',
        authorization: 'Bearer speechify-key',
        voice: 'narrator_voice',
        format: 'wav',
        model: 'simba-english',
        language: 'en-US',
        inputLength: 2000
      },
      {
        url: 'https://api.speechify.ai/v1/audio/speech',
        method: 'POST',
        authorization: 'Bearer speechify-key',
        voice: 'narrator_voice',
        format: 'wav',
        model: 'simba-english',
        language: 'en-US',
        inputLength: 100
      }
    ])
  }, 10_000)

  test('Mistral converts non-mp3-wav reference audio to WAV before sending ref_audio', async () => {
    const dir = await makeTempDir('autoshow-mistral-tts-ref-audio-')
    const sourcePath = join(dir, 'reference.m4a')
    const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

    await Bun.$`ffmpeg -v error -y -i ${LOCAL_SHORT_AUDIO_PATH} -t 1 -c:a aac ${sourcePath}`.quiet()

    process.env['MISTRAL_API_KEY'] = 'mistral-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const request = input instanceof Request ? input : undefined
      const bodyText = typeof init?.body === 'string'
        ? init.body
        : request
          ? await request.clone().text()
          : ''
      const headers = new Headers(init?.headers ?? request?.headers)
      calls.push({
        url: request?.url ?? String(input),
        method: init?.method ?? request?.method ?? 'GET',
        authorization: headers.get('authorization'),
        body: JSON.parse(bodyText) as Record<string, unknown>
      })
      return Response.json({ audio_data: createMockWavBase64() })
    }) as typeof fetch

    const result = await runMistralTts('Mistral reference synthesis.', dir, {
      model: 'voxtral-mini-tts-2603',
      refAudioPath: sourcePath
    })

    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://api.mistral.ai/v1/audio/speech',
      method: 'POST',
      authorization: 'Bearer mistral-key'
    })
    expect(calls[0]?.body).toMatchObject({
      model: 'voxtral-mini-tts-2603',
      input: 'Mistral reference synthesis.',
      stream: false,
      response_format: 'wav'
    })

    const refAudio = String(calls[0]?.body['ref_audio'])
    const refBytes = Buffer.from(refAudio, 'base64')
    expect(refBytes.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(refBytes.subarray(8, 12).toString('ascii')).toBe('WAVE')
    expect(await Bun.file(join(dir, 'mistral-reference-audio.wav')).exists()).toBe(false)
    expect(result.metadata).toMatchObject({
      ttsService: 'mistral',
      ttsModel: 'voxtral-mini-tts-2603',
      speaker: 'ref_audio:reference.m4a',
      chunkCount: 1
    })
  }, 10_000)

  test('Mistral creates a saved voice when reference audio is paired with a voice name', async () => {
    const dir = await makeTempDir('autoshow-mistral-tts-saved-voice-')
    const sourcePath = SHORT_AUDIO_URL
    const mediaBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
    const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

    process.env['MISTRAL_API_KEY'] = 'mistral-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const request = input instanceof Request ? input : undefined
      const url = request?.url ?? String(input)
      if (url === SHORT_AUDIO_URL) {
        return new Response(mediaBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
      }
      const bodyText = typeof init?.body === 'string'
        ? init.body
        : request
          ? await request.clone().text()
          : ''
      const headers = new Headers(init?.headers ?? request?.headers)
      const method = init?.method ?? request?.method ?? 'GET'
      const body = JSON.parse(bodyText) as Record<string, unknown>
      calls.push({ url, method, authorization: headers.get('authorization'), body })

      if (url.endsWith('/v1/audio/voices')) {
        return Response.json({
          id: 'mistral_saved_voice_123',
          name: 'AutoShow Saved Voice',
          retention_notice: 30,
          created_at: '2026-01-01T00:00:00.000Z',
          user_id: null
        })
      }
      if (url.endsWith('/v1/audio/speech')) {
        return Response.json({ audio_data: createMockWavBase64() })
      }
      throw new Error(`Unexpected Mistral saved voice mock fetch: ${method} ${url}`)
    }) as typeof fetch

    const result = await runMistralTts('Mistral saved voice synthesis.', dir, {
      model: 'voxtral-mini-tts-2603',
      refAudioPath: sourcePath,
      voiceName: 'AutoShow Saved Voice'
    })

    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      url: 'https://api.mistral.ai/v1/audio/voices',
      method: 'POST',
      authorization: 'Bearer mistral-key',
      body: {
        name: 'AutoShow Saved Voice',
        sample_filename: '0-audio-short.mp3',
        retention_notice: 30
      }
    })
    expect(typeof calls[0]?.body['sample_audio']).toBe('string')
    expect(String(calls[0]?.body['sample_audio']).length).toBeGreaterThan(0)
    expect(calls[1]).toMatchObject({
      url: 'https://api.mistral.ai/v1/audio/speech',
      method: 'POST',
      authorization: 'Bearer mistral-key',
      body: {
        model: 'voxtral-mini-tts-2603',
        input: 'Mistral saved voice synthesis.',
        stream: false,
        response_format: 'wav',
        voice_id: 'mistral_saved_voice_123'
      }
    })
    expect(result.metadata).toMatchObject({
      ttsService: 'mistral',
      ttsModel: 'voxtral-mini-tts-2603',
      speaker: 'mistral_saved_voice_123',
      clonedVoiceId: 'mistral_saved_voice_123',
      cloneCostCents: 0
    })
  }, 10_000)

  test('Mistral multi-speaker TTS sends each speaker reference audio', async () => {
    const dir = await makeTempDir('autoshow-mistral-tts-dialogue-ref-audio-')
    const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

    process.env['MISTRAL_API_KEY'] = 'mistral-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const request = input instanceof Request ? input : undefined
      const bodyText = typeof init?.body === 'string'
        ? init.body
        : request
          ? await request.clone().text()
          : ''
      const headers = new Headers(init?.headers ?? request?.headers)
      const method = init?.method ?? request?.method ?? 'GET'
      const url = request?.url ?? String(input)
      calls.push({
        url,
        method,
        authorization: headers.get('authorization'),
        body: JSON.parse(bodyText) as Record<string, unknown>
      })
      return Response.json({ audio_data: createMockWavBase64() })
    }) as typeof fetch

    const result = await runTts([
      'Host: Welcome to the reference audio test.',
      'Guest: Thanks. I should use the guest sample.'
    ].join('\n'), dir, {
      mistralTtsModels: ['voxtral-mini-tts-2603'],
      ttsDialogueFormat: 'labeled',
      ttsSpeakerRefAudios: [
        `Host=${LOCAL_SHORT_AUDIO_PATH}`,
        `Guest=${LOCAL_AUDIO_PATH}`
      ]
    } as TtsOptions)

    expect(calls).toHaveLength(2)
    for (const call of calls) {
      expect(call).toMatchObject({
        url: 'https://api.mistral.ai/v1/audio/speech',
        method: 'POST',
        authorization: 'Bearer mistral-key',
        body: {
          model: 'voxtral-mini-tts-2603',
          stream: false,
          response_format: 'wav'
        }
      })
      expect(typeof call.body['ref_audio']).toBe('string')
      expect(String(call.body['ref_audio']).length).toBeGreaterThan(0)
      expect(call.body['voice_id']).toBeUndefined()
    }
    expect(calls[0]?.body['input']).toBe('Welcome to the reference audio test.')
    expect(calls[1]?.body['input']).toBe('Thanks. I should use the guest sample.')

    expect(await Bun.file(join(dir, 'speech.wav')).exists()).toBe(true)
    expect(await Bun.file(join(dir, 'dialogue-normalized.txt')).exists()).toBe(true)
    expect(await Bun.file(join(dir, 'segments', 'segment-001-Host.wav')).exists()).toBe(true)
    expect(await Bun.file(join(dir, 'segments', 'segment-002-Guest.wav')).exists()).toBe(true)
    expect(await Bun.file(result.audioPaths[0] ?? '').exists()).toBe(true)
    expect(result.metadata).toHaveLength(1)
    expect(result.metadata[0]).toMatchObject({
      ttsService: 'mistral',
      ttsModel: 'voxtral-mini-tts-2603',
      speaker: 'Host=ref_audio:0-audio-short.mp3, Guest=ref_audio:1-audio.mp3',
      chunkCount: 2
    })
  }, 10_000)

  test('ElevenLabs TTS sends output format, voice settings, seed, text normalization, and pronunciation dictionaries controls', async () => {
    const dir = await makeTempDir('autoshow-elevenlabs-tts-controls-')
    const audioBytes = await Bun.file(LOCAL_SHORT_AUDIO_PATH).arrayBuffer()
    const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

    process.env['ELEVENLABS_API_KEY'] = 'elevenlabs-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('xi-api-key'),
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      })
      return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
    }) as typeof fetch

    const result = await runElevenLabsTts('ElevenLabs control synthesis.', dir, {
      model: 'eleven_v3',
      voiceId: 'voice_existing123',
      controls: {
        outputFormat: 'mp3_22050_32',
        languageCode: 'en',
        voiceSettings: {
          stability: 0.4,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
          speed: 1.1
        },
        seed: 12345,
        textNormalization: 'on',
        pronunciationDictionaryLocators: ['dict_1:version_2', 'dict_3'],
        optimizeStreamingLatency: 2
      }
    })

    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(calls).toEqual([{
      url: 'https://api.elevenlabs.io/v1/text-to-speech/voice_existing123?output_format=mp3_22050_32&optimize_streaming_latency=2',
      method: 'POST',
      authorization: 'elevenlabs-key',
      body: {
        text: 'ElevenLabs control synthesis.',
        model_id: 'eleven_v3',
        language_code: 'en',
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8,
          style: 0.2,
          use_speaker_boost: true,
          speed: 1.1
        },
        seed: 12345,
        apply_text_normalization: 'on',
        pronunciation_dictionary_locators: [
          {
            pronunciation_dictionary_id: 'dict_1',
            version_id: 'version_2'
          },
          {
            pronunciation_dictionary_id: 'dict_3'
          }
        ]
      }
    }])
  }, 10_000)

  test('Speechify custom voice creation posts multipart consent and uses the returned voice ID for synthesis', async () => {
    const dir = await makeTempDir('autoshow-speechify-custom-voice-')
    const samplePath = join(dir, 'speechify-sample.mp3')
    await Bun.$`ffmpeg -v error -y -i ${LOCAL_AUDIO_PATH} -t 12 -c copy ${samplePath}`.quiet()
    const audioBase64 = await readMockMp3Base64()
    const calls: Array<{
      url: string
      method: string
      authorization: string | null
      form?: {
        name: string
        consent: string
        sampleName: string | undefined
        sampleType: string | undefined
      }
      body?: Record<string, unknown>
    }> = []

    process.env['SPEECHIFY_API_KEY'] = 'speechify-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const url = String(input)
      const authorization = new Headers(init?.headers).get('authorization')
      if (url.endsWith('/v1/voices')) {
        const form = init?.body as FormData
        const sample = form.get('sample')
        calls.push({
          url,
          method: init?.method ?? 'GET',
          authorization,
          form: {
            name: String(form.get('name')),
            consent: String(form.get('consent')),
            sampleName: sample instanceof File ? sample.name : undefined,
            sampleType: sample instanceof File ? sample.type : undefined
          }
        })
        return Response.json({ id: 'speechify_custom_voice_123' })
      }

      if (url.endsWith('/v1/audio/speech')) {
        calls.push({
          url,
          method: init?.method ?? 'GET',
          authorization,
          body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        })
        return Response.json({ audio_data: audioBase64 })
      }

      throw new Error(`Unexpected Speechify mock fetch: ${url}`)
    }) as typeof fetch

    const result = await runSpeechifyTts('Speechify custom voice synthesis.', dir, {
      model: 'simba-multilingual',
      customVoice: {
        refAudioPath: samplePath,
        voiceName: 'AutoShow Anthony',
        consentName: 'Anthony Example',
        consentEmail: 'anthony@example.com',
        locale: 'en-US',
        gender: 'notSpecified'
      }
    })

    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(result.metadata).toMatchObject({
      ttsService: 'speechify',
      ttsModel: 'simba-multilingual',
      speaker: 'ref_audio:speechify-sample.mp3',
      clonedVoiceId: 'speechify_custom_voice_123',
      cloneCostCents: 0,
      chunkCount: 1
    })
    expect(calls).toHaveLength(2)
    expect(calls[0]).toEqual({
      url: 'https://api.speechify.ai/v1/voices',
      method: 'POST',
      authorization: 'Bearer speechify-key',
      form: {
        name: 'AutoShow Anthony',
        consent: 'true',
        sampleName: 'speechify-sample.mp3',
        sampleType: 'audio/mpeg'
      }
    })
    expect(calls[1]).toMatchObject({
      url: 'https://api.speechify.ai/v1/audio/speech',
      method: 'POST',
      authorization: 'Bearer speechify-key',
      body: {
        voice_id: 'speechify_custom_voice_123',
        audio_format: 'mp3',
        model: 'simba-multilingual',
        input: 'Speechify custom voice synthesis.'
      }
    })
  }, 10_000)

  test('Speechify custom voice validates audio before creation', async () => {
    const dir = await makeTempDir('autoshow-speechify-custom-voice-invalid-')
    const emptyAudio = join(dir, 'empty.mp3')
    await writeFile(emptyAudio, '')
    const calls: string[] = []

    process.env['SPEECHIFY_API_KEY'] = 'speechify-key'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
      calls.push(String(input))
      return Response.json({ id: 'unexpected' })
    }) as typeof fetch

    await expect(runSpeechifyTts('Invalid custom voice.', dir, {
      model: 'simba-english',
      customVoice: {
        refAudioPath: emptyAudio,
        consentName: 'Anthony Example',
        consentEmail: 'anthony@example.com'
      }
    })).rejects.toThrow('reference audio is empty')
    expect(calls).toHaveLength(0)
  })

  test('UTF-8 byte chunking respects multi-byte characters and hard byte limits', () => {
    const chunks = splitTextIntoUtf8ByteChunks(`${'é'.repeat(6)} ${'🙂'.repeat(3)}`, 12)

    expect(chunks.every((chunk) => Buffer.byteLength(chunk, 'utf8') <= 12)).toBe(true)
    expect(chunks.join('')).toBe(`${'é'.repeat(6)}${'🙂'.repeat(3)}`)
  })
})
