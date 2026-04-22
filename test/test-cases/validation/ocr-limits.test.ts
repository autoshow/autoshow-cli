import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, open, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runOcr } from '~/cli/commands/process-steps/step-2-ocr/run-ocr'
import { getExtractLimits } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { ExtractionOptionsSchema, type DocumentMetadata } from '~/types'
import { ensurePageImageFixture } from '../../test-utils/test-helpers'
import { validateData } from '~/utils/validate/validation'
import { exec } from '~/utils/cli-utils'
import { ANTHROPIC_OCR_IMAGE_BYTES } from '~/cli/commands/process-steps/step-2-ocr/ocr-services/anthropic-ocr/anthropic-ocr'

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

const createAnthropicOptions = (filePath: string, outputDir: string, password?: string) => validateData(ExtractionOptionsSchema, {
  filePath,
  outputDir,
  anthropicOcrModel: 'claude-haiku-4-5',
  ...(password ? { password } : {})
}, 'Anthropic OCR extraction options')

const createGeminiOptions = (filePath: string, outputDir: string) => validateData(ExtractionOptionsSchema, {
  filePath,
  outputDir,
  geminiOcrModel: 'gemini-3.1-flash-lite-preview'
}, 'Gemini OCR extraction options')

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

  test('returns Gemini OCR Files API and PDF page limits from the bundled Gemini reference', () => {
    expect(getExtractLimits('gemini', 'gemini-3.1-flash-lite-preview', 'pdf')).toEqual(expect.objectContaining({
      effectiveBytes: 2147483648,
      pdfBytes: 2147483648,
      imageBytes: 2147483648,
      pageCount: 1000
    }))
  })

  test('returns Anthropic OCR image limits and note-only PDF guidance from the bundled Claude reference', () => {
    expect(getExtractLimits('anthropic', 'claude-haiku-4-5', 'png')).toEqual(expect.objectContaining({
      effectiveBytes: 5242880,
      imageBytes: 5242880
    }))

    const pdfLimits = getExtractLimits('anthropic', 'claude-haiku-4-5', 'pdf')
    expect(pdfLimits.effectiveBytes).toBeUndefined()
    expect(pdfLimits.pageCount).toBeUndefined()
    expect(pdfLimits.notes).toContain('standard unencrypted PDF support')
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
      'GLM OCR supports image inputs up to 10.0 MB based on project/links/glm-all-links.md.'
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
      'GLM OCR supports PDF inputs up to 50.0 MB based on project/links/glm-all-links.md.'
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
      'GLM OCR supports PDF inputs up to 100 pages based on project/links/glm-all-links.md.'
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
      'OpenAI OCR supports PDF inputs up to 50.0 MB based on project/links/openai-all-links.md.'
    )
  })

  test('rejects Gemini OCR inputs above the Files API file-size limit before making an API call', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-limits-gemini-size-'))
    tempDirs.push(tempDir)

    const pdfPath = join(tempDir, 'oversized-gemini.pdf')
    await Bun.write(pdfPath, await Bun.file('input/examples/document/1-document.pdf').arrayBuffer())
    const fileHandle = await open(pdfPath, 'r+')
    try {
      await fileHandle.truncate(2147483649)
    } finally {
      await fileHandle.close()
    }

    const opts = createGeminiOptions(pdfPath, tempDir)
    const step1Metadata = createStep1Metadata({
      format: 'pdf',
      pageCount: 1,
      fileSize: 1
    })

    await expect(runOcr(pdfPath, step1Metadata, opts)).rejects.toThrow(
      'Gemini OCR supports PDF inputs up to 2.00 GB based on project/links/gemini-all-links.md.'
    )
  })

  test('rejects Gemini OCR PDFs above the documented page-count limit', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-limits-gemini-pages-'))
    tempDirs.push(tempDir)

    const pdfPath = join(tempDir, 'too-many-gemini-pages.pdf')
    await Bun.write(pdfPath, 'not actually a pdf')

    const opts = createGeminiOptions(pdfPath, tempDir)
    const step1Metadata = createStep1Metadata({
      format: 'pdf',
      pageCount: 1001,
      fileSize: 128
    })

    await expect(runOcr(pdfPath, step1Metadata, opts)).rejects.toThrow(
      'Gemini OCR supports PDF inputs up to 1000 pages based on project/links/gemini-all-links.md.'
    )
  })

  test('rejects Anthropic OCR images above the documented 5 MB cap before making an API call', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-limits-anthropic-image-'))
    tempDirs.push(tempDir)

    const imagePath = join(tempDir, 'oversized-anthropic.png')
    await ensurePageImageFixture(imagePath)
    await padFileToSize(imagePath, ANTHROPIC_OCR_IMAGE_BYTES + 1)

    const opts = createAnthropicOptions(imagePath, tempDir)
    const step1Metadata = createStep1Metadata({
      format: 'png',
      fileSize: 1
    })

    await expect(runOcr(imagePath, step1Metadata, opts)).rejects.toThrow(
      'Anthropic OCR supports image inputs up to 5.0 MB based on project/links/claude-all-links.md.'
    )
  })

  test('rejects Anthropic OCR when a PDF password is provided', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-limits-anthropic-password-'))
    tempDirs.push(tempDir)

    const pdfPath = join(tempDir, 'password.pdf')
    await Bun.write(pdfPath, await Bun.file('input/examples/document/1-document.pdf').arrayBuffer())

    const opts = createAnthropicOptions(pdfPath, tempDir, 'secret')
    const step1Metadata = createStep1Metadata({
      format: 'pdf',
      pageCount: 1,
      fileSize: 1
    })

    await expect(runOcr(pdfPath, step1Metadata, opts)).rejects.toThrow(
      'Anthropic OCR only supports standard unencrypted PDFs. Remove --password and decrypt the PDF before using --anthropic-ocr.'
    )
  })

  test('rejects encrypted PDFs for Anthropic OCR', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-limits-anthropic-encrypted-'))
    tempDirs.push(tempDir)

    const encryptedPdfPath = join(tempDir, 'encrypted.pdf')
    const encryption = await exec('mutool', [
      'clean',
      '-E', 'aes-256',
      '-U', 'userpass',
      '-O', 'ownerpass',
      'input/examples/document/1-document.pdf',
      encryptedPdfPath
    ])

    expect(encryption.exitCode).toBe(0)

    const step1Metadata = createStep1Metadata({
      format: 'pdf',
      pageCount: 1,
      fileSize: 1
    })

    await expect(runOcr(
      encryptedPdfPath,
      step1Metadata,
      createAnthropicOptions(encryptedPdfPath, tempDir)
    )).rejects.toThrow(
      'Anthropic OCR only supports standard unencrypted PDFs. Decrypt the PDF before using --anthropic-ocr.'
    )
  })
})
