import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildMissingProviders,
  buildMissingTargetsFromEntry,
  classifyOcrProviderFailure,
  parseStoredRequestedTarget
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-run-state'
import {
  OcrStructuredResponseError,
  writeInvalidOcrStructuredResponse
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import { resolvePrimaryOcrTarget } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import {
  buildPaddlePreparedImagePath,
  extractPaddleOcrJsonLine,
  isPaddleNativeCrashExitCode,
  parsePaddleImageDimensions,
  summarizePaddleFailure
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-local/paddle-ocr/run-paddle-ocr'
import { writeAwsTextractSyncDocumentFile } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/aws-textract/run-aws-textract'
import { runHostedOcrWithPdfChunkFallback } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-chunk-fallback'
import type { DocumentMetadata, HostedOcrRun, OcrProviderState, OcrTarget, PageResult } from '~/types'

const requestedTargets: OcrTarget[] = [
  { service: 'tesseract', model: 'tesseract' },
  { service: 'paddle-ocr', model: 'paddle-ocr' },
  { service: 'anthropic', model: 'claude-haiku-4-5' }
]
const tesseractTarget = requestedTargets[0] as OcrTarget
const paddleTarget = requestedTargets[1] as OcrTarget
const anthropicTarget = requestedTargets[2] as OcrTarget

const basePdfMetadata: DocumentMetadata = {
  slug: 'document',
  pageCount: 4,
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

const writeCachedPage = async (
  dir: string,
  pageNumber: number,
  totalPages: number,
  run: HostedOcrRun = hostedRun([{ pageNumber, method: 'ocr', text: `page ${pageNumber}` }], { totalPages: 1 })
): Promise<void> => {
  await mkdir(join(dir, 'page-results'), { recursive: true })
  await Bun.write(pageCachePath(dir, pageNumber), JSON.stringify({
    version: 1,
    mode: 'single-page',
    totalPages,
    pageNumber,
    run
  }, null, 2) + '\n')
}

const providerState = (
  target: OcrTarget,
  status: OcrProviderState['status']
): OcrProviderState => ({
  service: target.service,
  model: target.model,
  artifactDir: `providers/${target.service}-${target.model}`,
  status,
  attempts: status === 'succeeded' ? 1 : 2,
  ...(status === 'failed'
    ? {
        lastError: {
          message: `${target.service} failed`
        }
      }
    : {})
})

describe('OCR resume contracts', () => {
  test('all failed providers remain resumable when explicit missing providers are stored', () => {
    const entry = {
      requestedProviders: requestedTargets,
      missingProviders: [paddleTarget, anthropicTarget],
      providerStates: [
        providerState(tesseractTarget, 'succeeded'),
        providerState(paddleTarget, 'failed'),
        providerState(anthropicTarget, 'failed')
      ]
    }

    expect(buildMissingTargetsFromEntry(entry, requestedTargets)).toEqual([
      paddleTarget,
      anthropicTarget
    ])
  })

  test('all provider failures are written as missing providers', () => {
    const states = [
      providerState(tesseractTarget, 'succeeded'),
      providerState(paddleTarget, 'failed'),
      providerState(anthropicTarget, 'failed')
    ]

    expect(buildMissingProviders(states, requestedTargets)).toEqual([
      paddleTarget,
      anthropicTarget
    ])
  })

  test('resume targets include all failed providers even when missingProviders omits them', () => {
    const entry = {
      requestedProviders: requestedTargets,
      missingProviders: [paddleTarget],
      providerStates: [
        providerState(tesseractTarget, 'succeeded'),
        providerState(paddleTarget, 'failed'),
        providerState(anthropicTarget, 'failed')
      ]
    }

    expect(buildMissingTargetsFromEntry(entry, requestedTargets)).toEqual([
      paddleTarget,
      anthropicTarget
    ])
  })

  test('resume targets detect failed providers from providerStates when missingProviders is empty', () => {
    const entry = {
      requestedProviders: requestedTargets,
      missingProviders: [],
      providerStates: [
        providerState(tesseractTarget, 'succeeded'),
        providerState(paddleTarget, 'failed'),
        providerState(anthropicTarget, 'succeeded')
      ]
    }

    expect(buildMissingTargetsFromEntry(entry, requestedTargets)).toEqual([
      paddleTarget
    ])
  })

  test('hosted PDF page fallback resume skips cached pages and starts at the first missing page', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-resume-'))
    try {
      await writeCachedPage(tempDir, 1, 4)
      await writeCachedPage(tempDir, 2, 4)

      let fullAttempts = 0
      const attemptedPages: number[] = []
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: basePdfMetadata,
        serviceLabel: 'Test OCR',
        totalPages: 4,
        fallbackDir: tempDir,
        runFull: async () => {
          fullAttempts += 1
          throw new Error('full OCR should be bypassed')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        }
      })

      expect(fullAttempts).toBe(0)
      expect(attemptedPages).toEqual([3, 4])
      expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3, 4])
      expect(await Bun.file(pageTextPath(tempDir, 1)).text()).toBe('page 1\n')
      expect(await Bun.file(pageTextPath(tempDir, 4)).text()).toBe('page 4\n')
      expect(await Bun.file(join(tempDir, 'partial-extraction.txt')).text()).toContain('Page 4\npage 4')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('hosted PDF fallback state bypasses full-document OCR even before page results exist', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-fallback-state-'))
    try {
      await Bun.write(join(tempDir, 'fallback-state.json'), JSON.stringify({
        version: 1,
        mode: 'single-page',
        totalPages: 2,
        serviceLabel: 'Test OCR',
        sourceFile: 'input.pdf'
      }, null, 2) + '\n')

      let fullAttempts = 0
      const attemptedPages: number[] = []
      await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 2 },
        serviceLabel: 'Test OCR',
        totalPages: 2,
        fallbackDir: tempDir,
        runFull: async () => {
          fullAttempts += 1
          throw new Error('full OCR should be bypassed')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        }
      })

      expect(fullAttempts).toBe(0)
      expect(attemptedPages).toEqual([1, 2])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('hosted PDF page fallback ignores corrupt or mismatched page cache files', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-page-cache-invalid-'))
    try {
      await mkdir(join(tempDir, 'page-results'), { recursive: true })
      await Bun.write(pageCachePath(tempDir, 1), '{bad json')
      await writeCachedPage(
        tempDir,
        2,
        3,
        hostedRun([{ pageNumber: 99, method: 'ocr', text: 'wrong page' }], { totalPages: 1 })
      )
      await writeCachedPage(tempDir, 3, 3)

      let fullAttempts = 0
      const attemptedPages: number[] = []
      const result = await runHostedOcrWithPdfChunkFallback({
        filePath: '/virtual/input.pdf',
        step1Metadata: { ...basePdfMetadata, pageCount: 3 },
        serviceLabel: 'Test OCR',
        totalPages: 3,
        fallbackDir: tempDir,
        runFull: async () => {
          fullAttempts += 1
          throw new Error('full OCR should be bypassed')
        },
        createChunk: async (_inputPath, outputPath, range) => {
          await Bun.write(outputPath, `page ${range.startPage}`)
        },
        runChunk: async (_chunkPath, _chunkMetadata, range) => {
          attemptedPages.push(range.startPage)
          return hostedRun(pagesForRange(range.startPage, range.endPage), { totalPages: 1 })
        }
      })

      expect(fullAttempts).toBe(0)
      expect(attemptedPages).toEqual([1, 2])
      expect(result.pages.map((page) => page.pageNumber)).toEqual([1, 2, 3])
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('content filter failures are classified by category', () => {
    const failure = classifyOcrProviderFailure(new Error(
      '400 {"type":"error","error":{"type":"invalid_request_error","message":"Output blocked by content filtering policy"}}'
    ))

    expect(failure.category).toBe('content_policy')
    expect(failure.message).toContain('Output blocked by content filtering policy')
  })

  test('transient OCR failures are classified by category', () => {
    const error = Object.assign(new Error('provider timed out while reading OCR response'), {
      status: 503
    })

    const failure = classifyOcrProviderFailure(error)
    expect(failure.category).toBe('timeout')
  })

  test('structured OCR validation failures persist raw provider output', async () => {
    const failure = classifyOcrProviderFailure(new OcrStructuredResponseError(
      'OpenAI OCR response was not valid JSON.',
      '{"pages":'
    ))
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-structured-error-'))
    try {
      await writeInvalidOcrStructuredResponse(tempDir, new OcrStructuredResponseError(
        'OpenAI OCR response was not valid JSON.',
        '{"pages":'
      ))
      expect(failure.category).toBe('structured_response')
      expect(await Bun.file(join(tempDir, 'invalid-structured-response.txt')).text()).toBe('{"pages":')
      const diagnostic = await Bun.file(join(tempDir, 'invalid-structured-response.json')).json() as Record<string, unknown>
      expect(diagnostic['rawResponseFile']).toBe('invalid-structured-response.txt')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  test('primary OCR service-only match succeeds when unique', () => {
    expect(resolvePrimaryOcrTarget(requestedTargets, 'paddle-ocr')).toEqual(paddleTarget)
  })

  test('primary OCR service/model exact match succeeds', () => {
    const targets: OcrTarget[] = [
      { service: 'openai', model: 'gpt-5.4-nano' },
      { service: 'openai', model: 'gpt-5.4' }
    ]

    expect(resolvePrimaryOcrTarget(targets, 'openai/gpt-5.4')).toEqual(targets[1])
  })

  test('primary OCR unknown or ambiguous values fail', () => {
    const targets: OcrTarget[] = [
      { service: 'openai', model: 'gpt-5.4-nano' },
      { service: 'openai', model: 'gpt-5.4' }
    ]

    expect(() => resolvePrimaryOcrTarget(targets, 'gemini')).toThrow('--primary-ocr gemini does not match')
    expect(() => resolvePrimaryOcrTarget(targets, 'openai')).toThrow('matches multiple')
  })

  test('stored OCR targets include current hosted provider set', () => {
    expect(parseStoredRequestedTarget({ service: 'aws-textract', model: 'detect-document-text' })).toEqual({
      service: 'aws-textract',
      model: 'detect-document-text'
    })
    expect(parseStoredRequestedTarget({ service: 'gcloud-docai', model: 'processor/default' })).toEqual({
      service: 'gcloud-docai',
      model: 'processor/default'
    })
    expect(parseStoredRequestedTarget({ service: 'unstructured', model: 'workflow/default' })).toEqual({
      service: 'unstructured',
      model: 'workflow/default'
    })
  })

  test('Paddle JSON extraction ignores noisy stdout after the payload', () => {
    expect(extractPaddleOcrJsonLine([
      'Checking connectivity to the model hosters',
      '{"text":"hello","confidence":0.9}',
      'Creating model: PP-OCRv5'
    ].join('\n'))).toBe('{"text":"hello","confidence":0.9}')
  })

  test('Paddle log-only failures are ANSI-stripped', () => {
    const failure = classifyOcrProviderFailure(new Error(
      'PaddleOCR exited with code 1 for page.png.\n\u001B[31mChecking connectivity to the model hosters\u001B[0m\nCreating model: PP-OCRv5\nResized image size exceeds max_side_limit'
    ))

    expect(failure.message).not.toContain('\u001B[')
  })

  test('Paddle signal failures include signal context and stripped details', () => {
    const summary = summarizePaddleFailure('page.png', {
      exitCode: 138,
      stdout: '\u001B[31mCreating model: PP-OCRv5_server_det\u001B[0m',
      stderr: 'Resized image size exceeds max_side_limit'
    })

    expect(summary).toContain('SIGBUS')
    expect(summary).toContain('Resized image size exceeds max_side_limit')
    expect(summary).toContain('Creating model: PP-OCRv5_server_det')
    expect(summary).not.toContain('\u001B[')
  })

  test('Paddle failure summaries include model profile and max side attempts', () => {
    const failure = classifyOcrProviderFailure(new Error(
      'PaddleOCR failed for page.png after attempts: auto/3200px, auto/2400px, mobile/1800px.\nPaddleOCR exited with code 138 (SIGBUS) for page.png.'
    ))

    expect(failure.message).toContain('mobile/1800px')
  })

  test('Paddle native crash exit codes are retryable by the local runner', () => {
    expect(isPaddleNativeCrashExitCode(138)).toBe(true)
    expect(isPaddleNativeCrashExitCode(137)).toBe(true)
    expect(isPaddleNativeCrashExitCode(139)).toBe(true)
    expect(isPaddleNativeCrashExitCode(1)).toBe(false)
  })

  test('Paddle prepared image paths include the max-side attempt size', () => {
    expect(buildPaddlePreparedImagePath('/tmp/source/document.jpg', '/tmp/work', 2400)).toBe('/tmp/work/document-paddle-2400.jpg')
    expect(buildPaddlePreparedImagePath('/tmp/source/document', '/tmp/work', 1800)).toBe('/tmp/work/document-paddle-1800.jpg')
  })

  test('Paddle image dimensions parse ImageMagick identify output', () => {
    expect(parsePaddleImageDimensions('3923 4656')).toEqual({ width: 3923, height: 4656 })
    expect(parsePaddleImageDimensions('0 4656')).toBeUndefined()
    expect(parsePaddleImageDimensions('not dimensions')).toBeUndefined()
  })

  test('AWS Textract sync document payload is written through file URI', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-resume-contracts-'))
    try {
      const inputPath = join(tempDir, 'document.jpg')
      await Bun.write(inputPath, new Uint8Array([0, 1, 2, 3, 4, 5]))

      const documentArg = await writeAwsTextractSyncDocumentFile(inputPath, tempDir)
      expect(documentArg).toStartWith('file://')
      expect(documentArg).not.toContain('AAECAwQF')

      const payload = await Bun.file(documentArg.slice('file://'.length)).json() as { Bytes?: unknown }
      expect(payload.Bytes).toBe(Buffer.from([0, 1, 2, 3, 4, 5]).toString('base64'))
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })
})
