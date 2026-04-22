import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { runSupadataStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/supadata/run-supadata-stt'
import { readProviderCheckpointMetadata, writeProviderCheckpointFixture } from '../../test-utils/manifest-helpers'
import {
  createTempOutputTracker,
  installNoopSleep,
  restoreSleep,
  snapshotEnv
} from '../../test-utils/stt-runtime-helpers'

const originalFetch = globalThis.fetch
const originalBunSleep = Bun.sleep
const restoreEnv = snapshotEnv([
  'SUPADATA_API_KEY',
  'SUPADATA_BASE_URL'
] as const)
const tempOutput = createTempOutputTracker()

beforeEach(() => {
  installNoopSleep()
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  restoreSleep(originalBunSleep)
  restoreEnv()
  await tempOutput.cleanup()
})

describe('runSupadataStt', () => {
  test('normalizes immediate chunked transcripts from supported social URLs', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-supadata-stt-')
    process.env['SUPADATA_API_KEY'] = 'test-key'
    process.env['SUPADATA_BASE_URL'] = 'https://supadata.test'

    let requestUrl: URL | undefined
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      requestUrl = new URL(String(input))
      expect(init?.method ?? 'GET').toBe('GET')
      expect((init?.headers as Record<string, string>)['x-api-key']).toBe('test-key')
      return new Response(JSON.stringify({
        content: [
          { text: 'Hello world', offset: 0, duration: 1200, lang: 'en' }
        ],
        lang: 'en',
        availableLangs: ['en']
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-billable-requests': '1'
        }
      })
    }) as unknown as typeof fetch

    const { result, metadata } = await runSupadataStt(audioPath, outputDir, {
      model: 'native',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123',
      language: 'en',
      segmentOffsetMinutes: 1
    })

    expect(requestUrl?.pathname).toBe('/transcript')
    expect(requestUrl?.searchParams.get('url')).toBe('https://www.youtube.com/watch?v=abc123')
    expect(requestUrl?.searchParams.get('text')).toBe('false')
    expect(requestUrl?.searchParams.get('mode')).toBe('native')
    expect(requestUrl?.searchParams.get('lang')).toBe('en')
    expect(result.text).toBe('Hello world')
    expect(result.segments[0]).toEqual({
      start: '00:01:00',
      end: '00:01:01',
      text: 'Hello world'
    })
    expect(result.evidence?.timingQuality).toBe('coarse')
    expect(result.evidence?.rawResponse).toEqual({
      content: [
        { text: 'Hello world', offset: 0, duration: 1200, lang: 'en' }
      ],
      lang: 'en',
      availableLangs: ['en']
    })
    expect(metadata.transcriptionService).toBe('supadata')
    expect(metadata.transcriptionModel).toBe('native')
    expect(metadata.billing).toEqual({
      creditsUsed: 1,
      creditRateCents: 1,
      source: 'response-header'
    })

    const transcriptText = await Bun.file(`${outputDir}/transcription.txt`).text()
    expect(transcriptText).toContain('Hello world')
  })

  test('falls back to a single segment for immediate text-only transcripts and omits lang for generate mode', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-supadata-stt-')
    process.env['SUPADATA_API_KEY'] = 'test-key'
    process.env['SUPADATA_BASE_URL'] = 'https://supadata.test'

    let requestUrl: URL | undefined
    globalThis.fetch = (async (input: string | URL | Request) => {
      requestUrl = new URL(String(input))
      return new Response(JSON.stringify({
        content: 'Generated transcript only'
      }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-billable-requests': '3'
        }
      })
    }) as unknown as typeof fetch

    const { result, metadata } = await runSupadataStt(audioPath, outputDir, {
      model: 'generate',
      sourceUrl: 'https://cdn.example.com/audio.mp3',
      language: 'en',
      segmentOffsetMinutes: 0
    })

    expect(requestUrl?.searchParams.get('mode')).toBe('generate')
    expect(requestUrl?.searchParams.has('lang')).toBe(false)
    expect(result.text).toBe('Generated transcript only')
    expect(result.segments).toEqual([
      {
        start: '00:00:00',
        end: '00:00:00',
        text: 'Generated transcript only'
      }
    ])
    expect(metadata.billing).toEqual({
      creditsUsed: 3,
      creditRateCents: 1,
      source: 'response-header'
    })
  })

  test('creates an async job, polls it to completion, and persists completed runtime metadata', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-supadata-stt-')
    process.env['SUPADATA_API_KEY'] = 'test-key'
    process.env['SUPADATA_BASE_URL'] = 'https://supadata.test'

    let createAttempts = 0
    let pollAttempts = 0
    let jobReadyRuntime: Record<string, unknown> | undefined

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      const method = init?.method ?? 'GET'

      if (url.pathname === '/transcript' && method === 'GET') {
        createAttempts += 1
        return new Response(JSON.stringify({ jobId: 'job-123' }), {
          status: 202,
          headers: {
            'content-type': 'application/json',
            'x-billable-requests': '4'
          }
        })
      }

      if (url.pathname === '/transcript/job-123' && method === 'GET') {
        pollAttempts += 1
        return new Response(JSON.stringify(
          pollAttempts === 1
            ? { status: 'queued' }
            : {
                status: 'completed',
                content: [
                  { text: 'Async transcript', offset: 0, duration: 900 }
                ],
                lang: 'en',
                availableLangs: ['en']
              }
        ), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'retry-after': '0'
          }
        })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runSupadataStt(audioPath, outputDir, {
      model: 'auto',
      sourceUrl: 'https://x.com/example/status/1',
      segmentOffsetMinutes: 0,
      audioDurationSeconds: 30,
      lifecycle: {
        onJobReady: async (runtime) => {
          jobReadyRuntime = runtime as unknown as Record<string, unknown>
        }
      }
    })

    expect(createAttempts).toBe(1)
    expect(pollAttempts).toBe(2)
    expect(jobReadyRuntime).toEqual(expect.objectContaining({
      mode: 'fresh',
      stage: 'created',
      remoteJobId: 'job-123'
    }))
    expect(result.text).toBe('Async transcript')
    expect(metadata.runtime).toEqual(expect.objectContaining({
      mode: 'fresh',
      stage: 'completed',
      remoteJobId: 'job-123'
    }))
    expect(metadata.billing).toEqual({
      creditsUsed: 4,
      creditRateCents: 1,
      source: 'response-header'
    })

    const checkpoint = await readProviderCheckpointMetadata(outputDir)
    expect(checkpoint['runtime']).toEqual(expect.objectContaining({
      mode: 'fresh',
      stage: 'completed',
      remoteJobId: 'job-123'
    }))
    expect(checkpoint['billing']).toEqual({
      creditsUsed: 4,
      creditRateCents: 1,
      source: 'response-header'
    })
  })

  test('reuses a persisted Supadata job on backfill instead of creating a new one', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-supadata-stt-')
    process.env['SUPADATA_API_KEY'] = 'test-key'
    process.env['SUPADATA_BASE_URL'] = 'https://supadata.test'

    await writeProviderCheckpointFixture(outputDir, 'supadata', 'auto', {
      transcriptionService: 'supadata',
      transcriptionModel: 'auto',
      processingTime: 10,
      tokenCount: 0,
      billing: {
        creditsUsed: 4,
        creditRateCents: 1,
        source: 'response-header'
      },
      runtime: {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: 'job-existing',
        createCompletedAt: '2026-04-22T00:00:00.000Z'
      }
    })

    let createAttempts = 0
    let pollAttempts = 0
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      const method = init?.method ?? 'GET'

      if (url.pathname === '/transcript' && method === 'GET') {
        createAttempts += 1
        throw new Error('unexpected create')
      }

      if (url.pathname === '/transcript/job-existing' && method === 'GET') {
        pollAttempts += 1
        return new Response(JSON.stringify({
          status: 'completed',
          content: 'Resumed transcript'
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runSupadataStt(audioPath, outputDir, {
      model: 'auto',
      sourceUrl: 'https://www.youtube.com/watch?v=resume123',
      segmentOffsetMinutes: 0,
      runMode: 'backfill'
    })

    expect(createAttempts).toBe(0)
    expect(pollAttempts).toBe(1)
    expect(result.text).toBe('Resumed transcript')
    expect(metadata.runtime).toEqual(expect.objectContaining({
      mode: 'resumed',
      stage: 'completed',
      remoteJobId: 'job-existing'
    }))
    expect(metadata.billing).toEqual({
      creditsUsed: 4,
      creditRateCents: 1,
      source: 'response-header'
    })
  })

  test('skips unsupported local or non-supported URLs before making a request', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-supadata-stt-')
    process.env['SUPADATA_API_KEY'] = 'test-key'
    process.env['SUPADATA_BASE_URL'] = 'https://supadata.test'

    let fetchCalls = 0
    globalThis.fetch = (async () => {
      fetchCalls += 1
      throw new Error('unexpected fetch')
    }) as unknown as typeof fetch

    await expect(runSupadataStt(audioPath, outputDir, {
      model: 'auto',
      segmentOffsetMinutes: 0
    })).rejects.toMatchObject({
      stage: 'create',
      retryable: false,
      skipped: true
    })

    await expect(runSupadataStt(audioPath, outputDir, {
      model: 'auto',
      sourceUrl: 'https://example.com/article',
      segmentOffsetMinutes: 0
    })).rejects.toMatchObject({
      stage: 'create',
      retryable: false,
      skipped: true
    })

    expect(fetchCalls).toBe(0)
  })

  test('treats transcript-unavailable responses as non-retryable provider failures', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-supadata-stt-')
    process.env['SUPADATA_API_KEY'] = 'test-key'
    process.env['SUPADATA_BASE_URL'] = 'https://supadata.test'

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({
        message: 'Transcript unavailable'
      }), {
        status: 206,
        headers: { 'content-type': 'application/json' }
      })
    }) as unknown as typeof fetch

    await expect(runSupadataStt(audioPath, outputDir, {
      model: 'native',
      sourceUrl: 'https://www.youtube.com/watch?v=no-native',
      segmentOffsetMinutes: 0
    })).rejects.toMatchObject({
      message: 'Supadata transcript unavailable (206): Transcript unavailable',
      stage: 'create',
      status: 206,
      retryable: false,
      rawResponse: { message: 'Transcript unavailable' }
    })
  })
})
