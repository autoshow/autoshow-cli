import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runDeapiStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/deapi/run-deapi-stt'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { computeBilledSttCost } from '~/utils/pricing/stt-billing'
import { getSttEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'
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
  'DEAPI_API_KEY',
  'DEAPI_BASE_URL'
] as const)
const tempOutput = createTempOutputTracker()

const jsonResponse = (
  payload: unknown,
  init?: { status?: number, headers?: Record<string, string> }
): Response => new Response(JSON.stringify(payload), {
  status: init?.status ?? 200,
  headers: {
    'content-type': 'application/json',
    ...(init?.headers ?? {})
  }
})

beforeEach(() => {
  installNoopSleep()
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  restoreSleep(originalBunSleep)
  restoreEnv()
  await tempOutput.cleanup()
})

describe('deAPI aggregate pricing', () => {
  test('returns an exact deAPI STT estimate when the price API succeeds', async () => {
    process.env['DEAPI_API_KEY'] = 'test-key'
    process.env['DEAPI_BASE_URL'] = 'https://deapi.test'

    let priceCalls = 0
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      expect(url).toBe('https://deapi.test/api/v1/client/transcribe/price-calculation')
      expect(init?.method).toBe('POST')

      const body = init?.body as FormData
      expect(body.get('include_ts')).toBe('true')
      expect(body.get('model')).toBe('WhisperLargeV3')
      expect(body.get('duration_seconds')).toBeTruthy()
      expect(body.get('source_url')).toBeNull()
      priceCalls += 1

      return jsonResponse({ data: { price: '0.0175' } })
    }) as unknown as typeof fetch

    const opts = buildOptsFromFlags(false, {
      'deapi-stt': 'WhisperLargeV3'
    })
    const estimate = await buildAggregatedPriceEstimate('stt', STABLE_LOCAL_AUDIO_PATH, opts)
    const sttStep = estimate.steps.find((step) => step.step === 'stt')

    expect(priceCalls).toBe(1)
    expect(sttStep).toMatchObject({
      step: 'stt',
      provider: 'deapi',
      model: 'WhisperLargeV3',
      estimateType: 'exact',
      costMultiplier: 1
    })
    expect(sttStep?.totalCost).toBeCloseTo(1.75, 8)
    expect(estimate.notes ?? []).toEqual([])
  })

  test('falls back to registry pricing with a warning when the deAPI price API fails', async () => {
    process.env['DEAPI_API_KEY'] = 'test-key'
    process.env['DEAPI_BASE_URL'] = 'https://deapi.test'

    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ message: 'rate limited' }), {
        status: 429,
        headers: {
          'content-type': 'application/json',
          'retry-after': '0.001'
        }
      })
    }) as unknown as typeof fetch

    const opts = buildOptsFromFlags(false, {
      'deapi-stt': 'WhisperLargeV3'
    })
    const estimate = await buildAggregatedPriceEstimate('stt', STABLE_LOCAL_AUDIO_PATH, opts)
    const sttStep = estimate.steps.find((step) => step.step === 'stt')

    expect(sttStep?.provider).toBe('deapi')
    expect(sttStep?.estimateType).toBe('heuristic')
    expect(sttStep?.costMultiplier).toBe(getSttEstimation('deapi', 'WhisperLargeV3').costMultiplier)
    expect(sttStep?.note).toContain('deAPI exact STT pricing failed')
    expect(estimate.notes).toContain(sttStep?.note as string)
    expect(sttStep?.totalCost).toBeCloseTo(
      computeBilledSttCost('deapi', 'WhisperLargeV3', sttStep?.durationSeconds ?? 0).cost,
      8
    )
  })
})

describe('runDeapiStt', () => {
  test('uses passthrough mode for supported URLs, parses inline structured results, and persists completed runtime metadata', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-deapi-stt-')
    process.env['DEAPI_API_KEY'] = 'test-key'
    process.env['DEAPI_BASE_URL'] = 'https://deapi.test'

    const requests: string[] = []
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      requests.push(`${init?.method ?? 'GET'} ${url.pathname}`)

      if (url.pathname === '/api/v1/client/transcribe/price-calculation') {
        const body = init?.body as FormData
        expect(body.get('source_url')).toBe('https://www.youtube.com/watch?v=abc123')
        expect(body.get('duration_seconds')).toBeNull()
        return jsonResponse({ data: { price: 0.0175 } })
      }

      if (url.pathname === '/api/v1/client/transcribe') {
        const body = init?.body as FormData
        expect(body.get('source_url')).toBe('https://www.youtube.com/watch?v=abc123')
        expect(body.get('return_result_in_response')).toBe('true')
        expect(body.get('audio')).toBeNull()
        return jsonResponse({ request_id: 'req-123' })
      }

      if (url.pathname === '/api/v1/client/request-status/req-123') {
        return jsonResponse({
          data: {
            status: 'completed',
            result: {
              segments: [
                { start: 0, end: 1.2, text: 'Hello from deAPI' }
              ],
              text: 'Hello from deAPI'
            }
          }
        }, {
          headers: { 'retry-after': '0' }
        })
      }

      throw new Error(`Unexpected fetch: ${(init?.method ?? 'GET')} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runDeapiStt(audioPath, outputDir, {
      model: 'WhisperLargeV3',
      sourceUrl: 'https://www.youtube.com/watch?v=abc123',
      segmentOffsetMinutes: 1,
      audioDurationSeconds: 75
    })

    expect(requests).toEqual([
      'POST /api/v1/client/transcribe/price-calculation',
      'POST /api/v1/client/transcribe',
      'GET /api/v1/client/request-status/req-123'
    ])
    expect(result.text).toBe('Hello from deAPI')
    expect(result.segments).toEqual([
      { start: '00:01:00', end: '00:01:01', text: 'Hello from deAPI' }
    ])
    expect(metadata.billing).toEqual(expect.objectContaining({
      source: 'provider_quote',
      mode: 'url'
    }))
    expect(metadata.billing?.totalCost).toBeCloseTo(1.75, 8)
    expect(metadata.runtime).toEqual(expect.objectContaining({
      mode: 'fresh',
      stage: 'completed',
      remoteJobId: 'req-123'
    }))

    const checkpoint = await readProviderCheckpointMetadata(outputDir)
    expect(checkpoint['runtime']).toEqual(expect.objectContaining({
      mode: 'fresh',
      stage: 'completed',
      remoteJobId: 'req-123'
    }))
    expect(checkpoint['billing']).toEqual(expect.objectContaining({
      source: 'provider_quote',
      mode: 'url'
    }))
    expect((checkpoint['billing'] as { totalCost?: number }).totalCost).toBeCloseTo(1.75, 8)
  })

  test('uses upload mode for unsupported URLs and parses inline JSON-string results', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-deapi-stt-')
    process.env['DEAPI_API_KEY'] = 'test-key'
    process.env['DEAPI_BASE_URL'] = 'https://deapi.test'

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))

      if (url.pathname === '/api/v1/client/transcribe/price-calculation') {
        const body = init?.body as FormData
        expect(body.get('source_url')).toBeNull()
        expect(body.get('duration_seconds')).toBe('30')
        return jsonResponse({ data: { price: 0.0125 } })
      }

      if (url.pathname === '/api/v1/client/audiofile2txt') {
        const body = init?.body as FormData
        expect(body.get('audio')).toBeTruthy()
        expect(body.get('source_url')).toBeNull()
        return jsonResponse({ data: { request_id: 'req-upload' } })
      }

      if (url.pathname === '/api/v1/client/request-status/req-upload') {
        return jsonResponse({
          status: 'completed',
          result: JSON.stringify({
            text: 'Uploaded transcript',
            segments: [
              { start: 0, end: 0.8, text: 'Uploaded transcript' }
            ]
          })
        }, {
          headers: { 'retry-after': '0' }
        })
      }

      throw new Error(`Unexpected fetch: ${(init?.method ?? 'GET')} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runDeapiStt(audioPath, outputDir, {
      model: 'WhisperLargeV3',
      sourceUrl: 'https://example.com/audio.mp3',
      segmentOffsetMinutes: 0,
      audioDurationSeconds: 30
    })

    expect(result.text).toBe('Uploaded transcript')
    expect(result.segments).toEqual([
      { start: '00:00:00', end: '00:00:00', text: 'Uploaded transcript' }
    ])
    expect(metadata.billing).toEqual({
      totalCost: 1.25,
      source: 'provider_quote',
      mode: 'duration'
    })
  })

  test('resolves result_url JSON payloads, including root segment arrays', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-deapi-stt-')
    process.env['DEAPI_API_KEY'] = 'test-key'
    process.env['DEAPI_BASE_URL'] = 'https://deapi.test'

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input))

      if (url.pathname === '/api/v1/client/transcribe/price-calculation') {
        return jsonResponse({ data: { price: 0.01 } })
      }

      if (url.pathname === '/api/v1/client/audiofile2txt') {
        return jsonResponse({ request_id: 'req-result-url' })
      }

      if (url.pathname === '/api/v1/client/request-status/req-result-url') {
        return jsonResponse({
          status: 'completed',
          result_url: 'https://files.deapi.test/result.json'
        }, {
          headers: { 'retry-after': '0' }
        })
      }

      if (url.href === 'https://files.deapi.test/result.json') {
        return jsonResponse([
          { start: 0, end: 1, text: 'Remote payload' }
        ])
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    const { result } = await runDeapiStt(audioPath, outputDir, {
      model: 'WhisperLargeV3',
      segmentOffsetMinutes: 0,
      audioDurationSeconds: 20
    })

    expect(result.text).toBe('Remote payload')
    expect(result.segments).toEqual([
      { start: '00:00:00', end: '00:00:01', text: 'Remote payload' }
    ])
  })

  test('falls back to coarse plain-text output when the completed payload has no structured transcript', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-deapi-stt-')
    process.env['DEAPI_API_KEY'] = 'test-key'
    process.env['DEAPI_BASE_URL'] = 'https://deapi.test'

    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input))

      if (url.pathname === '/api/v1/client/transcribe/price-calculation') {
        return jsonResponse({ data: { price: 0.009 } })
      }

      if (url.pathname === '/api/v1/client/audiofile2txt') {
        return jsonResponse({ request_id: 'req-plain-text' })
      }

      if (url.pathname === '/api/v1/client/request-status/req-plain-text') {
        return jsonResponse({
          status: 'completed',
          result: 'Plain transcript only'
        }, {
          headers: { 'retry-after': '0' }
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    const { result } = await runDeapiStt(audioPath, outputDir, {
      model: 'WhisperLargeV3',
      segmentOffsetMinutes: 0,
      audioDurationSeconds: 20
    })

    expect(result.text).toBe('Plain transcript only')
    expect(result.segments).toEqual([
      { start: '00:00:00', end: '00:00:00', text: 'Plain transcript only' }
    ])
    expect(result.evidence?.timingQuality).toBe('coarse')
  })

  test('resumes a persisted deAPI request without creating or repricing a new job', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-deapi-stt-')
    process.env['DEAPI_API_KEY'] = 'test-key'
    process.env['DEAPI_BASE_URL'] = 'https://deapi.test'

    await writeProviderCheckpointFixture(outputDir, 'deapi', 'WhisperLargeV3', {
      transcriptionService: 'deapi',
      transcriptionModel: 'WhisperLargeV3',
      processingTime: 10,
      tokenCount: 0,
      billing: {
        totalCost: 1.75,
        source: 'provider_quote',
        mode: 'url'
      },
      runtime: {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: 'req-existing',
        createCompletedAt: '2026-04-22T00:00:00.000Z'
      }
    })

    let createCalls = 0
    let priceCalls = 0
    let pollCalls = 0
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input))

      if (url.pathname === '/api/v1/client/transcribe/price-calculation') {
        priceCalls += 1
        throw new Error('unexpected price request')
      }

      if (url.pathname === '/api/v1/client/transcribe' || url.pathname === '/api/v1/client/audiofile2txt') {
        createCalls += 1
        throw new Error('unexpected create request')
      }

      if (url.pathname === '/api/v1/client/request-status/req-existing') {
        pollCalls += 1
        return jsonResponse({
          status: 'completed',
          result: {
            text: 'Resumed transcript',
            segments: [
              { start: 0, end: 1, text: 'Resumed transcript' }
            ]
          }
        }, {
          headers: { 'retry-after': '0' }
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runDeapiStt(audioPath, outputDir, {
      model: 'WhisperLargeV3',
      sourceUrl: 'https://www.youtube.com/watch?v=resume123',
      segmentOffsetMinutes: 0,
      runMode: 'backfill'
    })

    expect(priceCalls).toBe(0)
    expect(createCalls).toBe(0)
    expect(pollCalls).toBe(1)
    expect(result.text).toBe('Resumed transcript')
    expect(metadata.runtime).toEqual(expect.objectContaining({
      mode: 'resumed',
      stage: 'completed',
      remoteJobId: 'req-existing'
    }))
    expect(metadata.billing).toEqual({
      totalCost: 1.75,
      source: 'provider_quote',
      mode: 'url'
    })

    const checkpoint = await readProviderCheckpointMetadata(outputDir)
    expect(checkpoint['runtime']).toEqual(expect.objectContaining({
      mode: 'resumed',
      stage: 'completed',
      remoteJobId: 'req-existing'
    }))
  })
})
