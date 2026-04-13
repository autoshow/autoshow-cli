import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runDeepgramTranscribe } from '~/cli/commands/process-steps/step-2-stt/stt-services/deepgram/run-deepgram-stt'

const originalFetch = globalThis.fetch
const originalApiKey = process.env['DEEPGRAM_API_KEY']
const originalBaseUrl = process.env['DEEPGRAM_BASE_URL']
const tempDirs: string[] = []

const createAudioFixture = async (): Promise<{ audioPath: string, outputDir: string }> => {
  const outputDir = await mkdtemp(join(tmpdir(), 'autoshow-deepgram-stt-'))
  tempDirs.push(outputDir)

  const audioPath = join(outputDir, 'sample.wav')
  await Bun.write(audioPath, new Uint8Array(2048).fill(1))

  return { audioPath, outputDir }
}

afterEach(async () => {
  globalThis.fetch = originalFetch

  if (originalApiKey === undefined) {
    delete process.env['DEEPGRAM_API_KEY']
  } else {
    process.env['DEEPGRAM_API_KEY'] = originalApiKey
  }

  if (originalBaseUrl === undefined) {
    delete process.env['DEEPGRAM_BASE_URL']
  } else {
    process.env['DEEPGRAM_BASE_URL'] = originalBaseUrl
  }

  await Promise.all(tempDirs.splice(0).map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

describe('runDeepgramTranscribe', () => {
  test('retries transient 429 and 502 failures, then normalizes diarized utterances', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['DEEPGRAM_API_KEY'] = 'test-key'
    process.env['DEEPGRAM_BASE_URL'] = 'https://deepgram.test'

    let attempts = 0
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input)
      expect(url).toContain('/v1/listen?')

      attempts += 1
      if (attempts === 1) {
        return new Response('rate limited', {
          status: 429,
          headers: { 'retry-after': '0' }
        })
      }

      if (attempts === 2) {
        return new Response('bad gateway', {
          status: 502,
          headers: { 'retry-after': '0' }
        })
      }

      return new Response(JSON.stringify({
        results: {
          channels: [{
            alternatives: [{
              transcript: 'Hello there. General Kenobi.'
            }]
          }],
          utterances: [
            { start: 0, end: 1.2, transcript: 'Hello there.', speaker: 0 },
            { start: 1.3, end: 2.5, transcript: 'General Kenobi.', speaker: 1 }
          ]
        }
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    const { result, metadata } = await runDeepgramTranscribe(audioPath, outputDir, {
      model: 'nova-3',
      segmentOffsetMinutes: 0
    })

    expect(attempts).toBe(3)
    expect(result.text).toBe('Hello there. General Kenobi.')
    expect(result.segments.map((segment) => segment.speaker)).toEqual(['speaker-0', 'speaker-1'])
    expect(metadata.transcriptionService).toBe('deepgram')
    expect(metadata.transcriptionModel).toBe('nova-3')

    const transcript = await Bun.file(`${outputDir}/transcription.txt`).text()
    expect(transcript).toContain('[speaker-0] Hello there.')
    expect(transcript).toContain('[speaker-1] General Kenobi.')
  })

  test('fails immediately on non-retryable 400 errors', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['DEEPGRAM_API_KEY'] = 'test-key'
    process.env['DEEPGRAM_BASE_URL'] = 'https://deepgram.test'

    let attempts = 0
    globalThis.fetch = (async () => {
      attempts += 1
      return new Response('bad request', {
        status: 400,
        headers: { 'content-type': 'text/plain' }
      })
    }) as unknown as typeof fetch

    await expect(runDeepgramTranscribe(audioPath, outputDir, {
      model: 'nova-3',
      segmentOffsetMinutes: 0
    })).rejects.toThrow('Deepgram transcription failed (400): bad request')

    expect(attempts).toBe(1)
  })

  test('falls back to word timings when utterances are missing', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['DEEPGRAM_API_KEY'] = 'test-key'
    process.env['DEEPGRAM_BASE_URL'] = 'https://deepgram.test'

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        results: {
          channels: [{
            alternatives: [{
              transcript: 'hello world.',
              words: [
                { word: 'hello', punctuated_word: 'hello', start: 0, end: 0.5, speaker: 2 },
                { word: 'world', punctuated_word: 'world.', start: 0.6, end: 1.0, speaker: 2 }
              ]
            }]
          }]
        }
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    const { result } = await runDeepgramTranscribe(audioPath, outputDir, {
      model: 'nova-3',
      segmentOffsetMinutes: 0
    })

    expect(result.text).toBe('hello world.')
    expect(result.segments).toHaveLength(1)
    expect(result.segments[0]?.speaker).toBe('speaker-2')
    expect(result.segments[0]?.text).toContain('hello')
  })

  test('falls back to plain transcript text when utterances and words are missing', async () => {
    const { audioPath, outputDir } = await createAudioFixture()
    process.env['DEEPGRAM_API_KEY'] = 'test-key'
    process.env['DEEPGRAM_BASE_URL'] = 'https://deepgram.test'

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        results: {
          channels: [{
            alternatives: [{
              transcript: 'plain transcript only'
            }]
          }]
        }
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    const { result } = await runDeepgramTranscribe(audioPath, outputDir, {
      model: 'nova-3',
      segmentOffsetMinutes: 1
    })

    expect(result.text).toBe('plain transcript only')
    expect(result.segments).toEqual([
      {
        start: '00:01:00',
        end: '00:01:00',
        text: 'plain transcript only'
      }
    ])
  })
})
