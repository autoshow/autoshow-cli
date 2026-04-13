import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runElevenLabsTranscribe } from '~/cli/commands/process-steps/step-2-stt/stt-services/elevenlabs/run-elevenlabs-stt'

const originalFetch = globalThis.fetch
const originalApiKey = process.env['ELEVENLABS_API_KEY']
const originalBaseUrl = process.env['ELEVENLABS_BASE_URL']
const tempDirs: string[] = []

const createAudioFixture = async (): Promise<{ audioPath: string, outputDir: string }> => {
  const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-elevenlabs-stt-'))
  tempDirs.push(outputDir)

  const audioPath = join(outputDir, 'sample.wav')
  await Bun.write(audioPath, new Uint8Array(2048).fill(1))

  return { audioPath, outputDir }
}

afterEach(async () => {
  globalThis.fetch = originalFetch

  if (originalApiKey === undefined) {
    delete process.env['ELEVENLABS_API_KEY']
  } else {
    process.env['ELEVENLABS_API_KEY'] = originalApiKey
  }

  if (originalBaseUrl === undefined) {
    delete process.env['ELEVENLABS_BASE_URL']
  } else {
    process.env['ELEVENLABS_BASE_URL'] = originalBaseUrl
  }

  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('runElevenLabsTranscribe', () => {
  test('retries a transient 502 response and succeeds on the next attempt with diarization enabled by default', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['ELEVENLABS_API_KEY'] = 'test-key'
    process.env['ELEVENLABS_BASE_URL'] = 'https://elevenlabs.test/v1'

    let attempts = 0
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      attempts += 1
      expect(input).toBe('https://elevenlabs.test/v1/speech-to-text')
      const body = init?.body
      expect(body).toBeInstanceOf(FormData)
      expect((body as FormData).get('diarize')).toBe('true')
      expect((body as FormData).get('num_speakers')).toBeNull()

      if (attempts === 1) {
        return new Response('bad gateway', {
          status: 502,
          headers: { 'retry-after': '0' }
        })
      }

      return new Response(JSON.stringify({
        text: 'Hello world',
        words: [
          {
            text: 'Hello',
            start: 0,
            end: 0.4,
            speaker_id: 1
          },
          {
            text: 'world',
            start: 0.4,
            end: 0.9,
            speaker_id: 1
          }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    const { result, metadata } = await runElevenLabsTranscribe(audioPath, outputDir, {
      model: 'scribe_v2',
      segmentOffsetMinutes: 0,
      diarizationOptions: { enabled: true }
    })

    expect(attempts).toBe(2)
    expect(result.text).toBe('Hello world')
    expect(result.segments).toEqual([
      {
        start: '00:00:00',
        end: '00:00:00',
        text: 'Hello world',
        speaker: 'speaker-1'
      }
    ])
    expect(metadata.transcriptionService).toBe('elevenlabs')
    expect(metadata.transcriptionModel).toBe('scribe_v2')
  })
})
