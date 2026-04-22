import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runOcr } from '~/cli/commands/process-steps/step-2-ocr/run-ocr'
import { getExtractLimits } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { ExtractionOptionsSchema, type DocumentMetadata } from '~/types'
import { ensurePageImageFixture } from '../../test-utils/test-helpers'
import { validateData } from '~/utils/validate/validation'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
})

const createGlmOptions = (filePath: string, outputDir: string) => validateData(ExtractionOptionsSchema, {
  filePath,
  outputDir,
  glmOcrModel: 'glm-ocr'
}, 'GLM OCR extraction options')

const createOpenAIOptions = (filePath: string, outputDir: string) => validateData(ExtractionOptionsSchema, {
  filePath,
  outputDir,
  openaiOcrModel: 'gpt-5.4-nano'
}, 'OpenAI OCR extraction options')

const createStep1Metadata = (overrides: Partial<DocumentMetadata>): DocumentMetadata => ({
  title: 'OCR Fixture',
  slug: 'ocr-fixture',
  author: 'AutoShow',
  pageCount: 1,
  format: 'png',
  fileSize: 1,
  ...overrides
})

const padFileToSize = async (filePath: string, targetBytes: number): Promise<void> => {
  const existing = Buffer.from(await Bun.file(filePath).arrayBuffer())
  if (existing.length >= targetBytes) {
    await Bun.write(filePath, existing)
    return
  }

  await Bun.write(filePath, Buffer.concat([existing, Buffer.alloc(targetBytes - existing.length)]))
}

describe('getExtractLimits', () => {
  test('returns GLM OCR format-specific image and PDF limits', () => {
    expect(getExtractLimits('glm', 'glm-ocr', 'png')).toEqual(expect.objectContaining({
      effectiveBytes: 10485760,
      imageBytes: 10485760,
      pdfBytes: 52428800,
      pageCount: 100
    }))

    expect(getExtractLimits('glm', 'glm-ocr', 'pdf')).toEqual(expect.objectContaining({
      effectiveBytes: 52428800,
      imageBytes: 10485760,
      pdfBytes: 52428800,
      pageCount: 100
    }))
  })

  test('returns note-only limits for Mistral OCR and Firecrawl', () => {
    const mistralLimits = getExtractLimits('mistral', 'mistral-ocr-2512', 'pdf')
    expect(mistralLimits.effectiveBytes).toBeUndefined()
    expect(mistralLimits.pageCount).toBeUndefined()
    expect(mistralLimits.notes).toContain('No Mistral OCR file-size or page-count limits were found')

    const firecrawlLimits = getExtractLimits('firecrawl', 'firecrawl', 'html')
    expect(firecrawlLimits.effectiveBytes).toBeUndefined()
    expect(firecrawlLimits.pageCount).toBeUndefined()
    expect(firecrawlLimits.notes).toContain('No Firecrawl article-extraction file-size or page-count limits were found')
  })

  test('returns OpenAI OCR PDF limits from the bundled OpenAI reference', () => {
    expect(getExtractLimits('openai', 'gpt-5.4-nano', 'pdf')).toEqual(expect.objectContaining({
      effectiveBytes: 52428800,
      pdfBytes: 52428800
    }))
  })
})

describe('GLM OCR runtime limits', () => {
  test('uses the actual image file size instead of stale step1 metadata', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-limits-image-'))
    tempDirs.push(tempDir)

    const imagePath = join(tempDir, 'oversized.png')
    await ensurePageImageFixture(imagePath)
    await padFileToSize(imagePath, 10485761)

    const opts = createGlmOptions(imagePath, tempDir)
    const step1Metadata = createStep1Metadata({
      format: 'png',
      fileSize: 1
    })

    await expect(runOcr(imagePath, step1Metadata, opts)).rejects.toThrow(
      'GLM OCR supports image inputs up to 10.0 MB based on project/links/bun-links.md.'
    )
  })

  test('uses the actual PDF file size instead of stale step1 metadata', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-limits-pdf-'))
    tempDirs.push(tempDir)

    const pdfPath = join(tempDir, 'oversized.pdf')
    await Bun.write(pdfPath, await Bun.file('input/examples/document/1-document.pdf').arrayBuffer())
    await padFileToSize(pdfPath, 52428801)

    const opts = createGlmOptions(pdfPath, tempDir)
    const step1Metadata = createStep1Metadata({
      format: 'pdf',
      pageCount: 1,
      fileSize: 1
    })

    await expect(runOcr(pdfPath, step1Metadata, opts)).rejects.toThrow(
      'GLM OCR supports PDF inputs up to 50.0 MB based on project/links/bun-links.md.'
    )
  })

  test('rejects PDFs above the documented page-count limit', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-limits-pages-'))
    tempDirs.push(tempDir)

    const pdfPath = join(tempDir, 'too-many-pages.pdf')
    await Bun.write(pdfPath, 'not actually a pdf')

    const opts = createGlmOptions(pdfPath, tempDir)
    const step1Metadata = createStep1Metadata({
      format: 'pdf',
      pageCount: 101,
      fileSize: 128
    })

    await expect(runOcr(pdfPath, step1Metadata, opts)).rejects.toThrow(
      'GLM OCR supports PDF inputs up to 100 pages based on project/links/bun-links.md.'
    )
  })

  test('rejects OpenAI OCR PDFs above the documented file-size limit before making an API call', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-limits-openai-pdf-'))
    tempDirs.push(tempDir)

    const pdfPath = join(tempDir, 'oversized-openai.pdf')
    await Bun.write(pdfPath, await Bun.file('input/examples/document/1-document.pdf').arrayBuffer())
    await padFileToSize(pdfPath, 52428801)

    const opts = createOpenAIOptions(pdfPath, tempDir)
    const step1Metadata = createStep1Metadata({
      format: 'pdf',
      pageCount: 1,
      fileSize: 1
    })

    await expect(runOcr(pdfPath, step1Metadata, opts)).rejects.toThrow(
      'OpenAI OCR supports PDF inputs up to 50.0 MB based on project/links/openai-links.md.'
    )
  })
})
