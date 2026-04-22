import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { buildOptsFromFlags } from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import { runHappyScribeStt } from '~/cli/commands/process-steps/step-2-stt/stt-services/happyscribe/run-happyscribe-stt'
import { resolveHappyScribeOrganizationSelection } from '~/cli/commands/process-steps/step-2-stt/stt-services/happyscribe/happyscribe'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { computeBilledSttCost } from '~/utils/pricing/stt-billing'
import { STABLE_LOCAL_AUDIO_PATH } from '../../test-utils/test-helpers'
import { readProviderCheckpointMetadata } from '../../test-utils/manifest-helpers'
import {
  createTempOutputTracker,
  installNoopSleep,
  restoreSleep,
  snapshotEnv
} from '../../test-utils/stt-runtime-helpers'

const originalFetch = globalThis.fetch
const originalBunSleep = Bun.sleep
const restoreEnv = snapshotEnv([
  'HAPPYSCRIBE_API_KEY',
  'HAPPYSCRIBE_BASE_URL',
  'HAPPYSCRIBE_ORGANIZATION_ID'
] as const)
const tempOutput = createTempOutputTracker()
const STRUCTURED_TRANSCRIPT_FIXTURE_URL = new URL('./fixtures/happyscribe-structured-transcript.json', import.meta.url)

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

describe('Happy Scribe organization selection', () => {
  test('prefers the CLI organization over the environment override', async () => {
    process.env['HAPPYSCRIBE_API_KEY'] = 'test-key'
    process.env['HAPPYSCRIBE_BASE_URL'] = 'https://happyscribe.test'
    process.env['HAPPYSCRIBE_ORGANIZATION_ID'] = 'org-env'

    let organizationLookups = 0
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input))
      expect(url.toString()).toBe('https://happyscribe.test/organizations')
      organizationLookups += 1

      return jsonResponse({
        organizations: [
          { id: 'org-cli', name: 'CLI Org', currency: 'usd' },
          { id: 'org-env', name: 'Env Org', currency: 'usd' }
        ]
      })
    }) as unknown as typeof fetch

    const cliSelection = await resolveHappyScribeOrganizationSelection({
      preferredOrganizationId: 'org-cli'
    })
    expect(cliSelection.selected?.id).toBe('org-cli')
    expect(cliSelection.source).toBe('option')

    const envSelection = await resolveHappyScribeOrganizationSelection()
    expect(envSelection.selected?.id).toBe('org-env')
    expect(envSelection.source).toBe('env')
    expect(organizationLookups).toBe(2)
  })
})

describe('Happy Scribe aggregate pricing', () => {
  test('keeps --price side-effect free and adds a generic estimate note when organization selection is ambiguous', async () => {
    process.env['HAPPYSCRIBE_API_KEY'] = 'test-key'
    process.env['HAPPYSCRIBE_BASE_URL'] = 'https://happyscribe.test'

    const requests: string[] = []
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      requests.push(`${init?.method ?? 'GET'} ${url.pathname}`)

      if (url.pathname === '/organizations') {
        return jsonResponse({
          organizations: [
            { id: 'org-1', name: 'One', currency: 'usd' },
            { id: 'org-2', name: 'Two', currency: 'usd' }
          ]
        })
      }

      throw new Error(`Unexpected fetch during pricing: ${init?.method ?? 'GET'} ${url}`)
    }) as unknown as typeof fetch

    const opts = buildOptsFromFlags(false, {
      'happyscribe-stt': 'auto'
    })
    const estimate = await buildAggregatedPriceEstimate('stt', STABLE_LOCAL_AUDIO_PATH, opts)
    const sttStep = estimate.steps.find((step) => step.step === 'stt')

    expect(requests).toEqual(['GET /organizations'])
    expect(sttStep?.provider).toBe('happyscribe')
    expect(sttStep?.model).toBe('auto')
    expect(sttStep?.note).toContain('published $0.20/min AI rate')
    expect(sttStep?.note).toContain('explicit organization')
    expect(sttStep?.note).toContain('Price output remains a generic estimate until execution')
    expect(estimate.notes).toContain(sttStep?.note as string)
    expect(sttStep?.totalCost).toBeCloseTo(
      computeBilledSttCost('happyscribe', 'auto', sttStep?.durationSeconds ?? 0).cost,
      8
    )
  })
})

describe('runHappyScribeStt', () => {
  test('fails fast when the selected organization is not billed in usd', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-happyscribe-stt-')
    process.env['HAPPYSCRIBE_API_KEY'] = 'test-key'
    process.env['HAPPYSCRIBE_BASE_URL'] = 'https://happyscribe.test'

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))

      if (url.pathname === '/organizations') {
        return jsonResponse({
          organizations: [
            { id: 'org-eur', name: 'Euro Org', currency: 'eur' }
          ]
        })
      }

      throw new Error(`Unexpected fetch after non-usd organization guard: ${init?.method ?? 'GET'} ${url}`)
    }) as unknown as typeof fetch

    await expect(runHappyScribeStt(audioPath, outputDir, {
      model: 'auto',
      segmentOffsetMinutes: 0,
      audioDurationSeconds: 90
    })).rejects.toThrow('currency eur')
  })

  test('uploads media, falls back to JSON export download, preserves speakers, and captures provider billing', async () => {
    const { audioPath, outputDir } = await tempOutput.createAudioFixture('autoshow-happyscribe-stt-')
    process.env['HAPPYSCRIBE_API_KEY'] = 'test-key'
    process.env['HAPPYSCRIBE_BASE_URL'] = 'https://happyscribe.test'

    const fixturePayload = await Bun.file(STRUCTURED_TRANSCRIPT_FIXTURE_URL).json()
    const requests: string[] = []

    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      const method = init?.method ?? 'GET'
      requests.push(`${method} ${url.toString()}`)

      if (url.toString() === 'https://happyscribe.test/organizations' && method === 'GET') {
        return jsonResponse({
          organizations: [
            { id: 'org-usd', name: 'USD Org', currency: 'usd' }
          ]
        })
      }

      if (url.origin === 'https://happyscribe.test' && url.pathname === '/uploads/new' && method === 'GET') {
        expect(url.searchParams.get('filename')).toBe('sample.wav')
        return jsonResponse({ signedUrl: 'https://uploads.test/upload-1' })
      }

      if (url.toString() === 'https://uploads.test/upload-1' && method === 'PUT') {
        return new Response(null, { status: 200 })
      }

      if (url.toString() === 'https://happyscribe.test/orders' && method === 'POST') {
        expect(JSON.parse(String(init?.body))).toEqual({
          order: {
            url: 'https://uploads.test/upload-1',
            language: 'en-US',
            service: 'auto',
            confirm: true,
            organization_id: 'org-usd',
            is_subtitle: false,
            name: 'sample.wav'
          }
        })

        return jsonResponse({
          id: 'order-123',
          state: 'submitted',
          outputsIds: ['tx-123'],
          transcriptions: [
            { id: 'tx-123', uuid: 'tx-123', state: 'submitted' }
          ]
        })
      }

      if (url.toString() === 'https://happyscribe.test/orders/order-123' && method === 'GET') {
        return jsonResponse({
          id: 'order-123',
          state: 'fulfilled',
          details: {
            total_cents: 34,
            total_credits: 170,
            currency: 'usd'
          },
          outputsIds: ['tx-123'],
          transcriptions: [
            { id: 'tx-123', uuid: 'tx-123', state: 'automatic_done' }
          ]
        }, {
          headers: { 'retry-after': '0' }
        })
      }

      if (url.toString() === 'https://happyscribe.test/transcriptions/tx-123' && method === 'GET') {
        return jsonResponse({
          id: 'tx-123',
          state: 'automatic_done',
          costInCents: 34,
          _links: {
            self: {
              downloadUrl: 'https://download.test/tx-123'
            }
          }
        })
      }

      if (url.toString() === 'https://download.test/tx-123' && method === 'GET') {
        return new Response('not-json', {
          status: 200,
          headers: { 'content-type': 'text/plain' }
        })
      }

      if (url.toString() === 'https://happyscribe.test/exports' && method === 'POST') {
        expect(JSON.parse(String(init?.body))).toEqual({
          export: {
            format: 'json',
            transcription_ids: ['tx-123']
          }
        })

        return jsonResponse({
          id: 'export-123',
          state: 'queued'
        })
      }

      if (url.toString() === 'https://happyscribe.test/exports/export-123' && method === 'GET') {
        return jsonResponse({
          id: 'export-123',
          state: 'ready',
          download_link: 'https://download.test/export-123'
        }, {
          headers: { 'retry-after': '0' }
        })
      }

      if (url.toString() === 'https://download.test/export-123' && method === 'GET') {
        return jsonResponse(fixturePayload)
      }

      throw new Error(`Unexpected fetch: ${method} ${url}`)
    }) as unknown as typeof fetch

    const { result, metadata } = await runHappyScribeStt(audioPath, outputDir, {
      model: 'auto',
      segmentOffsetMinutes: 0,
      audioDurationSeconds: 90
    })

    expect(requests).toEqual([
      'GET https://happyscribe.test/organizations',
      'GET https://happyscribe.test/uploads/new?filename=sample.wav',
      'PUT https://uploads.test/upload-1',
      'POST https://happyscribe.test/orders',
      'GET https://happyscribe.test/orders/order-123',
      'GET https://happyscribe.test/transcriptions/tx-123',
      'GET https://download.test/tx-123',
      'GET https://download.test/tx-123',
      'POST https://happyscribe.test/exports',
      'GET https://happyscribe.test/exports/export-123',
      'GET https://download.test/export-123'
    ])
    expect(result.text).toBe('Hello there. General Kenobi.')
    expect(result.segments).toEqual([
      {
        start: '00:00:00',
        end: '00:00:01',
        text: 'Hello there.',
        speaker: 'speaker-1'
      },
      {
        start: '00:00:02',
        end: '00:00:03',
        text: 'General Kenobi.',
        speaker: 'speaker-2'
      }
    ])
    expect(metadata.transcriptionService).toBe('happyscribe')
    expect(metadata.transcriptionModel).toBe('auto')
    expect(metadata.billing).toEqual(expect.objectContaining({
      totalCost: 34,
      creditsUsed: 170,
      source: 'provider_quote',
      mode: 'order'
    }))
    expect(metadata.billing?.creditRateCents).toBeCloseTo(0.2, 8)
    expect(metadata.runtime).toEqual(expect.objectContaining({
      mode: 'fresh',
      stage: 'completed',
      remoteJobId: 'order-123',
      remoteAssetUrl: 'https://uploads.test/upload-1'
    }))

    const checkpoint = await readProviderCheckpointMetadata(outputDir)
    expect(checkpoint['runtime']).toEqual(expect.objectContaining({
      mode: 'fresh',
      stage: 'completed',
      remoteJobId: 'order-123',
      remoteAssetUrl: 'https://uploads.test/upload-1'
    }))
    expect(checkpoint['billing']).toEqual(expect.objectContaining({
      totalCost: 34,
      creditsUsed: 170,
      source: 'provider_quote',
      mode: 'order'
    }))
    expect((checkpoint['billing'] as { creditRateCents?: number }).creditRateCents).toBeCloseTo(0.2, 8)

    const transcript = await Bun.file(`${outputDir}/transcription.txt`).text()
    expect(transcript).toContain('[speaker-1] Hello there.')
    expect(transcript).toContain('[speaker-2] General Kenobi.')
  })
})
