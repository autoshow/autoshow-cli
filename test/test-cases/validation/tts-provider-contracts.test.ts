import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runGcloudTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/gcloud/run-gcloud-tts'
import { runSpeechifyTts } from '~/cli/commands/process-steps/step-4-tts/tts-services/speechify/run-speechify-tts'
import { splitTextIntoUtf8ByteChunks } from '~/cli/commands/process-steps/step-4-tts/tts-utils/audio-utils'

const tempDirs: string[] = []
const originalFetch = globalThis.fetch
const previousEnv: Record<string, string | undefined> = {}
const envKeys = [
  'SPEECHIFY_API_KEY',
  'SPEECHIFY_BASE_URL',
  'SPEECHIFY_TTS_VOICE',
  'AUTOSHOW_GCLOUD_BIN',
  'GCLOUD_TTS_BASE_URL',
  'GCLOUD_TTS_LANGUAGE',
  'GCLOUD_TTS_VOICE'
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
  Buffer.from(await Bun.file('input/examples/audio/0-audio-short.mp3').arrayBuffer()).toString('base64')

const createMockWavBase64 = (): string => {
  const sampleRate = 16000
  const channels = 1
  const bitsPerSample = 16
  const samples = 1600
  const dataSize = samples * channels * (bitsPerSample / 8)
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28)
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32)
  buffer.writeUInt16LE(bitsPerSample, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  return buffer.toString('base64')
}

const writeFakeReadyGcloud = async (dir: string): Promise<string> => {
  const bin = join(dir, 'gcloud')
  await writeFile(bin, `#!/bin/sh
if [ "$1 $2 $3" = "auth print-access-token --quiet" ]; then
  echo "gcloud-token"
  exit 0
fi
if [ "$1 $2 $3" = "config get-value project" ]; then
  echo "test-project"
  exit 0
fi
if [ "$1 $2 $3" = "billing projects describe" ]; then
  echo '{"billingAccountName":"billingAccounts/000000-000000-000000","billingEnabled":true}'
  exit 0
fi
if [ "$1 $2" = "services list" ]; then
  for arg in "$@"; do
    case "$arg" in
      --filter=config.name=*) echo "\${arg#--filter=config.name=}" ;;
    esac
  done
  exit 0
fi
exit 1
`)
  await chmod(bin, 0o755)
  return bin
}

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
  test('Speechify posts authenticated JSON chunks, retries once, decodes audio, and finalizes metadata', async () => {
    const dir = await makeTempDir('autoshow-speechify-tts-')
    const audioBase64 = await readMockMp3Base64()
    const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []
    let attempt = 0

    process.env['SPEECHIFY_API_KEY'] = 'speechify-key'
    process.env['SPEECHIFY_BASE_URL'] = 'https://mock.speechify.local'

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
      voiceId: 'narrator_voice'
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
      inputLength: String(call.body['input']).length
    }))).toEqual([
      {
        url: 'https://mock.speechify.local/v1/audio/speech',
        method: 'POST',
        authorization: 'Bearer speechify-key',
        voice: 'narrator_voice',
        format: 'mp3',
        model: 'simba-english',
        inputLength: 2000
      },
      {
        url: 'https://mock.speechify.local/v1/audio/speech',
        method: 'POST',
        authorization: 'Bearer speechify-key',
        voice: 'narrator_voice',
        format: 'mp3',
        model: 'simba-english',
        inputLength: 2000
      },
      {
        url: 'https://mock.speechify.local/v1/audio/speech',
        method: 'POST',
        authorization: 'Bearer speechify-key',
        voice: 'narrator_voice',
        format: 'mp3',
        model: 'simba-english',
        inputLength: 100
      }
    ])
  }, 10_000)

  test('Speechify custom voice creation posts multipart consent and uses the returned voice ID for synthesis', async () => {
    const dir = await makeTempDir('autoshow-speechify-custom-voice-')
    const samplePath = join(dir, 'speechify-sample.mp3')
    await Bun.$`ffmpeg -v error -y -i input/examples/audio/1-audio.mp3 -t 12 -c copy ${samplePath}`.quiet()
    const audioBase64 = await readMockMp3Base64()
    const calls: Array<{
      url: string
      method: string
      authorization: string | null
      form?: {
        name: string
        locale: string
        gender: string
        consent: unknown
        sampleName: string | undefined
        sampleType: string | undefined
      }
      body?: Record<string, unknown>
    }> = []

    process.env['SPEECHIFY_API_KEY'] = 'speechify-key'
    process.env['SPEECHIFY_BASE_URL'] = 'https://mock.speechify.local'

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
            locale: String(form.get('locale')),
            gender: String(form.get('gender')),
            consent: JSON.parse(String(form.get('consent'))),
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
      url: 'https://mock.speechify.local/v1/voices',
      method: 'POST',
      authorization: 'Bearer speechify-key',
      form: {
        name: 'AutoShow Anthony',
        locale: 'en-US',
        gender: 'notSpecified',
        consent: {
          fullName: 'Anthony Example',
          email: 'anthony@example.com'
        },
        sampleName: 'speechify-sample.mp3',
        sampleType: 'audio/mpeg'
      }
    })
    expect(calls[1]).toMatchObject({
      url: 'https://mock.speechify.local/v1/audio/speech',
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
    process.env['SPEECHIFY_BASE_URL'] = 'https://mock.speechify.local'

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

  test('Google Cloud prebuilt synthesis sends REST bodies with byte-aware chunks and decoded audio', async () => {
    const dir = await makeTempDir('autoshow-gcloud-tts-')
    process.env['AUTOSHOW_GCLOUD_BIN'] = await writeFakeReadyGcloud(dir)
    process.env['GCLOUD_TTS_BASE_URL'] = 'https://mock.gcloud.local'
    const audioBase64 = createMockWavBase64()
    const calls: Array<{ url: string, headers: Headers, body: Record<string, unknown> }> = []

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      calls.push({
        url: String(input),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      })
      return Response.json({ audioContent: audioBase64 })
    }) as typeof fetch

    const result = await runGcloudTts('x'.repeat(4900), dir, {
      model: 'neural2',
      voice: 'en-US-Neural2-C',
      language: 'en-US'
    })

    expect(await Bun.file(result.audioPath).exists()).toBe(true)
    expect(result.metadata).toMatchObject({
      ttsService: 'gcloud',
      ttsModel: 'neural2',
      speaker: 'en-US-Neural2-C',
      chunkCount: 2
    })
    expect(calls).toHaveLength(2)
    expect(calls.every((call) => call.url === 'https://mock.gcloud.local/v1/text:synthesize')).toBe(true)
    expect(calls.every((call) => call.headers.get('authorization') === 'Bearer gcloud-token')).toBe(true)
    expect(calls.every((call) => call.headers.get('x-goog-user-project') === 'test-project')).toBe(true)
    expect(calls.map((call) => Buffer.byteLength((call.body['input'] as { text: string }).text, 'utf8'))).toEqual([4800, 100])
    expect(calls[0]?.body).toMatchObject({
      voice: {
        languageCode: 'en-US',
        name: 'en-US-Neural2-C'
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        sampleRateHertz: 24000
      }
    })
  })

  test('Google Cloud instant custom voice generates an optional key file and synthesizes with the generated key', async () => {
    const dir = await makeTempDir('autoshow-gcloud-icv-')
    const keyOut = join(dir, 'voice-key.txt')
    process.env['AUTOSHOW_GCLOUD_BIN'] = await writeFakeReadyGcloud(dir)
    process.env['GCLOUD_TTS_BASE_URL'] = 'https://mock.gcloud.local'
    const audioBase64 = createMockWavBase64()
    const calls: Array<{ url: string, body: Record<string, unknown> }> = []

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const url = String(input)
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      calls.push({ url, body })
      if (url.endsWith('/v1beta1/voices:generateVoiceCloningKey')) {
        return Response.json({ voiceCloningKey: 'generated-key' })
      }
      if (url.endsWith('/v1beta1/text:synthesize')) {
        return Response.json({ audioContent: audioBase64 })
      }
      throw new Error(`Unexpected Google Cloud TTS mock fetch: ${url}`)
    }) as typeof fetch

    const result = await runGcloudTts('Hello from instant custom voice.', dir, {
      model: 'instant-custom-voice',
      refAudioPath: 'input/examples/audio/0-audio-short.mp3',
      consentAudioPath: 'input/examples/audio/0-audio-short.mp3',
      consentLanguage: 'en-US',
      voiceCloningKeyOut: keyOut
    })

    expect(await readFile(keyOut, 'utf8')).toBe('generated-key\n')
    expect(result.metadata).toMatchObject({
      ttsService: 'gcloud',
      ttsModel: 'instant-custom-voice',
      speaker: 'instant-custom-voice',
      chunkCount: 1
    })
    expect(calls.map((call) => call.url)).toEqual([
      'https://mock.gcloud.local/v1beta1/voices:generateVoiceCloningKey',
      'https://mock.gcloud.local/v1beta1/text:synthesize'
    ])
    expect(calls[0]?.body).toMatchObject({
      reference_audio: {
        audio_config: { audio_encoding: 'MP3' }
      },
      voice_talent_consent: {
        audio_config: { audio_encoding: 'MP3' }
      },
      language_code: 'en-US'
    })
    expect(calls[1]?.body).toMatchObject({
      input: { text: 'Hello from instant custom voice.' },
      voice: {
        language_code: 'en-US',
        voice_clone: {
          voice_cloning_key: 'generated-key'
        }
      },
      audioConfig: {
        audioEncoding: 'LINEAR16',
        sampleRateHertz: 24000
      }
    })
  })

  test('Google Cloud instant custom voice accepts an existing key without generating or writing a key', async () => {
    const dir = await makeTempDir('autoshow-gcloud-icv-existing-')
    process.env['AUTOSHOW_GCLOUD_BIN'] = await writeFakeReadyGcloud(dir)
    process.env['GCLOUD_TTS_BASE_URL'] = 'https://mock.gcloud.local'
    const audioBase64 = createMockWavBase64()
    const calls: Array<{ url: string, body: Record<string, unknown> }> = []

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const url = String(input)
      calls.push({
        url,
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      })
      return Response.json({ audioContent: audioBase64 })
    }) as typeof fetch

    await runGcloudTts('Existing key synthesis.', dir, {
      model: 'instant-custom-voice',
      language: 'en-US',
      voiceCloningKey: 'existing-key'
    })

    expect(calls.map((call) => call.url)).toEqual(['https://mock.gcloud.local/v1beta1/text:synthesize'])
    expect(calls[0]?.body).toMatchObject({
      voice: {
        voice_clone: {
          voice_cloning_key: 'existing-key'
        }
      }
    })
  })

  test('Google Cloud instant custom voice validates audio files before key generation', async () => {
    const dir = await makeTempDir('autoshow-gcloud-icv-invalid-')
    const emptyAudio = join(dir, 'empty.mp3')
    await writeFile(emptyAudio, '')
    process.env['AUTOSHOW_GCLOUD_BIN'] = await writeFakeReadyGcloud(dir)
    process.env['GCLOUD_TTS_BASE_URL'] = 'https://mock.gcloud.local'
    const calls: string[] = []
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
      calls.push(String(input))
      return Response.json({ voiceCloningKey: 'unexpected' })
    }) as typeof fetch

    await expect(runGcloudTts('Invalid audio.', dir, {
      model: 'instant-custom-voice',
      refAudioPath: emptyAudio,
      consentAudioPath: 'input/examples/audio/0-audio-short.mp3',
      consentLanguage: 'en-US'
    })).rejects.toThrow('reference audio file is empty')
    expect(calls).toHaveLength(0)
  })

  test('UTF-8 byte chunking respects multi-byte characters and hard byte limits', () => {
    const chunks = splitTextIntoUtf8ByteChunks(`${'é'.repeat(6)} ${'🙂'.repeat(3)}`, 12)

    expect(chunks.every((chunk) => Buffer.byteLength(chunk, 'utf8') <= 12)).toBe(true)
    expect(chunks.join('')).toBe(`${'é'.repeat(6)}${'🙂'.repeat(3)}`)
  })
})
