import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { runMistralOcr } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/mistral-ocr/run-mistral-ocr'
import { runMistralStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/mistral/run-mistral-stt'
import type { DocumentMetadata } from '~/types'
import { mistralJsonRequest, normalizeMistralBaseUrl } from '~/utils/mistral/client'
import {
  clearEnv,
  createTempDirTracker,
  restoreEnv,
  snapshotEnv
} from '../../test-utils/rest-contract-helpers'

const originalFetch = globalThis.fetch
const tempDirs = createTempDirTracker('autoshow-mistral-rest-')
let previousEnv: Record<string, string | undefined> = {}
const envKeys = ['MISTRAL_API_KEY', 'MISTRAL_BASE_URL']

beforeEach(() => {
  previousEnv = snapshotEnv(envKeys)
  clearEnv(envKeys)
})

afterEach(async () => {
  restoreEnv(previousEnv)
  globalThis.fetch = originalFetch
  await tempDirs.cleanup()
})

describe('Mistral REST contracts', () => {
  test('base URL normalization accepts hosts with or without /v1', () => {
    expect(normalizeMistralBaseUrl('https://api.mistral.ai')).toBe('https://api.mistral.ai/v1')
    expect(normalizeMistralBaseUrl('https://api.mistral.ai/v1')).toBe('https://api.mistral.ai/v1')
    expect(normalizeMistralBaseUrl('https://mock.mistral.local/proxy/')).toBe('https://mock.mistral.local/proxy/v1')
  })

  test('STT sends documented multipart fields and parses segment responses', async () => {
    const dir = await tempDirs.make('autoshow-mistral-stt-rest-')
    const calls: Array<{
      url: string
      method: string
      authorization: string | null
      form: {
        model: unknown
        diarize: unknown
        timestampGranularities: unknown[]
        fileName: string | undefined
        fileSize: number | undefined
      }
    }> = []

    process.env['MISTRAL_API_KEY'] = 'mistral-key'
    process.env['MISTRAL_BASE_URL'] = 'https://mock.mistral.local'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const form = init?.body instanceof FormData ? init.body : undefined
      const file = form?.get('file')
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
        form: {
          model: form?.get('model') ?? null,
          diarize: form?.get('diarize') ?? null,
          timestampGranularities: form?.getAll('timestamp_granularities') ?? [],
          fileName: file instanceof File ? file.name : undefined,
          fileSize: file instanceof File ? file.size : undefined
        }
      })
      return Response.json({
        model: 'voxtral-mini-latest',
        text: 'Hello from Mistral.',
        language: 'en',
        segments: [
          { start: 1.2, end: 2.8, text: 'Hello from Mistral.', speaker_id: 'speaker-a' }
        ]
      })
    }) as typeof fetch

    const { result, metadata } = await runMistralStt('input/examples/audio/0-audio-short.mp3', dir, {
      model: 'voxtral-mini-latest',
      segmentOffsetMinutes: 1
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      url: 'https://mock.mistral.local/v1/audio/transcriptions',
      method: 'POST',
      authorization: 'Bearer mistral-key',
      form: {
        model: 'voxtral-mini-latest',
        diarize: 'true',
        timestampGranularities: ['segment'],
        fileName: '0-audio-short.mp3'
      }
    })
    expect(calls[0]?.form.fileSize).toBeGreaterThan(0)
    expect(result.text).toBe('Hello from Mistral.')
    expect(result.segments[0]).toMatchObject({
      start: '00:01:01',
      end: '00:01:02',
      speaker: 'speaker-a',
      text: 'Hello from Mistral.'
    })
    expect(metadata).toMatchObject({
      transcriptionService: 'mistral',
      transcriptionModel: 'voxtral-mini-latest'
    })
  }, 10_000)

  test('OCR sends snake_case JSON document bodies for PDFs and images', async () => {
    const calls: Array<{ url: string, method: string, authorization: string | null, body: Record<string, unknown> }> = []

    process.env['MISTRAL_API_KEY'] = 'mistral-key'
    process.env['MISTRAL_BASE_URL'] = 'https://mock.mistral.local/v1/'

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
      const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
        body
      })
      return Response.json({
        model: body['model'],
        pages: [{ index: calls.length, markdown: `page ${calls.length}` }],
        usage_info: { pages_processed: 1, doc_size_bytes: 10 }
      })
    }) as typeof fetch

    const pdfMetadata: DocumentMetadata = {
      slug: 'sample-pdf',
      pageCount: 1,
      format: 'pdf',
      fileSize: 10
    }
    const imageMetadata: DocumentMetadata = {
      slug: 'sample-image',
      pageCount: 1,
      format: 'png',
      fileSize: 10
    }

    const pdfResult = await runMistralOcr('input/examples/document/1-document.pdf', pdfMetadata, 'mistral-ocr-latest')
    const imageResult = await runMistralOcr('input/examples/document/1-document.png', imageMetadata, 'mistral-ocr-latest')

    expect(pdfResult.pages[0]).toMatchObject({ pageNumber: 1, method: 'ocr', text: 'page 1' })
    expect(imageResult.pages[0]).toMatchObject({ pageNumber: 2, method: 'ocr', text: 'page 2' })
    expect(calls).toHaveLength(2)
    expect(calls[0]).toMatchObject({
      url: 'https://mock.mistral.local/v1/ocr',
      method: 'POST',
      authorization: 'Bearer mistral-key',
      body: {
        model: 'mistral-ocr-latest',
        include_image_base64: false
      }
    })
    expect(calls[0]?.body['document']).toMatchObject({
      type: 'document_url'
    })
    expect(String((calls[0]?.body['document'] as Record<string, unknown>)['document_url']))
      .toStartWith('data:application/pdf;base64,')
    expect(calls[1]?.body['document']).toMatchObject({
      type: 'image_url'
    })
    expect(String((calls[1]?.body['document'] as Record<string, unknown>)['image_url']))
      .toStartWith('data:image/png;base64,')
  }, 10_000)

  test('HTTP errors preserve status and headers for retry classification', async () => {
    process.env['MISTRAL_API_KEY'] = 'mistral-key'
    const urls: string[] = []

    globalThis.fetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
      urls.push(String(input))
      return Response.json({ message: 'rate limited' }, {
        status: 429,
        headers: { 'retry-after': '7' }
      })
    }) as typeof fetch

    try {
      await mistralJsonRequest({
        apiKey: 'mistral-key',
        baseURL: 'https://mock.mistral.local',
        path: '/audio/speech',
        errorMessagePrefix: 'Mistral TTS failed',
        body: { input: 'hello' }
      })
      throw new Error('Expected Mistral request to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as { status?: number }).status).toBe(429)
      expect((error as { headers?: Headers }).headers?.get('retry-after')).toBe('7')
      expect((error as Error).message).toContain('rate limited')
    }

    expect(urls).toEqual(['https://mock.mistral.local/v1/audio/speech'])
  })
})
