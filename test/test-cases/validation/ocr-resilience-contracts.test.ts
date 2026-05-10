import { describe, expect, test } from 'bun:test'
import type { DocumentMetadata, HostedOcrRun, PageResult } from '~/types'
import {
  DEFAULT_OCR_POLL_DEADLINE_MS,
  DEFAULT_OCR_REQUEST_TIMEOUT_MS,
  readPositiveIntegerEnv
} from '~/utils/timeouts'
import {
  classifyOcrCreateRetry,
  OCR_CREATE_RETRY_POLICY,
  OCR_SCHEMA_RETRY_ATTEMPTS
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import {
  buildOcrPdfChunkRanges,
  DEFAULT_OCR_FALLBACK_CHUNK_PAGES,
  runHostedOcrWithPdfChunkFallback,
  shouldFallbackToOcrPdfChunks,
  stitchHostedOcrChunkRuns
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback'
import { isRetryableDeapiOcrJobFailure } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/deapi-ocr/run-deapi-ocr'

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

describe('OCR resilience contracts', () => {
  test('OCR retry policy and timeout defaults are aggressive and env parsing is strict', () => {
    expect(DEFAULT_OCR_REQUEST_TIMEOUT_MS).toBe(60 * 60_000)
    expect(DEFAULT_OCR_POLL_DEADLINE_MS).toBe(60 * 60_000)
    expect(DEFAULT_OCR_FALLBACK_CHUNK_PAGES).toBe(5)
    expect(OCR_SCHEMA_RETRY_ATTEMPTS).toBe(3)
    expect(OCR_CREATE_RETRY_POLICY).toMatchObject({
      maxAttempts: 4,
      maxDelayMs: 60_000,
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

  test('PDF chunk ranges use the fallback chunk size contract', () => {
    expect(buildOcrPdfChunkRanges(12, 5)).toEqual([
      { startPage: 1, endPage: 5 },
      { startPage: 6, endPage: 10 },
      { startPage: 11, endPage: 12 }
    ])
    expect(buildOcrPdfChunkRanges(3, 0)).toEqual([
      { startPage: 1, endPage: 1 },
      { startPage: 2, endPage: 2 },
      { startPage: 3, endPage: 3 }
    ])
  })

  test('PDF chunk fallback recursively splits failing chunks and stitches global pages', async () => {
    const attemptedRanges: string[] = []
    const result = await runHostedOcrWithPdfChunkFallback({
      filePath: '/virtual/input.pdf',
      step1Metadata: basePdfMetadata,
      serviceLabel: 'Test OCR',
      totalPages: 6,
      chunkPages: 5,
      runFull: async () => {
        throw Object.assign(new Error('provider timed out while reading OCR response'), { status: 503 })
      },
      createChunk: async (_inputPath, outputPath, range) => {
        await Bun.write(outputPath, `chunk ${range.startPage}-${range.endPage}`)
      },
      runChunk: async (_chunkPath, _chunkMetadata, range) => {
        attemptedRanges.push(`${range.startPage}-${range.endPage}`)
        if (range.startPage === 1 && range.endPage === 5) {
          throw new Error('OpenAI OCR returned malformed JSON.')
        }
        if (range.startPage === 1 && range.endPage === 3) {
          throw new Error('OpenAI OCR returned non-contiguous page numbers.')
        }

        const pageCount = range.endPage - range.startPage + 1
        return hostedRun(pagesForRange(range.startPage, range.endPage), {
          totalPages: pageCount,
          promptTokens: pageCount,
          completionTokens: pageCount * 10,
          providerCostCents: pageCount,
          providerCostSource: range.startPage === 4 ? 'registry_fallback' : 'provider_quote'
        })
      }
    })

    expect(attemptedRanges).toEqual(['1-5', '1-3', '1-2', '3-3', '4-5', '6-6'])
    expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3, 4, 5, 6])
    expect(result.pages.map((page) => page.text)).toEqual([
      'page 1',
      'page 2',
      'page 3',
      'page 4',
      'page 5',
      'page 6'
    ])
    expect(result.totalPages).toBe(6)
    expect(result.promptTokens).toBe(6)
    expect(result.completionTokens).toBe(60)
    expect(result.providerCostCents).toBe(6)
    expect(result.providerCostSource).toBe('registry_fallback')
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
        providerCostSource: 'provider_quote'
      }),
      hostedRun([
        { pageNumber: 3, method: 'ocr', text: 'three' }
      ], {
        canonicalText: 'three',
        promptTokens: 1,
        completionTokens: 10,
        providerCostCents: 5,
        providerCostSource: 'registry_fallback'
      })
    ], 3)

    expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3])
    expect(result.canonicalText).toBe('one\ntwo\n\nthree')
    expect(result.promptTokens).toBe(3)
    expect(result.completionTokens).toBe(30)
    expect(result.providerCostCents).toBe(8)
    expect(result.providerCostSource).toBe('registry_fallback')
  })

  test('PDF fallback classifier splits retryable and limit failures but not auth or policy failures', () => {
    expect(shouldFallbackToOcrPdfChunks(Object.assign(new Error('provider timed out'), { status: 503 }))).toBe(true)
    expect(shouldFallbackToOcrPdfChunks(new Error('Gemini OCR supports PDF inputs up to 1000 pages. Got 1200 pages.'))).toBe(true)
    expect(shouldFallbackToOcrPdfChunks(new Error('OpenAI OCR returned malformed JSON.'))).toBe(true)
    expect(shouldFallbackToOcrPdfChunks(new Error('OPENAI_API_KEY environment variable is required for OpenAI OCR'))).toBe(false)
    expect(shouldFallbackToOcrPdfChunks(new Error('Output blocked by content filtering policy'))).toBe(false)
  })

  test('deAPI terminal unknown OCR job failures are retryable at job level', () => {
    expect(isRetryableDeapiOcrJobFailure(new Error('deAPI job failed: unknown error'))).toBe(true)
    expect(isRetryableDeapiOcrJobFailure(Object.assign(new Error('deAPI polling failed'), {
      status: 502,
      stage: 'poll'
    }))).toBe(true)
    expect(isRetryableDeapiOcrJobFailure(Object.assign(new Error('deAPI OCR request failed'), {
      status: 502,
      stage: 'create'
    }))).toBe(false)
    expect(isRetryableDeapiOcrJobFailure(new Error('DEAPI_API_KEY environment variable is required for deAPI OCR'))).toBe(false)
  })
})
