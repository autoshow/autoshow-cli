import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { convertDocumentToPdf, getDocumentInfo, isPdfEncryptedViaQpdf, showPdfObject } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import type { DocumentMetadata, ExtractionOptions, LocalExtractOcrEngine, PageResult } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/logger'
import { assertNever } from '~/utils/validate/assert-never'
import { runOcrmypdf } from './ocr-local/ocrmypdf/run-ocrmypdf'
import { buildPaddleOcrPageFn } from './ocr-local/paddle-ocr/run-paddle-ocr'
import { processPages } from './ocr-utils/page-processor'

export const convertEpubToPdfForOcr = async (
  filePath: string,
  tempDir: string,
  password?: string
): Promise<{ pdfPath: string, conversionChain: string[] }> => {
  const fallbackPdfPath = join(tempDir, 'epub-ocr.pdf')
  const converted = await convertDocumentToPdf(filePath, fallbackPdfPath, password)
  if (converted.exitCode !== 0) {
    throw new Error(converted.stderr || converted.stdout || 'mutool convert failed')
  }

  const outFile = Bun.file(fallbackPdfPath)
  if (!(await outFile.exists())) {
    throw new Error(`mutool did not produce PDF output for ${filePath}`)
  }

  return { pdfPath: fallbackPdfPath, conversionChain: ['mutool'] }
}

export const resolvePdfPageCount = async (
  filePath: string,
  password?: string,
  fallbackPageCount?: number
): Promise<number | undefined> => {
  try {
    const info = await getDocumentInfo(filePath, password)
    return Math.max(1, info.pageCount)
  } catch {
    return typeof fallbackPageCount === 'number' ? Math.max(1, fallbackPageCount) : undefined
  }
}

export const isPdfEncrypted = async (
  filePath: string,
  password?: string
): Promise<boolean> => {
  try {
    const qpdfResult = await isPdfEncryptedViaQpdf(filePath)
    if (qpdfResult !== undefined) return qpdfResult
  } catch {
    // qpdf unavailable or errored, fall through to mutool
  }
  try {
    const result = await showPdfObject(filePath, 'trailer/Encrypt', password)
    if (result.exitCode !== 0) {
      return false
    }

    const combined = `${result.stdout}\n${result.stderr}`.trim()
    return combined.length > 0 && combined !== 'null'
  } catch {
    return false
  }
}

export const buildHostedUploadMetadata = async (
  filePath: string,
  baseMetadata: DocumentMetadata,
  format: DocumentMetadata['format'],
  password?: string
): Promise<DocumentMetadata> => {
  const sourceStats = await stat(filePath)
  const pageCount = format === 'pdf'
    ? await resolvePdfPageCount(filePath, password, baseMetadata.pageCount)
    : 1

  return {
    ...baseMetadata,
    format,
    fileSize: sourceStats.size,
    pageCount: pageCount ?? (format === 'pdf' ? baseMetadata.pageCount : 1)
  }
}

const runOcrmypdfWithAutoPdf = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<{ pages: PageResult[], extractionMethod: string }> => {
  const imageFormats = new Set(['png', 'jpg', 'tif', 'webp', 'bmp', 'gif'])
  if (step1Metadata.format === 'pdf' || imageFormats.has(step1Metadata.format)) {
    return await runOcrmypdf(filePath, opts, { pageCount: step1Metadata.pageCount })
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocrmypdf-convert-'))
  const convertedPdfPath = join(tempDir, 'input.pdf')

  try {
    l.write('info', `Converting ${step1Metadata.format.toUpperCase()} to PDF for OCRmyPDF`)
    const convertResult = await convertDocumentToPdf(filePath, convertedPdfPath, opts.password)
    if (convertResult.exitCode !== 0) {
      throw new Error(convertResult.stderr || convertResult.stdout || 'mutool convert failed')
    }
    return await runOcrmypdf(convertedPdfPath, opts, { pageCount: step1Metadata.pageCount })
  } catch (error) {
    throw CLIUsageError(`Failed to convert ${step1Metadata.format.toUpperCase()} to PDF for OCRmyPDF. ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export const runLocalPdfOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions,
  engine: LocalExtractOcrEngine
): Promise<{ pages: PageResult[], extractionMethod: string }> => {
  switch (engine) {
    case 'tesseract': {
      const pages = await processPages(filePath, step1Metadata.pageCount, opts)
      return { pages, extractionMethod: 'mutool+tesseract' }
    }
    case 'ocrmypdf': {
      return await runOcrmypdfWithAutoPdf(filePath, step1Metadata, opts)
    }
    case 'paddle-ocr': {
      const pages = await processPages(filePath, step1Metadata.pageCount, opts, {
        getOcrFn: async () => await buildPaddleOcrPageFn(opts)
      })
      return { pages, extractionMethod: 'mutool+paddle-ocr' }
    }
    default:
      assertNever(engine)
  }
}

export const runPdfOcr = async (
  pdfPath: string,
  tempMeta: DocumentMetadata,
  opts: ExtractionOptions,
  engine: LocalExtractOcrEngine
): Promise<{ pages: PageResult[], extractionMethod: string }> => {
  switch (engine) {
    case 'tesseract': {
      const pages = await processPages(pdfPath, tempMeta.pageCount, opts)
      return { pages, extractionMethod: 'pdf+tesseract' }
    }
    case 'ocrmypdf': {
      const r = await runOcrmypdf(pdfPath, opts, { pageCount: tempMeta.pageCount })
      return { pages: r.pages, extractionMethod: 'pdf+ocrmypdf' }
    }
    case 'paddle-ocr': {
      const pages = await processPages(pdfPath, tempMeta.pageCount, opts, {
        getOcrFn: async () => await buildPaddleOcrPageFn(opts)
      })
      return { pages, extractionMethod: 'pdf+paddle-ocr' }
    }
    default:
      assertNever(engine)
  }
}
