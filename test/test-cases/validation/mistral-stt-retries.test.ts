import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runMistralStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/mistral/run-mistral-stt'

const originalFetch = globalThis.fetch
const originalMistralApiKey = process.env['MISTRAL_API_KEY']
const originalMistralBaseUrl = process.env['MISTRAL_BASE_URL']
const tempDirs: string[] = []

const readFetchRequest = (input: string | URL | Request, init?: RequestInit): { url: string, method: string } => ({
  url: input instanceof Request ? input.url : String(input),
  method: input instanceof Request ? input.method : init?.method ?? 'GET'
})

const createAudioFixture = async (): Promise<{ audioPath: string, outputDir: string }> => {
  const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-mistral-stt-'))
  tempDirs.push(outputDir)

  const audioPath = join(outputDir, 'sample.wav')
  await Bun.write(audioPath, new Uint8Array(2048).fill(1))

  return { audioPath, outputDir }
}

afterEach(async () => {
  globalThis.fetch = originalFetch

  if (originalMistralApiKey === undefined) {
    delete process.env['MISTRAL_API_KEY']
  } else {
    process.env['MISTRAL_API_KEY'] = originalMistralApiKey
  }

  if (originalMistralBaseUrl === undefined) {
    delete process.env['MISTRAL_BASE_URL']
  } else {
    process.env['MISTRAL_BASE_URL'] = originalMistralBaseUrl
  }

  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('runMistralStt', () => {
  test('retries a transient 502 response and succeeds on the next attempt', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['MISTRAL_API_KEY'] = 'test-key'
    process.env['MISTRAL_BASE_URL'] = 'https://mistral.test/v1'

    let attempts = 0
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      attempts += 1
      const { url, method } = readFetchRequest(input, init)
      expect(url).toBe('https://mistral.test/v1/audio/transcriptions')
      expect(method).toBe('POST')

      if (attempts === 1) {
        return new Response('<html><body>bad gateway</body></html>', {
          status: 502,
          headers: { 'retry-after': '0' }
        })
      }

      return new Response(JSON.stringify({
        model: 'voxtral-mini-2602',
        text: 'Hello world',
        language: null,
        usage: {},
        segments: [
          {
            start: 0,
            end: 1.2,
            text: 'Hello world',
            speaker_id: 'speaker_1'
          }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    const { result, metadata } = await runMistralStt(audioPath, outputDir, {
      model: 'voxtral-mini-2602',
      segmentOffsetMinutes: 0
    })

    expect(attempts).toBe(2)
    expect(result).toMatchObject({
      text: 'Hello world',
      segments: [
        {
          start: '00:00:00',
          end: '00:00:01',
          text: 'Hello world',
          speaker: 'speaker_1'
        }
      ]
    })
    expect(result.evidence?.timingQuality).toBe('segment_interpolated')
    expect(metadata.transcriptionService).toBe('mistral')
    expect(metadata.transcriptionModel).toBe('voxtral-mini-2602')

    const transcript = await Bun.file(join(outputDir, 'transcription.txt')).text()
    expect(transcript).toBe('[00:00:00] [speaker_1] Hello world')
  })

  test('does not retry non-retryable 4xx responses', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['MISTRAL_API_KEY'] = 'test-key'
    process.env['MISTRAL_BASE_URL'] = 'https://mistral.test/v1'

    let attempts = 0
    globalThis.fetch = (async (_input?: string | URL | Request, _init?: RequestInit) => {
      attempts += 1
      return new Response(JSON.stringify({ error: 'bad request' }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    await expect(runMistralStt(audioPath, outputDir, {
      model: 'voxtral-mini-2602',
      segmentOffsetMinutes: 0
    })).rejects.toThrow('Mistral transcription failed (400)')

    expect(attempts).toBe(1)
  })
})
