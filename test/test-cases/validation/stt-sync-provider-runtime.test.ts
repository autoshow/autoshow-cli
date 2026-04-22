import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { runDeepgramTranscribe } from '~/cli/commands/process-steps/step-2-stt/stt-services/deepgram/run-deepgram-stt'
import { runDeepinfraTranscribe } from '~/cli/commands/process-steps/step-2-stt/stt-services/deepinfra/run-deepinfra-stt'
import { runElevenLabsTranscribe } from '~/cli/commands/process-steps/step-2-stt/stt-services/elevenlabs/run-elevenlabs-stt'
import { createMistralSttPassController } from '~/cli/commands/process-steps/step-2-stt/stt-services/mistral/mistral-stt-pass-controller'
import { runMistralStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/mistral/run-mistral-stt'
import {
  createTempOutputTracker,
  installNoopSleep,
  restoreSleep,
  snapshotEnv
} from '../../test-utils/stt-runtime-helpers'

const originalFetch = globalThis.fetch
const originalBunSleep = Bun.sleep
const restoreEnv = snapshotEnv([
  'DEEPGRAM_API_KEY',
  'DEEPGRAM_BASE_URL',
  'DEEPINFRA_API_KEY',
  'DEEPINFRA_BASE_URL',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_BASE_URL',
  'MISTRAL_API_KEY',
  'MISTRAL_BASE_URL'
] as const)
const tempOutput = createTempOutputTracker()

const readFetchRequest = (input: string | URL | Request, init?: RequestInit): { url: string, method: string } => ({
  url: input instanceof Request ? input.url : String(input),
  method: input instanceof Request ? input.method : init?.method ?? 'GET'
})

const waitForCondition = async (
  predicate: () => boolean,
  timeoutMs = 2_000
): Promise<void> => {
  const startedAt = Date.now()
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error('Timed out waiting for test condition')
    }
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

beforeEach(() => {
  installNoopSleep()
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  restoreSleep(originalBunSleep)
  restoreEnv()
  await tempOutput.cleanup()
})

describe('runDeepgramTranscribe', () => {
  test('retries transient 429 and 502 failures, then normalizes diarized utterances', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-deepgram-stt-')
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
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-deepgram-stt-')
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
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-deepgram-stt-')
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
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-deepgram-stt-')
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

describe('runDeepinfraTranscribe', () => {
  test('normalizes legacy /openai base URLs to the documented transcription endpoint, preserves openai/ model ids, and writes timestamped segments', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-deepinfra-stt-')
    process.env['DEEPINFRA_API_KEY'] = 'test-token'
    process.env['DEEPINFRA_BASE_URL'] = 'https://deepinfra.test/v1/openai'

    let attempts = 0
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      attempts += 1
      const { url, method } = readFetchRequest(input, init)
      expect(url).toBe('https://deepinfra.test/v1/audio/transcriptions')
      expect(method).toBe('POST')

      const body = init?.body
      expect(body).toBeInstanceOf(FormData)
      expect((body as FormData).get('model')).toBe('openai/whisper-large-v3-turbo')
      expect((body as FormData).get('response_format')).toBe('verbose_json')
      expect((body as FormData).get('timestamp_granularities[]')).toBe('segment')

      return new Response(JSON.stringify({
        text: 'Hello from DeepInfra',
        segments: [
          {
            start: 0.2,
            end: 1.8,
            text: 'Hello from DeepInfra'
          }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    const { result, metadata } = await runDeepinfraTranscribe(audioPath, outputDir, {
      model: 'openai/whisper-large-v3-turbo',
      segmentOffsetMinutes: 1
    })

    expect(attempts).toBe(1)
    expect(result.text).toBe('Hello from DeepInfra')
    expect(result.segments).toEqual([
      {
        start: '00:01:00',
        end: '00:01:01',
        text: 'Hello from DeepInfra'
      }
    ])
    expect(result.evidence?.capabilities).toEqual({
      hasNativeWordTiming: false,
      hasConfidence: false,
      hasSpeakerLabels: false
    })
    expect(result.evidence?.timingQuality).toBe('segment_interpolated')
    expect(metadata.transcriptionService).toBe('deepinfra')
    expect(metadata.transcriptionModel).toBe('openai/whisper-large-v3-turbo')

    const transcript = await Bun.file(`${outputDir}/transcription.txt`).text()
    expect(transcript).toBe('[00:01:00] Hello from DeepInfra')
  })

  test('defaults to the documented DeepInfra transcription base URL when DEEPINFRA_BASE_URL is unset', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-deepinfra-stt-')
    process.env['DEEPINFRA_API_KEY'] = 'test-token'
    delete process.env['DEEPINFRA_BASE_URL']

    globalThis.fetch = (async (input: string | URL | Request) => {
      expect(String(input)).toBe('https://api.deepinfra.com/v1/audio/transcriptions')
      return new Response(JSON.stringify({ text: 'ok', segments: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    const { result } = await runDeepinfraTranscribe(audioPath, outputDir, {
      model: 'openai/whisper-large-v3',
      segmentOffsetMinutes: 0
    })

    expect(result.text).toBe('ok')
    expect(result.segments).toEqual([
      {
        start: '00:00:00',
        end: '00:00:00',
        text: 'ok'
      }
    ])
  })
})

describe('runElevenLabsTranscribe', () => {
  test('retries a transient 502 response and succeeds on the next attempt with diarization enabled by default', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-elevenlabs-stt-')
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

describe('runMistralStt', () => {
  test('retries a transient 502 response and succeeds on the next attempt', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-mistral-stt-')
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

    const transcript = await Bun.file(`${outputDir}/transcription.txt`).text()
    expect(transcript).toBe('[00:00:00] [speaker_1] Hello world')
  })

  test('honors Retry-After on 429 responses before retrying', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-mistral-stt-')
    process.env['MISTRAL_API_KEY'] = 'test-key'
    process.env['MISTRAL_BASE_URL'] = 'https://mistral.test/v1'

    let attempts = 0
    const sleepCalls: number[] = []
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async (delayMs: number) => {
      sleepCalls.push(delayMs)
    }) as typeof Bun.sleep

    globalThis.fetch = (async () => {
      attempts += 1
      if (attempts === 1) {
        return new Response('rate limited', {
          status: 429,
          headers: { 'retry-after': '7' }
        })
      }

      return new Response(JSON.stringify({
        model: 'voxtral-mini-2602',
        text: 'Recovered after retry-after',
        language: null,
        usage: {},
        segments: [
          {
            start: 0,
            end: 1,
            text: 'Recovered after retry-after',
            speaker_id: 'speaker_1'
          }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    const { result } = await runMistralStt(audioPath, outputDir, {
      model: 'voxtral-mini-2602',
      segmentOffsetMinutes: 0
    })

    expect(attempts).toBe(2)
    expect(sleepCalls).toContain(7_000)
    expect(result.text).toBe('Recovered after retry-after')
  })

  test('uses the fallback cooldown when 429 omits Retry-After', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-mistral-stt-')
    process.env['MISTRAL_API_KEY'] = 'test-key'
    process.env['MISTRAL_BASE_URL'] = 'https://mistral.test/v1'

    let attempts = 0
    const sleepCalls: number[] = []
    ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async (delayMs: number) => {
      sleepCalls.push(delayMs)
    }) as typeof Bun.sleep

    globalThis.fetch = (async () => {
      attempts += 1
      if (attempts === 1) {
        return new Response('rate limited', {
          status: 429
        })
      }

      return new Response(JSON.stringify({
        model: 'voxtral-mini-2602',
        text: 'Recovered after fallback cooldown',
        language: null,
        usage: {},
        segments: [
          {
            start: 0,
            end: 1,
            text: 'Recovered after fallback cooldown',
            speaker_id: 'speaker_1'
          }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    const { result } = await runMistralStt(audioPath, outputDir, {
      model: 'voxtral-mini-2602',
      segmentOffsetMinutes: 0
    })

    expect(attempts).toBe(2)
    expect(sleepCalls).toContain(60_000)
    expect(result.text).toBe('Recovered after fallback cooldown')
  })

  test('serializes concurrent requests that share a pass controller', async () => {
    const firstFixture = await tempOutput.createAudioFixture('autoshow-mistral-stt-')
    const secondFixture = await tempOutput.createAudioFixture('autoshow-mistral-stt-')
    process.env['MISTRAL_API_KEY'] = 'test-key'
    process.env['MISTRAL_BASE_URL'] = 'https://mistral.test/v1'

    let attempts = 0
    let activeRequests = 0
    let maxActiveRequests = 0
    let releaseFirstRequest!: () => void
    const firstRequestReleased = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve
    })

    globalThis.fetch = (async () => {
      attempts += 1
      activeRequests += 1
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
      const currentAttempt = attempts

      if (currentAttempt === 1) {
        await firstRequestReleased
      }

      activeRequests -= 1
      return new Response(JSON.stringify({
        model: 'voxtral-mini-2602',
        text: `Concurrent transcript ${currentAttempt}`,
        language: null,
        usage: {},
        segments: [
          {
            start: 0,
            end: 1,
            text: `Concurrent transcript ${currentAttempt}`,
            speaker_id: 'speaker_1'
          }
        ]
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    const passController = createMistralSttPassController()
    const firstRun = runMistralStt(firstFixture.audioPath, firstFixture.outputDir, {
      model: 'voxtral-mini-2602',
      segmentOffsetMinutes: 0,
      passController
    })
    const secondRun = runMistralStt(secondFixture.audioPath, secondFixture.outputDir, {
      model: 'voxtral-mini-2602',
      segmentOffsetMinutes: 0,
      passController
    })

    await waitForCondition(() => attempts === 1 && activeRequests === 1)
    expect(maxActiveRequests).toBe(1)

    releaseFirstRequest()
    await Promise.all([firstRun, secondRun])

    expect(attempts).toBe(2)
    expect(maxActiveRequests).toBe(1)
  })

  test('does not retry non-retryable 4xx responses', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-mistral-stt-')
    process.env['MISTRAL_API_KEY'] = 'test-key'
    process.env['MISTRAL_BASE_URL'] = 'https://mistral.test/v1'

    let attempts = 0
    globalThis.fetch = (async () => {
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
