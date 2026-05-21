import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DocumentMetadata, HostedOcrRun, PageResult } from '~/types'
import {
  DEFAULT_OCR_POLL_DEADLINE_MS,
  DEFAULT_OCR_REQUEST_TIMEOUT_MS,
  readPositiveIntegerEnv
} from '~/utils/timeouts'
import {
  classifyOcrCreateRetry,
  DEFAULT_OCR_PAGE_REQUEST_ATTEMPTS,
  DEFAULT_OCR_PAGE_REQUEST_TIMEOUT_MS,
  OCR_CREATE_RETRY_POLICY,
  OCR_PAGE_REQUEST_RETRY_POLICY,
  OCR_SCHEMA_RETRY_ATTEMPTS,
  withOcrPageRequestRetry
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import {
  createOcrPdfChunkRenderError,
  HOSTED_OCR_PDF_PAGE_FALLBACK_THRESHOLD,
  runHostedOcrWithPdfChunkFallback,
  shouldFallbackToOcrPdfChunks,
  stitchHostedOcrChunkRuns
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback'
import { classifyOcrProviderFailure } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-run-state'
import {
  OcrStructuredResponseError,
  writeOcrProviderError
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import {
  buildUnstructuredProgressKey,
  runUnstructuredOcr
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/unstructured-ocr/run-unstructured-ocr'

const basePdfMetadata: DocumentMetadata = {
  slug: 'document',
  pageCount: 6,
  format: 'pdf',
  fileSize: 12_345
}

const pagesForRange = (startPage: number, endPage: number): PageResult[] => {
  const pages: PageResult[] = []
  for (let pageNumber = 1; pageNumber <= endPage - startPage + 1; pageNumber++) {
    pages.push({
      pageNumber,
      method: 'ocr',
      text: `page ${startPage + pageNumber - 1}`
    })
  }
  return pages
}

const hostedRun = (
  pages: PageResult[],
  extras: Partial<HostedOcrRun> = {}
): HostedOcrRun => ({
  pages,
  extractionMethod: 'openai-ocr',
  ocrService: 'openai',
  ocrModel: 'test-model',
  ...extras
})

const pageCachePath = (dir: string, pageNumber: number): string =>
  join(dir, 'page-results', `page-${String(pageNumber).padStart(6, '0')}.json`)

const pageTextPath = (dir: string, pageNumber: number): string =>
  join(dir, 'page-results', `page-${String(pageNumber).padStart(6, '0')}.txt`)

const invalidPageResponsePath = (dir: string, pageNumber: number): string =>
  join(dir, 'page-results', `page-${String(pageNumber).padStart(6, '0')}-invalid-response.txt`)

const pageInputPath = (dir: string, pageNumber: number): string =>
  join(dir, 'page-inputs', `page-${String(pageNumber).padStart(6, '0')}.pdf`)

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json'
    }
  })

describe('OCR resilience contracts', () => {
  test('OCR retry policy and timeout defaults are aggressive and env parsing is strict', () => {
    expect(DEFAULT_OCR_REQUEST_TIMEOUT_MS).toBe(60 * 60_000)
    expect(DEFAULT_OCR_POLL_DEADLINE_MS).toBe(60 * 60_000)
    expect(DEFAULT_OCR_PAGE_REQUEST_ATTEMPTS).toBe(2)
    expect(DEFAULT_OCR_PAGE_REQUEST_TIMEOUT_MS).toBe(5 * 60_000)
    expect(HOSTED_OCR_PDF_PAGE_FALLBACK_THRESHOLD).toBe(20)
    expect(OCR_SCHEMA_RETRY_ATTEMPTS).toBe(3)
    expect(OCR_CREATE_RETRY_POLICY).toMatchObject({
      maxAttempts: 4,
      maxDelayMs: 60_000,
      jitter: true,
      exponential: true
    })
    expect(OCR_PAGE_REQUEST_RETRY_POLICY).toMatchObject({
      maxAttempts: 2,
      maxDelayMs: 10_000,
      jitter: true,
      exponential: true
    })
    expect(classifyOcrCreateRetry(new DOMException('deadline exceeded', 'TimeoutError')).shouldRetry).toBe(true)

    const envKey = 'AUTOSHOW_TEST_OCR_TIMEOUT_PARSE_MS'
    const original = process.env[envKey]
    try {
      process.env[envKey] = '1234'
      expect(readPositiveIntegerEnv(envKey, 7)).toBe(1234)
      process.env[envKey] = '0'
      expect(readPositiveIntegerEnv(envKey, 7)).toBe(7)
      process.env[envKey] = 'not-a-number'
      expect(readPositiveIntegerEnv(envKey, 7)).toBe(7)
    } finally {
      if (original === undefined) {
        delete process.env[envKey]
      } else {
        process.env[envKey] = original
      }
    }
  })

  test('Unstructured progress key tracks node counters instead of log messages or node order', () => {
    const base = buildUnstructuredProgressKey({
      id: 'job-1',
      processing_status: 'IN_PROGRESS',
      message: 'first message',
      node_stats: [
        { node_name: 'enrich', ready: 0, in_progress: 1, success: 0, failure: 0 },
        { node_name: 'partition', ready: 0, in_progress: 1, success: 0, failure: 0 }
      ]
    })

    expect(buildUnstructuredProgressKey({
      id: 'job-1',
      processing_status: 'IN_PROGRESS',
      message: 'different message',
      node_stats: [
        { node_name: 'partition', ready: 0, in_progress: 1, success: 0, failure: 0 },
        { node_name: 'enrich', ready: 0, in_progress: 1, success: 0, failure: 0 }
      ]
    })).toBe(base)

    expect(buildUnstructuredProgressKey({
      id: 'job-1',
      processing_status: 'IN_PROGRESS',
      node_stats: [
        { node_name: 'enrich', ready: 0, in_progress: 0, success: 1, failure: 0 },
        { node_name: 'partition', ready: 0, in_progress: 1, success: 0, failure: 0 }
      ]
    })).not.toBe(base)
  })

  test('Unstructured stalled jobs are cancelled before the global OCR deadline', async () => {
    const previousFetch = globalThis.fetch
    const previousSleep = Bun.sleep
    const previousDateNow = Date.now
    const previousEnv = {
      UNSTRUCTURED_API_KEY: process.env['UNSTRUCTURED_API_KEY'],
      AUTOSHOW_UNSTRUCTURED_OCR_POLL_INTERVAL_MS: process.env['AUTOSHOW_UNSTRUCTURED_OCR_POLL_INTERVAL_MS'],
      AUTOSHOW_UNSTRUCTURED_OCR_POLL_DEADLINE_MS: process.env['AUTOSHOW_UNSTRUCTURED_OCR_POLL_DEADLINE_MS'],
      AUTOSHOW_UNSTRUCTURED_OCR_STALL_DEADLINE_MS: process.env['AUTOSHOW_UNSTRUCTURED_OCR_STALL_DEADLINE_MS'],
      AUTOSHOW_UNSTRUCTURED_OCR_EMPTY_WORKFLOW_DEADLINE_MS: process.env['AUTOSHOW_UNSTRUCTURED_OCR_EMPTY_WORKFLOW_DEADLINE_MS'],
      AUTOSHOW_UNSTRUCTURED_OCR_POLL_REQUEST_TIMEOUT_MS: process.env['AUTOSHOW_UNSTRUCTURED_OCR_POLL_REQUEST_TIMEOUT_MS']
    }
    let now = 0
    const calls: Array<{ method: string, url: string }> = []
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-unstructured-stall-'))
    const inputPath = join(tempDir, 'input.pdf')

    try {
      await Bun.write(inputPath, new Uint8Array([37, 80, 68, 70]))
      process.env['UNSTRUCTURED_API_KEY'] = 'test-key'
      process.env['AUTOSHOW_UNSTRUCTURED_OCR_POLL_INTERVAL_MS'] = '100'
      process.env['AUTOSHOW_UNSTRUCTURED_OCR_POLL_DEADLINE_MS'] = '1000'
      process.env['AUTOSHOW_UNSTRUCTURED_OCR_STALL_DEADLINE_MS'] = '900'
      process.env['AUTOSHOW_UNSTRUCTURED_OCR_EMPTY_WORKFLOW_DEADLINE_MS'] = '250'
      process.env['AUTOSHOW_UNSTRUCTURED_OCR_POLL_REQUEST_TIMEOUT_MS'] = '100'

      Date.now = () => now
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = (async (ms?: number | string) => {
        now += typeof ms === 'number' ? ms : Number(ms ?? 0)
      }) as typeof Bun.sleep

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        calls.push({ method, url })

        if (method === 'POST' && url.endsWith('/api/v1/jobs/')) {
          return jsonResponse({ id: 'job-1', status: 'SCHEDULED', input_file_ids: ['input-1'] })
        }

        if (method === 'GET' && url.endsWith('/api/v1/jobs/job-1/details')) {
          return jsonResponse({
            id: 'job-1',
            processing_status: 'IN_PROGRESS',
            node_stats: [
              { node_name: 'partition', ready: 0, in_progress: 0, success: 0, failure: 0 }
            ]
          })
        }

        if (method === 'POST' && url.endsWith('/api/v1/jobs/job-1/cancel')) {
          return jsonResponse({ ok: true })
        }

        throw new Error(`Unexpected Unstructured mock fetch: ${method} ${url}`)
      }) as typeof fetch

      await expect(runUnstructuredOcr(inputPath, {
        ...basePdfMetadata,
        pageCount: 1,
        fileSize: 4
      }, 'hi_res_and_enrichment')).rejects.toThrow('did not move any files into workflow nodes')

      expect(calls.some((call) => call.method === 'POST' && call.url.endsWith('/api/v1/jobs/job-1/cancel'))).toBe(true)
      expect(now).toBeLessThan(1000)
    } finally {
      globalThis.fetch = previousFetch
      ;(Bun as typeof Bun & { sleep: typeof Bun.sleep }).sleep = previousSleep
      Date.now = previousDateNow
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('Unstructured create-job without input file IDs is cancelled immediately', async () => {
    const previousFetch = globalThis.fetch
    const previousEnv = {
      UNSTRUCTURED_API_KEY: process.env['UNSTRUCTURED_API_KEY'],
      AUTOSHOW_UNSTRUCTURED_OCR_POLL_REQUEST_TIMEOUT_MS: process.env['AUTOSHOW_UNSTRUCTURED_OCR_POLL_REQUEST_TIMEOUT_MS']
    }
    const calls: Array<{ method: string, url: string }> = []
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-unstructured-no-input-'))
    const inputPath = join(tempDir, 'input.pdf')

    try {
      await Bun.write(inputPath, new Uint8Array([37, 80, 68, 70]))
      process.env['UNSTRUCTURED_API_KEY'] = 'test-key'
      process.env['AUTOSHOW_UNSTRUCTURED_OCR_POLL_REQUEST_TIMEOUT_MS'] = '100'

      globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]): Promise<Response> => {
        const url = String(input)
        const method = init?.method ?? 'GET'
        calls.push({ method, url })

        if (method === 'POST' && url.endsWith('/api/v1/jobs/')) {
          return jsonResponse({ id: 'job-1', status: 'SCHEDULED', input_file_ids: [] })
        }

        if (method === 'POST' && url.endsWith('/api/v1/jobs/job-1/cancel')) {
          return jsonResponse({ ok: true })
        }

        throw new Error(`Unexpected Unstructured mock fetch: ${method} ${url}`)
      }) as typeof fetch

      await expect(runUnstructuredOcr(inputPath, {
        ...basePdfMetadata,
        pageCount: 1,
        fileSize: 4
      }, 'hi_res_and_enrichment')).rejects.toThrow('did not return input_file_ids')

      expect(calls.some((call) => call.method === 'POST' && call.url.endsWith('/api/v1/jobs/job-1/cancel'))).toBe(true)
      expect(calls.some((call) => call.method === 'GET')).toBe(false)
    } finally {
      globalThis.fetch = previousFetch
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = value
        }
      }
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('PDFs over the hosted fallback threshold skip full-document OCR and start at page 1', async () => {
    let fullAttempts = 0
    const attemptedPages: number[] = []
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-threshold-'))
    try {
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 21 },
        serviceLabel: 'Test OCR',
        totalPages: 21,
        fallbackDir: tempDir,
        runFull: async () => {
          fullAttempts += 1
          throw new Error('full OCR should not run')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          return hostedRun(pagesForRange(range.startPage, range.endPage), {
            totalPages: 1
          })
        }
      })

      expect(fullAttempts).toBe(0)
      expect(attemptedPages[0]).toBe(1)
      expect(attemptedPages).toHaveLength(21)
      expect(result.pages.map((page) => page.pageNumber)).toEqual(Array.from({ length: 21 }, (_value, index) => index + 1))
      expect(await Bun.file(join(tempDir, 'fallback-state.json')).exists()).toBe(true)
      expect(await Bun.file(pageInputPath(tempDir, 1)).exists()).toBe(true)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('PDFs at the hosted fallback threshold still try full-document OCR first', async () => {
    let fullAttempts = 0
    let pageAttempts = 0
    const result = await runHostedOcrWithPdfChunkFallback({
      filePath: '/virtual/input.pdf',
      step1Metadata: { ...basePdfMetadata, pageCount: 20 },
      serviceLabel: 'Test OCR',
      totalPages: 20,
      runFull: async () => {
        fullAttempts += 1
        return hostedRun(pagesForRange(1, 20), { totalPages: 20 })
      },
      createChunk: async (_inputPath, outputPath) => {
        await Bun.write(outputPath, 'page')
      },
      runChunk: async () => {
        pageAttempts += 1
        return hostedRun(pagesForRange(1, 1), { totalPages: 1 })
      }
    })

    expect(fullAttempts).toBe(1)
    expect(pageAttempts).toBe(0)
    expect(result.totalPages).toBe(20)
  })

  test('small PDF full-document failures fall back to individual cached pages', async () => {
    const attemptedPages: number[] = []
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-fallback-'))
    try {
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 3 },
        serviceLabel: 'Test OCR',
        totalPages: 3,
        fallbackDir: tempDir,
        runFull: async () => {
          throw Object.assign(new Error('provider timed out while reading OCR response'), { status: 503 })
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          return hostedRun(pagesForRange(range.startPage, range.endPage), {
            totalPages: 1,
            promptTokens: 1,
            completionTokens: 10,
            providerCostCents: 1,
            providerCostSource: range.startPage === 2 ? 'registry_fallback' : 'provider_quote'
          })
        }
      })

      expect(attemptedPages).toEqual([1, 2, 3])
      expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3])
      expect(result.promptTokens).toBe(3)
      expect(result.completionTokens).toBe(30)
      expect(result.providerCostCents).toBe(3)
      expect(result.providerCostSource).toBe('registry_fallback')
      expect(await Bun.file(pageCachePath(tempDir, 1)).exists()).toBe(true)
      expect(await Bun.file(pageCachePath(tempDir, 2)).exists()).toBe(true)
      expect(await Bun.file(pageCachePath(tempDir, 3)).exists()).toBe(true)
      expect(await Bun.file(pageTextPath(tempDir, 1)).text()).toBe('page 1\n')
      expect(await Bun.file(pageTextPath(tempDir, 2)).text()).toBe('page 2\n')
      expect(await Bun.file(pageTextPath(tempDir, 3)).text()).toBe('page 3\n')
      expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toContain('Page 3\npage 3')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('successful fallback pages are cached before the next page runs', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-cache-order-'))
    try {
      await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 2 },
        serviceLabel: 'Test OCR',
        totalPages: 2,
        fallbackDir: tempDir,
        runFull: async () => {
          throw Object.assign(new Error('provider timed out while reading OCR response'), { status: 503 })
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          if (range.startPage === 2) {
            expect(await Bun.file(pageCachePath(tempDir, 1)).exists()).toBe(true)
            expect(await Bun.file(pageTextPath(tempDir, 1)).text()).toBe('page 1\n')
            expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toContain('Page 1\npage 1')
          }
          return hostedRun(pagesForRange(range.startPage, range.endPage), {
            totalPages: 1
          })
        }
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('malformed structured fallback pages are accepted as raw text and processing continues', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-invalid-'))
    const attemptedPages: number[] = []
    const rawMalformedText = 'raw page OCR text\nsecond line'
    try {
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 2 },
        serviceLabel: 'Test OCR',
        totalPages: 2,
        fallbackDir: tempDir,
        runFull: async () => {
          throw Object.assign(new Error('provider timed out while reading OCR response'), { status: 503 })
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          if (range.startPage === 1) {
            throw new OcrStructuredResponseError('Response was not valid JSON', rawMalformedText)
          }
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        },
        buildMalformedPageRun: (rawText, range) => hostedRun([{
          pageNumber: range.startPage,
          method: 'ocr',
          text: rawText
        }], { totalPages: 1 })
      })

      expect(attemptedPages).toEqual([1, 2])
      expect(result.pages.map((page) => page.text)).toEqual([rawMalformedText, 'page 2'])
      expect(await Bun.file(invalidPageResponsePath(tempDir, 1)).text()).toBe(rawMalformedText)
      expect(await Bun.file(pageTextPath(tempDir, 1)).text()).toBe(`${rawMalformedText}\n`)
      expect(await Bun.file(pageTextPath(tempDir, 2)).text()).toBe('page 2\n')
      expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toContain(`Page 1\n${rawMalformedText}`)

      const cached = await Bun.file(pageCachePath(tempDir, 1)).json() as Record<string, unknown>
      const cachedRun = cached['run'] as HostedOcrRun
      expect(cachedRun.extractionMethod).toBe('openai-ocr')
      expect(cachedRun.ocrService).toBe('openai')
      expect(cachedRun.ocrModel).toBe('test-model')
      expect(cachedRun.pages[0]?.text).toBe(rawMalformedText)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('structured fallback pages with empty raw output remain fatal', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-empty-invalid-'))
    try {
      await expect(runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 1 },
        serviceLabel: 'Test OCR',
        totalPages: 1,
        fallbackDir: tempDir,
        runFull: async () => {
          throw Object.assign(new Error('provider timed out while reading OCR response'), { status: 503 })
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async () => {
          throw new OcrStructuredResponseError('DeepInfra OCR returned no text output.', '')
        },
        buildMalformedPageRun: (rawText, range) => hostedRun([{
          pageNumber: range.startPage,
          method: 'ocr',
          text: rawText
        }], { totalPages: 1 })
      })).rejects.toThrow('DeepInfra OCR returned no text output.')

      expect(await Bun.file(pageCachePath(tempDir, 1)).exists()).toBe(false)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('malformed fallback pages force stitched text to use complete page text when canonical text would be partial', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-canonical-invalid-'))
    try {
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 2 },
        serviceLabel: 'Test OCR',
        totalPages: 2,
        fallbackDir: tempDir,
        runFull: async () => {
          throw Object.assign(new Error('provider timed out while reading OCR response'), { status: 503 })
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          if (range.startPage === 1) {
            throw new OcrStructuredResponseError('Response was not valid JSON', 'raw page OCR text')
          }
          return hostedRun(pagesForRange(range.startPage, range.endPage), {
            canonicalText: 'canonical page 2',
            totalPages: 1
          })
        },
        buildMalformedPageRun: (rawText, range) => hostedRun([{
          pageNumber: range.startPage,
          method: 'ocr',
          text: rawText
        }], { totalPages: 1 })
      })

      expect(result.pages.map((page) => page.text)).toEqual(['raw page OCR text', 'page 2'])
      expect(result.canonicalText).toBeUndefined()
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('chunk stitching sorts pages and aggregates usage metadata', () => {
    const result = stitchHostedOcrChunkRuns([
      hostedRun([
        { pageNumber: 2, method: 'ocr', text: 'two' },
        { pageNumber: 1, method: 'ocr', text: 'one' }
      ], {
        canonicalText: 'one\ntwo',
        promptTokens: 2,
        completionTokens: 20,
        providerCostCents: 3,
        providerCostSource: 'provider_quote',
        providerUsage: [{
          unit: 'chunk',
          pageStart: 1,
          pageEnd: 2,
          promptTokens: 2,
          completionTokens: 20
        }]
      }),
      hostedRun([
        { pageNumber: 3, method: 'ocr', text: 'three' }
      ], {
        canonicalText: 'three',
        promptTokens: 1,
        completionTokens: 10,
        providerCostCents: 5,
        providerCostSource: 'registry_fallback',
        providerUsage: [{
          unit: 'chunk',
          pageStart: 3,
          pageEnd: 3,
          promptTokens: 1,
          completionTokens: 10,
          providerCostCents: 5,
          providerCostSource: 'registry_fallback'
        }]
      })
    ], 3)

    expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3])
    expect(result.canonicalText).toBe('one\ntwo\n\nthree')
    expect(result.promptTokens).toBe(3)
    expect(result.completionTokens).toBe(30)
    expect(result.providerCostCents).toBe(8)
    expect(result.providerCostSource).toBe('registry_fallback')
    expect(result.providerUsage).toEqual([
      {
        unit: 'chunk',
        pageStart: 1,
        pageEnd: 2,
        promptTokens: 2,
        completionTokens: 20
      },
      {
        unit: 'chunk',
        pageStart: 3,
        pageEnd: 3,
        promptTokens: 1,
        completionTokens: 10,
        providerCostCents: 5,
        providerCostSource: 'registry_fallback'
      }
    ])
  })

  test('PDF fallback classifier splits transient and limit failures but not auth or policy failures', () => {
    expect(shouldFallbackToOcrPdfChunks(Object.assign(new Error('provider timed out'), { status: 503 }))).toBe(true)
    expect(shouldFallbackToOcrPdfChunks(new Error('Gemini OCR supports PDF inputs up to 1000 pages. Got 1200 pages.'))).toBe(true)
    expect(shouldFallbackToOcrPdfChunks(new Error('OpenAI OCR returned malformed JSON.'))).toBe(true)
    expect(shouldFallbackToOcrPdfChunks(new Error('OPENAI_API_KEY environment variable is required for OpenAI OCR'))).toBe(false)
    expect(shouldFallbackToOcrPdfChunks(new Error('Output blocked by content filtering policy'))).toBe(false)
  })

  test('PDF chunk render failures are concise and persist raw stderr diagnostics', async () => {
    const rawStderr = [
      'warning: ICC support is not available',
      'error: cannot render page tree for encrypted object',
      'more raw stderr detail'
    ].join('\n')
    const error = createOcrPdfChunkRenderError(
      { startPage: 6, endPage: 10 },
      {
        exitCode: 1,
        stderr: rawStderr,
        stdout: '',
        command: 'mutool convert -F pdf -o chunk.pdf input.pdf 6-10'
      }
    )
    const failure = classifyOcrProviderFailure(error)

    expect(failure).toMatchObject({
      category: 'pdf_chunk_render'
    })
    expect(failure.message).toContain('PDF chunk creation failed for pages 6-10')
    expect(failure.message).toContain('warning: ICC support is not available')
    expect(failure.message).not.toContain('more raw stderr detail')

    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-error-artifact-'))
    try {
      await writeOcrProviderError(tempDir, error, failure)
      const diagnostic = await Bun.file(join(tempDir, 'error.json')).json() as Record<string, unknown>
      expect(diagnostic['category']).toBe('pdf_chunk_render')
      expect(diagnostic).not.toHaveProperty('retryable')
      expect((diagnostic['error'] as Record<string, unknown>)['stderr']).toBe(rawStderr)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('DeepInfra page OCR uses bounded request retries and timeout classification keeps page context', async () => {
    let attempts = 0
    await expect(withOcrPageRequestRetry(
      'deepinfra-ocr page 7',
      async () => {
        attempts += 1
        throw new OcrStructuredResponseError('DeepInfra OCR returned no text output.', '')
      },
      {
        attempts: 2,
        timeoutMs: 1000,
        classifier: () => ({ shouldRetry: true, delayMs: 1, reason: 'structured_response' })
      }
    )).rejects.toThrow('deepinfra-ocr page 7 failed after 2/2 attempts')
    expect(attempts).toBe(2)

    const timeoutCause = new Error('The operation was aborted due to timeout')
    timeoutCause.name = 'AbortError'
    const timeoutError = new Error('deepinfra-ocr page 7 failed after 2 attempts (600000ms elapsed)', {
      cause: timeoutCause
    })
    const failure = classifyOcrProviderFailure(timeoutError)
    expect(failure.category).toBe('timeout')
    expect(failure.message).toContain('deepinfra-ocr page 7')
    expect(failure.message).toContain('timeout')
  })

})
