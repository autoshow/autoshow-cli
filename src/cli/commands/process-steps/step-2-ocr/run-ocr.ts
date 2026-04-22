import { validateData } from '~/utils/validate/validation'
import { assertNever } from '~/utils/validate/assert-never'
import * as l from '~/logger'
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, basename, extname } from 'node:path'
import { exec, commandExists } from '~/utils/cli-utils'
import {
  ExtractionMetadataSchema,
  ExtractionResultSchema,
  type DocumentMetadata,
  type ExtractionMetadata,
  type HostedExtractOcrEngine,
  type HostedOcrRun,
  type ExtractionOptions,
  type ExtractionResult,
  type LocalExtractOcrEngine,
  type PageResult
} from '~/types'
import { ensureTesseractSetup, ocrImage } from './ocr-utils/tesseract-utils'
import { processPages } from './ocr-utils/page-processor'
import { runOcrmypdf } from './ocr-local/ocrmypdf/run-ocrmypdf'
import { buildPaddleOcrPageFn, runPaddleOcrOnImage } from './ocr-local/paddle-ocr/run-paddle-ocr'
import { runMistralOcr } from './ocr-services/mistral-ocr/run-mistral-ocr'
import { runGlmOcr } from './ocr-services/glm-ocr/run-glm-ocr'
import { runOpenAIOcr } from './ocr-services/openai-ocr/run-openai-ocr'
import { runAnthropicOcr } from './ocr-services/anthropic-ocr/run-anthropic-ocr'
import { runGeminiOcr } from './ocr-services/gemini-ocr/run-gemini-ocr'
import { convertDocumentToPdf, getDocumentInfo, showPdfObject } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { extractDocx, extractPptx, extractXlsx, extractOdf, type ZipXmlPage } from '~/cli/commands/process-steps/step-1-download/document/zip-xml-utils'
import { CLIUsageError } from '~/utils/error-handler'
import type { ZipXmlFormat } from '~/types'
import { ensureMistralOcrSetup } from '~/cli/commands/process-steps/step-2-ocr/ocr-services/mistral-ocr/mistral'
import { ensureGlmOcrSetup } from './ocr-services/glm-ocr/glm'
import { ensureOpenAIOcrSetup } from './ocr-services/openai-ocr/openai-ocr'
import {
  ANTHROPIC_OCR_LIMIT_SOURCE,
  ensureAnthropicOcrSetup
} from './ocr-services/anthropic-ocr/anthropic-ocr'
import {
  ensureGeminiOcrSetup,
  GEMINI_FILE_UPLOAD_BYTES,
  GEMINI_OCR_LIMIT_SOURCE,
  GEMINI_PDF_PAGE_COUNT_LIMIT
} from './ocr-services/gemini-ocr/gemini'
import { runEpubBunInspect, runEpubCalibreInspect } from './epub'
import { buildEpubTextOutput, type EpubArtifactFile } from './epub/export'
import { buildPdfChapterArtifacts } from './pdf/chapters'
import { isOfficeTextUsable } from './ocr-utils/page-triage'
import { estimateTokens } from '~/utils/text-utils'
import { getExtractLimits } from '~/cli/commands/setup-and-utilities/models/model-loader'

const ZIP_XML_FORMATS = new Set(['docx', 'pptx', 'xlsx', 'odf'] as const)
const IMAGE_FORMATS = new Set(['png', 'jpg', 'tif', 'webp', 'bmp', 'gif'])
const isZipXmlFormat = (f: string): f is ZipXmlFormat => ZIP_XML_FORMATS.has(f as ZipXmlFormat)

const buildCombinedText = (
  pages: PageResult[],
  pageSeparator: string,
  includePageLabels = true
): string => {
  return pages
    .map(page => includePageLabels ? `Page ${page.pageNumber}\n${page.text.trim()}` : page.text.trim())
    .join(pageSeparator)
    .trim()
}

const zipXmlPageToPageResult = (p: ZipXmlPage): PageResult => ({
  pageNumber: p.page,
  method: 'text',
  text: p.text
})

const runZipXmlExtract = async (filePath: string, format: ZipXmlFormat): Promise<{ pages: PageResult[], extractionMethod: string }> => {
  switch (format) {
    case 'docx': {
      const docxResult = await extractDocx(filePath)
      return { pages: docxResult.pages.map(zipXmlPageToPageResult), extractionMethod: 'docx' }
    }
    case 'pptx': {
      const pptxResult = await extractPptx(filePath)
      return { pages: pptxResult.pages.map(zipXmlPageToPageResult), extractionMethod: 'pptx' }
    }
    case 'xlsx': {
      const xlsxResult = await extractXlsx(filePath)
      return { pages: xlsxResult.pages.map(zipXmlPageToPageResult), extractionMethod: 'xlsx' }
    }
    case 'odf': {
      const odfResult = await extractOdf(filePath)
      return { pages: odfResult.pages.map(zipXmlPageToPageResult), extractionMethod: 'odf' }
    }
  }
}

const resolveExtractEngine = (opts: ExtractionOptions): LocalExtractOcrEngine => {
  if (opts.useOcrmypdf === true) return 'ocrmypdf'
  if (opts.usePaddleOcr === true) return 'paddle-ocr'
  return 'tesseract'
}

const hasMistralOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.mistralOcrModel === 'string' && opts.mistralOcrModel.length > 0

const hasGlmOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.glmOcrModel === 'string' && opts.glmOcrModel.length > 0

const hasOpenAIOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.openaiOcrModel === 'string' && opts.openaiOcrModel.length > 0

const hasAnthropicOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.anthropicOcrModel === 'string' && opts.anthropicOcrModel.length > 0

const hasGeminiOcr = (opts: ExtractionOptions): boolean =>
  typeof opts.geminiOcrModel === 'string' && opts.geminiOcrModel.length > 0

const hasHostedOcr = (opts: ExtractionOptions): boolean =>
  hasMistralOcr(opts) || hasGlmOcr(opts) || hasOpenAIOcr(opts) || hasAnthropicOcr(opts) || hasGeminiOcr(opts)

const hasOcrFlag = (opts: ExtractionOptions): boolean =>
  opts.useOcrmypdf === true || opts.usePaddleOcr === true || hasHostedOcr(opts)

const hasEpubExportFlags = (opts: ExtractionOptions): boolean =>
  opts.epubChapterFiles === true || typeof opts.epubChunkLimitChars === 'number'

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < (1024 * 1024)) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < (1024 * 1024 * 1024)) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

const formatHostedOcrLabel = (service: 'mistral' | 'glm' | 'openai' | 'anthropic' | 'gemini'): string => {
  switch (service) {
    case 'glm':
      return 'GLM OCR'
    case 'mistral':
      return 'Mistral OCR'
    case 'openai':
      return 'OpenAI OCR'
    case 'anthropic':
      return 'Anthropic OCR'
    case 'gemini':
      return 'Gemini OCR'
  }
}

const getHostedOcrLimitSource = (service: 'mistral' | 'glm' | 'openai' | 'anthropic' | 'gemini'): string => {
  switch (service) {
    case 'openai':
      return 'project/links/openai-all-links.md'
    case 'anthropic':
      return ANTHROPIC_OCR_LIMIT_SOURCE
    case 'gemini':
      return GEMINI_OCR_LIMIT_SOURCE
    case 'glm':
      return 'project/links/glm-all-links.md'
    default:
      return 'project/links/all-all-links.md'
  }
}

const resolvePdfPageCount = async (
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

const isPdfEncrypted = async (
  filePath: string,
  password?: string
): Promise<boolean> => {
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

const buildHostedUploadMetadata = async (
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

// Convert document to PDF via LibreOffice (for office/RTF)
const convertToLibreOfficePdf = async (
  filePath: string,
  tempDir: string
): Promise<string> => {
  if (!commandExists('soffice')) {
    throw new Error(
      'LibreOffice is required to convert this document type. ' +
      'Install it with: bun as setup'
    )
  }

  const result = await exec('soffice', [
    '--headless', '--convert-to', 'pdf', '--outdir', tempDir, filePath
  ])

  if (result.exitCode !== 0) {
    throw new Error(
      `LibreOffice conversion failed for ${filePath}: ${result.stderr || result.stdout || `exit code ${result.exitCode}`}`
    )
  }

  // LibreOffice names the output based on the input filename
  const inputBasename = basename(filePath, extname(filePath))
  const pdfPath = join(tempDir, `${inputBasename}.pdf`)

  const pdfFile = Bun.file(pdfPath)
  if (!(await pdfFile.exists())) {
    // Try any PDF file in tempDir
    const entries = await readdir(tempDir)
    const pdf = entries.find(e => e.endsWith('.pdf'))
    if (!pdf) {
      throw new Error(`LibreOffice did not produce a PDF output for ${filePath}`)
    }
    return join(tempDir, pdf)
  }

  return pdfPath
}

const convertEpubToPdfForOcr = async (
  filePath: string,
  tempDir: string,
  password?: string
): Promise<{ pdfPath: string, conversionChain: string[] }> => {
  try {
    const pdfPath = await convertToLibreOfficePdf(filePath, tempDir)
    return { pdfPath, conversionChain: ['libreoffice'] }
  } catch (error) {
    l.warn(`LibreOffice EPUB conversion failed; retrying with mutool (${error instanceof Error ? error.message : String(error)})`)
  }

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

// Natural numeric sort comparator for CBZ image filenames
const naturalCompare = (a: string, b: string): number => {
  const re = /(\d+)|(\D+)/g
  const partsA = a.match(re) ?? []
  const partsB = b.match(re) ?? []
  const len = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < len; i++) {
    const pa = partsA[i] ?? ''
    const pb = partsB[i] ?? ''
    const na = parseInt(pa, 10)
    const nb = parseInt(pb, 10)
    if (!isNaN(na) && !isNaN(nb)) {
      if (na !== nb) return na - nb
    } else {
      const cmp = pa.localeCompare(pb)
      if (cmp !== 0) return cmp
    }
  }
  return 0
}

const IMAGE_ARCHIVE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tif', '.tiff'])

// Extract image entries from CBZ (ZIP archive), return sorted paths
const extractCbzImages = async (
  filePath: string,
  tempDir: string
): Promise<string[]> => {
  const result = await exec('unzip', ['-o', filePath, '-d', tempDir])
  if (result.exitCode !== 0) {
    throw new Error(
      `Failed to extract CBZ archive ${filePath}: ${result.stderr || result.stdout}`
    )
  }

  // Collect all image files recursively, flatten, sort by full path using natural sort
  const collectImages = async (dir: string): Promise<string[]> => {
    const images: string[] = []
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        images.push(...await collectImages(fullPath))
      } else if (IMAGE_ARCHIVE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        images.push(fullPath)
      }
    }
    return images
  }

  const images = await collectImages(tempDir)

  // Sort by full path using natural numeric sort
  images.sort((a, b) => naturalCompare(a, b))

  return images
}

// Normalize non-standard images (WebP, BMP) to PNG for OCR compatibility
const normalizeImageForOcr = async (
  imagePath: string,
  tempDir: string
): Promise<string> => {
  const ext = extname(imagePath).toLowerCase()
  if (ext === '.webp' || ext === '.bmp') {
    if (!commandExists('convert')) {
      // ImageMagick not available - use as-is
      l.warn(`ImageMagick not found; using ${ext} directly which may affect OCR quality`)
      return imagePath
    }
    const pngPath = join(tempDir, `${basename(imagePath, ext)}.png`)
    const result = await exec('convert', [imagePath, pngPath])
    if (result.exitCode !== 0) {
      l.warn(`ImageMagick conversion failed for ${imagePath}: ${result.stderr}`)
      return imagePath
    }
    return pngPath
  }
  return imagePath
}

const runOcrmypdfWithAutoPdf = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<{ pages: PageResult[], extractionMethod: string }> => {
  const imageFormats = new Set(['png', 'jpg', 'tif', 'webp', 'bmp', 'gif'])
  if (step1Metadata.format === 'pdf' || imageFormats.has(step1Metadata.format)) {
    return await runOcrmypdf(filePath, opts)
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocrmypdf-convert-'))
  const convertedPdfPath = join(tempDir, 'input.pdf')

  try {
    l.info(`Converting ${step1Metadata.format.toUpperCase()} to PDF for OCRmyPDF`)
    const convertResult = await convertDocumentToPdf(filePath, convertedPdfPath, opts.password)
    if (convertResult.exitCode !== 0) {
      throw new Error(convertResult.stderr || convertResult.stdout || 'mutool convert failed')
    }
    return await runOcrmypdf(convertedPdfPath, opts)
  } catch (error) {
    throw CLIUsageError(`Failed to convert ${step1Metadata.format.toUpperCase()} to PDF for OCRmyPDF. ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

const warnTesseractOnlyFlags = (engine: Exclude<LocalExtractOcrEngine, 'tesseract'>, opts: ExtractionOptions): void => {
  if (opts.psm !== 3) {
    l.warn(`Flag --psm is Tesseract-specific and has no effect with the ${engine} engine`)
  }
  if (opts.oem !== 1) {
    l.warn(`Flag --oem is Tesseract-specific and has no effect with the ${engine} engine`)
  }
  if (opts.preserveInterwordSpaces === true) {
    l.warn(`Flag --preserve-spaces is Tesseract-specific and has no effect with the ${engine} engine`)
  }
}

const warnHostedOnlyFlags = (engineName: HostedExtractOcrEngine, opts: ExtractionOptions): void => {
  if (opts.psm !== 3) {
    l.warn(`Flag --psm is Tesseract-specific and has no effect with the ${engineName} engine`)
  }
  if (opts.oem !== 1) {
    l.warn(`Flag --oem is Tesseract-specific and has no effect with the ${engineName} engine`)
  }
  if (opts.preserveInterwordSpaces === true) {
    l.warn(`Flag --preserve-spaces is Tesseract-specific and has no effect with the ${engineName} engine`)
  }
}

const warnMistralOnlyFlags = (opts: ExtractionOptions): void => {
  warnHostedOnlyFlags('mistral-ocr', opts)
}

const warnGlmOnlyFlags = (opts: ExtractionOptions): void => {
  warnHostedOnlyFlags('glm-ocr', opts)
}

const warnOpenAIOnlyFlags = (opts: ExtractionOptions): void => {
  warnHostedOnlyFlags('openai-ocr', opts)
}

const warnAnthropicOnlyFlags = (opts: ExtractionOptions): void => {
  warnHostedOnlyFlags('anthropic-ocr', opts)
}

const warnGeminiOnlyFlags = (opts: ExtractionOptions): void => {
  warnHostedOnlyFlags('gemini-ocr', opts)
}

// Run OCR on a single image and return a PageResult
const ocrSingleImage = async (
  imagePath: string,
  pageNumber: number,
  opts: ExtractionOptions,
  engine: LocalExtractOcrEngine,
  tempDir: string
): Promise<PageResult> => {
  const normalizedPath = await normalizeImageForOcr(imagePath, tempDir)

  switch (engine) {
    case 'tesseract': {
      await ensureTesseractSetup()
      const extraConfig = opts.preserveInterwordSpaces ? { preserve_interword_spaces: 1 } : undefined
      const ocr = await ocrImage(normalizedPath, opts.languages, opts.oem, opts.psm, 'text', extraConfig)
      return {
        pageNumber,
        method: 'ocr',
        text: ocr.text,
        ...(ocr.confidence !== undefined ? { confidence: ocr.confidence } : {})
      }
    }
    case 'ocrmypdf': {
      const r = await runOcrmypdf(normalizedPath, opts)
      const combined = r.pages.map(p => p.text).join('\n').trim()
      return { pageNumber, method: 'ocr', text: combined }
    }
    case 'paddle-ocr': {
      const ocr = await runPaddleOcrOnImage(normalizedPath)
      return {
        pageNumber,
        method: 'ocr',
        text: ocr.text,
        ...(ocr.confidence !== undefined ? { confidence: ocr.confidence } : {})
      }
    }
    default:
      assertNever(engine)
  }
}

// Map engine to extractionMethod suffix
const engineSuffix = (engine: LocalExtractOcrEngine): string => {
  switch (engine) {
    case 'tesseract': return 'tesseract'
    case 'ocrmypdf': return 'ocrmypdf'
    case 'paddle-ocr': return 'paddle-ocr'
  }
}

const getHostedDirectImageSupportError = (engine: HostedExtractOcrEngine): string => {
  if (engine === 'glm-ocr') {
    return 'The --glm-ocr engine supports PDF and standard image files (PNG/JPG) only.'
  }
  if (engine === 'mistral-ocr') {
    return 'The --mistral-ocr engine supports PDF and standard image files (PNG/JPG/TIF) only.'
  }
  if (engine === 'anthropic-ocr') {
    return 'The --anthropic-ocr engine supports PDF and PNG/JPG/WEBP/GIF images directly. Convert BMP/TIF images to PNG/JPG first, or install ImageMagick so AutoShow can normalize them automatically.'
  }
  if (engine === 'gemini-ocr') {
    return 'The --gemini-ocr engine supports PDF and PNG/JPG/WEBP/BMP images directly. Convert GIF/TIF images to PNG/JPG first, or install ImageMagick so AutoShow can normalize them automatically.'
  }
  return 'The --openai-ocr engine supports PDF and PNG/JPG/WEBP/GIF images directly. Convert BMP/TIF images to PNG/JPG first, or install ImageMagick so AutoShow can normalize them automatically.'
}

const assertSupportedHostedDirectImageFormat = (
  format: string,
  engine: HostedExtractOcrEngine
): void => {
  const supportedFormats = engine === 'glm-ocr'
    ? new Set(['png', 'jpg'])
    : engine === 'mistral-ocr'
      ? new Set(['png', 'jpg', 'tif'])
      : engine === 'anthropic-ocr'
        ? new Set(['png', 'jpg', 'webp', 'gif'])
      : engine === 'gemini-ocr'
        ? new Set(['png', 'jpg', 'webp', 'bmp'])
      : new Set(['png', 'jpg', 'webp', 'gif'])

  if (!supportedFormats.has(format)) {
    throw CLIUsageError(getHostedDirectImageSupportError(engine))
  }
}

const normalizeHostedDirectImageInput = async (
  imagePath: string,
  engine: HostedExtractOcrEngine,
  tempDir: string,
  outputStem: string
): Promise<{ filePath: string, format: DocumentMetadata['format'] }> => {
  const ext = extname(imagePath).toLowerCase()
  const normalizedFormat = ext === '.jpeg'
    ? 'jpg'
    : ext === '.tiff'
      ? 'tif'
      : ext.slice(1).toLowerCase()

  if (engine !== 'openai-ocr') {
    if (engine === 'anthropic-ocr') {
      if (normalizedFormat === 'bmp' || normalizedFormat === 'tif') {
        if (!commandExists('convert')) {
          throw CLIUsageError(getHostedDirectImageSupportError(engine))
        }

        const pngPath = join(tempDir, `${outputStem}.png`)
        const result = await exec('convert', [imagePath, pngPath])
        if (result.exitCode !== 0) {
          throw CLIUsageError(`Failed to normalize ${basename(imagePath)} for --anthropic-ocr. ${result.stderr || result.stdout || 'ImageMagick convert failed.'}`)
        }

        return { filePath: pngPath, format: 'png' }
      }
    }

    if (engine === 'gemini-ocr') {
      if (normalizedFormat === 'gif' || normalizedFormat === 'tif') {
        if (!commandExists('convert')) {
          throw CLIUsageError(getHostedDirectImageSupportError(engine))
        }

        const pngPath = join(tempDir, `${outputStem}.png`)
        const result = await exec('convert', [imagePath, pngPath])
        if (result.exitCode !== 0) {
          throw CLIUsageError(`Failed to normalize ${basename(imagePath)} for --gemini-ocr. ${result.stderr || result.stdout || 'ImageMagick convert failed.'}`)
        }

        return { filePath: pngPath, format: 'png' }
      }
    }
    assertSupportedHostedDirectImageFormat(normalizedFormat, engine)
    return { filePath: imagePath, format: normalizedFormat as DocumentMetadata['format'] }
  }

  if (normalizedFormat === 'png' || normalizedFormat === 'jpg' || normalizedFormat === 'webp' || normalizedFormat === 'gif') {
    return { filePath: imagePath, format: normalizedFormat }
  }

  if (normalizedFormat !== 'bmp' && normalizedFormat !== 'tif') {
    throw CLIUsageError(getHostedDirectImageSupportError(engine))
  }

  if (!commandExists('convert')) {
    throw CLIUsageError(getHostedDirectImageSupportError(engine))
  }

  const pngPath = join(tempDir, `${outputStem}.png`)
  const result = await exec('convert', [imagePath, pngPath])
  if (result.exitCode !== 0) {
    throw CLIUsageError(`Failed to normalize ${basename(imagePath)} for --openai-ocr. ${result.stderr || result.stdout || 'ImageMagick convert failed.'}`)
  }

  return { filePath: pngPath, format: 'png' }
}

const resolveHostedOcrSelection = (
  opts: ExtractionOptions
): { service: 'mistral' | 'glm' | 'openai' | 'anthropic' | 'gemini', model: string } | undefined => {
  if (hasMistralOcr(opts)) {
    return { service: 'mistral', model: opts.mistralOcrModel as string }
  }

  if (hasGlmOcr(opts)) {
    return { service: 'glm', model: opts.glmOcrModel as string }
  }

  if (hasOpenAIOcr(opts)) {
    return { service: 'openai', model: opts.openaiOcrModel as string }
  }

  if (hasAnthropicOcr(opts)) {
    return { service: 'anthropic', model: opts.anthropicOcrModel as string }
  }

  if (hasGeminiOcr(opts)) {
    return { service: 'gemini', model: opts.geminiOcrModel as string }
  }

  return undefined
}

const getHostedOcrEngine = (opts: ExtractionOptions): HostedExtractOcrEngine | undefined => {
  if (hasMistralOcr(opts)) return 'mistral-ocr'
  if (hasGlmOcr(opts)) return 'glm-ocr'
  if (hasOpenAIOcr(opts)) return 'openai-ocr'
  if (hasAnthropicOcr(opts)) return 'anthropic-ocr'
  if (hasGeminiOcr(opts)) return 'gemini-ocr'
  return undefined
}

const assertHostedOcrWithinLimits = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<void> => {
  const selection = resolveHostedOcrSelection(opts)
  if (!selection) return

  if (selection.service === 'gemini') {
    const inputLabel = step1Metadata.format === 'pdf' ? 'PDF' : 'image'
    const fileStats = await stat(filePath)
    if (fileStats.size > GEMINI_FILE_UPLOAD_BYTES) {
      throw CLIUsageError(
        `${formatHostedOcrLabel(selection.service)} supports ${inputLabel} inputs up to ${formatBytes(GEMINI_FILE_UPLOAD_BYTES)} based on ${getHostedOcrLimitSource(selection.service)}. ` +
        `Got ${formatBytes(fileStats.size)} for ${basename(filePath)}.`
      )
    }

    if (step1Metadata.format === 'pdf') {
      const pageCount = await resolvePdfPageCount(filePath, opts.password, step1Metadata.pageCount)
      if (typeof pageCount === 'number' && pageCount > GEMINI_PDF_PAGE_COUNT_LIMIT) {
        throw CLIUsageError(
          `${formatHostedOcrLabel(selection.service)} supports PDF inputs up to ${GEMINI_PDF_PAGE_COUNT_LIMIT} pages based on ${getHostedOcrLimitSource(selection.service)}. ` +
          `Got ${pageCount} pages for ${basename(filePath)}.`
        )
      }
    }

    return
  }

  if (selection.service === 'anthropic' && step1Metadata.format === 'pdf') {
    if (typeof opts.password === 'string' && opts.password.length > 0) {
      throw CLIUsageError('Anthropic OCR only supports standard unencrypted PDFs. Remove --password and decrypt the PDF before using --anthropic-ocr.')
    }

    if (await isPdfEncrypted(filePath)) {
      throw CLIUsageError('Anthropic OCR only supports standard unencrypted PDFs. Decrypt the PDF before using --anthropic-ocr.')
    }
  }

  const limits = getExtractLimits(selection.service, selection.model, step1Metadata.format)
  if (
    limits.effectiveBytes === undefined
    && limits.pageCount === undefined
  ) {
    return
  }

  const inputLabel = step1Metadata.format === 'pdf' ? 'PDF' : 'image'
  const fileStats = await stat(filePath)

  if (typeof limits.effectiveBytes === 'number' && fileStats.size > limits.effectiveBytes) {
    throw CLIUsageError(
      `${formatHostedOcrLabel(selection.service)} supports ${inputLabel} inputs up to ${formatBytes(limits.effectiveBytes)} based on ${getHostedOcrLimitSource(selection.service)}. ` +
      `Got ${formatBytes(fileStats.size)} for ${basename(filePath)}.`
    )
  }

  if (step1Metadata.format === 'pdf' && typeof limits.pageCount === 'number') {
    const pageCount = await resolvePdfPageCount(filePath, opts.password, step1Metadata.pageCount)
    if (typeof pageCount === 'number' && pageCount > limits.pageCount) {
      throw CLIUsageError(
        `${formatHostedOcrLabel(selection.service)} supports PDF inputs up to ${limits.pageCount} pages based on ${getHostedOcrLimitSource(selection.service)}. ` +
        `Got ${pageCount} pages for ${basename(filePath)}.`
      )
    }
  }
}

const runHostedOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<HostedOcrRun> => {
  await assertHostedOcrWithinLimits(filePath, step1Metadata, opts)

  if (hasMistralOcr(opts)) {
    await ensureMistralOcrSetup()
    warnMistralOnlyFlags(opts)
    const ocrModel = opts.mistralOcrModel as string
    const run = await runMistralOcr(filePath, step1Metadata, ocrModel)
    return {
      pages: run.pages,
      extractionMethod: run.extractionMethod,
      ocrService: 'mistral',
      ocrModel
    }
  }

  if (hasGlmOcr(opts)) {
    await ensureGlmOcrSetup()
    warnGlmOnlyFlags(opts)
    const ocrModel = opts.glmOcrModel as string
    const run = await runGlmOcr(filePath, step1Metadata, ocrModel)
    return {
      pages: run.pages,
      extractionMethod: run.extractionMethod,
      ocrService: 'glm',
      ocrModel,
      canonicalText: run.markdown,
      ...(typeof run.totalPages === 'number' ? { totalPages: run.totalPages } : {}),
      ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
      ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
    }
  }

  if (hasOpenAIOcr(opts)) {
    await ensureOpenAIOcrSetup()
    warnOpenAIOnlyFlags(opts)
    const ocrModel = opts.openaiOcrModel as string
    const run = await runOpenAIOcr(filePath, step1Metadata, ocrModel)
    return {
      pages: run.pages,
      extractionMethod: run.extractionMethod,
      ocrService: 'openai',
      ocrModel,
      totalPages: run.totalPages,
      ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
      ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
    }
  }

  if (hasAnthropicOcr(opts)) {
    await ensureAnthropicOcrSetup()
    warnAnthropicOnlyFlags(opts)
    const ocrModel = opts.anthropicOcrModel as string
    const run = await runAnthropicOcr(filePath, step1Metadata, ocrModel)
    return {
      pages: run.pages,
      extractionMethod: run.extractionMethod,
      ocrService: 'anthropic',
      ocrModel,
      totalPages: run.totalPages,
      ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
      ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
    }
  }

  if (hasGeminiOcr(opts)) {
    await ensureGeminiOcrSetup()
    warnGeminiOnlyFlags(opts)
    const ocrModel = opts.geminiOcrModel as string
    const run = await runGeminiOcr(filePath, step1Metadata, ocrModel)
    return {
      pages: run.pages,
      extractionMethod: run.extractionMethod,
      ocrService: 'gemini',
      ocrModel,
      totalPages: run.totalPages,
      ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
      ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
    }
  }

  throw CLIUsageError('Hosted OCR requested without a configured hosted OCR model.')
}

export const runOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<{ result: ExtractionResult, step2Metadata: ExtractionMetadata, artifactFiles?: EpubArtifactFile[] }> => {

  const start = Date.now()

  let pages: PageResult[] = []
  let extractionMethod: string
  let epubPayload: Record<string, unknown> | undefined
  let inputFamily: string | undefined
  let normalizedFrom: string | undefined
  let conversionChain: string[] | undefined
  let outputFidelity: string | undefined
  let canonicalText: string | undefined
  let reportedTotalPages: number | undefined
  let ocrService: string | undefined
  let promptTokens: number | undefined
  let completionTokens: number | undefined
  let chapterExportSummary: Record<string, unknown> | undefined
  let pdfChapterDetectionSummary: Record<string, unknown> | undefined
  let artifactFiles: EpubArtifactFile[] | undefined

  const useEpubBun = opts.useEpubBun === true
  const useEpubCalibre = opts.useEpubCalibre === true
  const useEpubInspect = step1Metadata.format === 'epub' && (useEpubBun || useEpubCalibre)
  const ocrEngineCount = [
    opts.useOcrmypdf === true,
    opts.usePaddleOcr === true,
    hasMistralOcr(opts),
    hasGlmOcr(opts),
    hasOpenAIOcr(opts),
    hasAnthropicOcr(opts),
    hasGeminiOcr(opts)
  ].filter(Boolean).length

  if ((typeof opts.preparedMarkdown !== 'string' || opts.preparedMarkdown.trim().length === 0) && ocrEngineCount > 1) {
    throw CLIUsageError('Use at most one OCR engine at a time (--ocrmypdf, --paddle-ocr, --mistral-ocr, --glm-ocr, --openai-ocr, --anthropic-ocr, --gemini-ocr).')
  }

  if (useEpubBun && useEpubCalibre) {
    throw CLIUsageError('Cannot use both EPUB inspect engines at the same time (--epub-bun, --epub-calibre).')
  }

  if (step1Metadata.format !== 'epub' && (useEpubBun || useEpubCalibre)) {
    l.info('EPUB inspect flag was provided for a non-EPUB input. Falling back to normal extract flow for this file.')
  }

  const format = step1Metadata.format
  const epubExportFlagsActive = hasEpubExportFlags(opts)
  const pdfChapterFilesRequested = format === 'pdf' && opts.epubChapterFiles === true
  const pdfChunkOnlyRequested = format === 'pdf' && opts.epubChapterFiles !== true && typeof opts.epubChunkLimitChars === 'number'

  if (format !== 'epub' && format !== 'pdf' && epubExportFlagsActive) {
    l.warn('Chapter export flags (--chapters, --length) are ignored for inputs other than EPUB and PDF.')
  }
  if (pdfChunkOnlyRequested) {
    l.warn('For PDF inputs, --length is only applied when --chapters is also set.')
  }

  if (typeof opts.preparedMarkdown === 'string' && opts.preparedMarkdown.trim().length > 0) {
    pages = [{
      pageNumber: 1,
      method: 'text',
      text: opts.preparedMarkdown
    }]
    extractionMethod = `html+${opts.htmlArticleBackend ?? 'defuddle'}`
    inputFamily = 'html'
    outputFidelity = 'markdown'
  }
  // ─── EPUB inspect mode (--epub-bun or --epub-calibre) ─────────────────────
  else if (useEpubInspect) {
    if (epubExportFlagsActive) {
      l.warn('EPUB export flags (--chapters, --length) are ignored when using EPUB inspect mode.')
    }
    if (useEpubCalibre) {
      l.info('Inspecting EPUB with Calibre tools')
      const inspected = await runEpubCalibreInspect(filePath)
      pages = inspected.payload.chapters.map((chapter) => ({
        pageNumber: chapter.index,
        method: 'text',
        text: chapter.text
      }))
      extractionMethod = 'epub-calibre'
      epubPayload = inspected.payload as Record<string, unknown>
    } else {
      l.info('Inspecting EPUB with Bun ZIP/XML parser')
      const inspected = await runEpubBunInspect(filePath)
      pages = inspected.payload.chapters.map((chapter) => ({
        pageNumber: chapter.index,
        method: 'text',
        text: chapter.text
      }))
      extractionMethod = 'epub-bun'
      epubPayload = inspected.payload as Record<string, unknown>
    }
  }
  // ─── EPUB default text extraction (no OCR flag) ──────────────────────────
  else if (format === 'epub' && !hasOcrFlag(opts)) {
    l.info('Extracting EPUB chapter text with Bun ZIP/XML parser')
    const inspected = await runEpubBunInspect(filePath)
    const epubTextOutput = buildEpubTextOutput(step1Metadata.slug, inspected.payload.chapters, {
      chapterFiles: opts.epubChapterFiles === true,
      ...(typeof opts.epubChunkLimitChars === 'number' ? { chunkLimitChars: opts.epubChunkLimitChars } : {})
    })

    pages = epubTextOutput.pages
    canonicalText = epubTextOutput.text
    artifactFiles = epubTextOutput.exportPlan?.files
    chapterExportSummary = epubTextOutput.exportPlan?.summary as Record<string, unknown> | undefined

    extractionMethod = 'epub-text'
    inputFamily = 'epub'
    outputFidelity = 'cleaned-epub-text'
  }
  // ─── EPUB with OCR flag → convert to PDF first ───────────────────────────
  else if (format === 'epub' && hasOcrFlag(opts)) {
    if (epubExportFlagsActive) {
      l.warn('EPUB export flags (--chapters, --length) are ignored when an OCR engine is selected for EPUB input.')
    }
    inputFamily = 'epub'
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-epub-ocr-'))
    try {
      const { pdfPath, conversionChain: epubConversionChain } = await convertEpubToPdfForOcr(filePath, tempDir, opts.password)
      const tempMeta = await buildHostedUploadMetadata(pdfPath, step1Metadata, 'pdf', opts.password)
      if (hasHostedOcr(opts)) {
        const r = await runHostedOcr(pdfPath, tempMeta, opts)
        pages = r.pages
        extractionMethod = `pdf+${r.extractionMethod}`
        ocrService = r.ocrService
        canonicalText = r.canonicalText
        reportedTotalPages = r.totalPages
        promptTokens = r.promptTokens
        completionTokens = r.completionTokens
      } else {
        const r = await runPdfOcr(pdfPath, tempMeta, opts)
        pages = r.pages
        extractionMethod = r.extractionMethod
      }
      conversionChain = epubConversionChain
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
  // ─── Office documents (DOCX/PPTX/XLSX/ODF) ───────────────────────────────
  else if (isZipXmlFormat(format)) {
    inputFamily = 'office'
    const ocrFlag = hasOcrFlag(opts)

    if (!ocrFlag) {
      // Try native ZIP+XML extraction first
      l.info(`Extracting ${format.toUpperCase()} with native ZIP+XML parser`)
      const r = await runZipXmlExtract(filePath, format)
      const combinedText = r.pages.map(p => p.text).join(' ')

      const spreadsheetFormat = (format === 'xlsx' || format === 'odf') ? 'xlsx' : undefined
      if (isOfficeTextUsable(combinedText, spreadsheetFormat)) {
        pages = r.pages
        extractionMethod = 'office-native'
      } else {
        // Quality check failed - fall back to LibreOffice + OCR
        l.info(`${format.toUpperCase()} native extraction quality insufficient, falling back to LibreOffice + OCR`)
        const engine = resolveExtractEngine(opts)
        const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-office-ocr-'))
        try {
          const pdfPath = await convertToLibreOfficePdf(filePath, tempDir)
          const tempMeta: DocumentMetadata = { ...step1Metadata, format: 'pdf' }
          const r2 = await runPdfOcr(pdfPath, tempMeta, opts)
          pages = r2.pages
          extractionMethod = `office+${engineSuffix(engine)}`
          conversionChain = ['libreoffice']
        } finally {
          await rm(tempDir, { recursive: true, force: true })
        }
      }
    } else {
      l.info(`${format.toUpperCase()} with OCR flag: converting to PDF via LibreOffice`)
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-office-ocr-'))
      try {
        const pdfPath = await convertToLibreOfficePdf(filePath, tempDir)
        const tempMeta = await buildHostedUploadMetadata(pdfPath, step1Metadata, 'pdf')

        if (hasHostedOcr(opts)) {
          const r = await runHostedOcr(pdfPath, tempMeta, opts)
          pages = r.pages
          extractionMethod = `office+${r.extractionMethod}`
          ocrService = r.ocrService
          canonicalText = r.canonicalText
          reportedTotalPages = r.totalPages
          promptTokens = r.promptTokens
          completionTokens = r.completionTokens
        } else {
          const engine = resolveExtractEngine(opts)
          const r = await runPdfOcr(pdfPath, tempMeta, opts)
          pages = r.pages
          extractionMethod = `office+${engineSuffix(engine)}`
        }
        conversionChain = ['libreoffice']
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    }
  }
  // ─── RTF → always LibreOffice → PDF → standard pipeline ─────────────────
  else if (format === 'rtf') {
    inputFamily = 'rtf'
    l.info('Converting RTF to PDF via LibreOffice')
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-rtf-'))
    try {
      const pdfPath = await convertToLibreOfficePdf(filePath, tempDir)
      const tempMeta = await buildHostedUploadMetadata(pdfPath, step1Metadata, 'pdf')

      if (hasHostedOcr(opts)) {
        const r = await runHostedOcr(pdfPath, tempMeta, opts)
        pages = r.pages
        extractionMethod = `rtf+${r.extractionMethod}`
        ocrService = r.ocrService
        canonicalText = r.canonicalText
        reportedTotalPages = r.totalPages
        promptTokens = r.promptTokens
        completionTokens = r.completionTokens
      } else {
        const r = await runPdfOcr(pdfPath, tempMeta, opts)
        pages = r.pages
        const engine = resolveExtractEngine(opts)
        extractionMethod = `rtf+${engineSuffix(engine)}`
      }
      conversionChain = ['libreoffice']
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
  // ─── CSV → raw text, warn if OCR flag ────────────────────────────────────
  else if (format === 'csv') {
    inputFamily = 'csv'
    if (hasOcrFlag(opts)) {
      l.warn('OCR flags are ignored for CSV inputs (CSV content is read as raw text)')
    }
    const text = await Bun.file(filePath).text()
    pages = [{ pageNumber: 1, method: 'text', text }]
    extractionMethod = 'csv-raw'
  }
  // ─── CBZ → extract images, per-image OCR ─────────────────────────────────
  else if (format === 'cbz') {
    inputFamily = 'cbz'
    l.info('Extracting images from CBZ archive')
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-cbz-'))
    try {
      const images = await extractCbzImages(filePath, tempDir)
      l.info(`Processing ${images.length} images from CBZ`)

      if (hasHostedOcr(opts)) {
        const hostedEngine = getHostedOcrEngine(opts)
        if (!hostedEngine) {
          throw CLIUsageError('Hosted OCR requested without a configured hosted OCR model.')
        }
        const imagePages: PageResult[] = []
        let totalPromptTokens = 0
        let totalCompletionTokens = 0
        const hostedNormDir = await mkdtemp(join(tmpdir(), 'autoshow-cbz-hosted-'))
        try {
          for (let i = 0; i < images.length; i++) {
            const imgPath = images[i]!
            const normalized = await normalizeHostedDirectImageInput(
              imgPath,
              hostedEngine,
              hostedNormDir,
              `cbz-page-${String(i + 1).padStart(4, '0')}`
            )
            const tempMeta = await buildHostedUploadMetadata(normalized.filePath, step1Metadata, normalized.format)
            const r = await runHostedOcr(normalized.filePath, tempMeta, opts)
            imagePages.push(...r.pages.map(p => ({ ...p, pageNumber: i + 1 })))
            ocrService = r.ocrService
            totalPromptTokens += r.promptTokens ?? 0
            totalCompletionTokens += r.completionTokens ?? 0
          }
        } finally {
          await rm(hostedNormDir, { recursive: true, force: true })
        }
        pages = imagePages
        extractionMethod = `cbz+${hostedEngine}`
        if (totalPromptTokens > 0) promptTokens = totalPromptTokens
        if (totalCompletionTokens > 0) completionTokens = totalCompletionTokens
      } else {
        const engine = resolveExtractEngine(opts)
        if (engine !== 'tesseract') warnTesseractOnlyFlags(engine, opts)

        const ocrNormDir = await mkdtemp(join(tmpdir(), 'autoshow-cbz-ocr-'))
        try {
          const imagePages: PageResult[] = []
          for (let i = 0; i < images.length; i++) {
            const imgPath = images[i]!
            const result = await ocrSingleImage(imgPath, i + 1, opts, engine, ocrNormDir)
            imagePages.push(result)
          }
          pages = imagePages
          extractionMethod = `cbz+${engineSuffix(engine)}`
        } finally {
          await rm(ocrNormDir, { recursive: true, force: true })
        }
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
  // ─── Image family (PNG/JPG/TIF/WebP/BMP/GIF) ─────────────────────────────
  else if (IMAGE_FORMATS.has(format)) {
    inputFamily = 'image'

    if (hasHostedOcr(opts)) {
      const hostedEngine = getHostedOcrEngine(opts)
      if (!hostedEngine) {
        throw CLIUsageError('Hosted OCR requested without a configured hosted OCR model.')
      }

      const hostedNormDir = await mkdtemp(join(tmpdir(), 'autoshow-img-hosted-'))
      try {
        const normalized = await normalizeHostedDirectImageInput(filePath, hostedEngine, hostedNormDir, 'input-image')
        const tempMeta = normalized.filePath === filePath && normalized.format === step1Metadata.format
          ? step1Metadata
          : await buildHostedUploadMetadata(normalized.filePath, step1Metadata, normalized.format, opts.password)
        const r = await runHostedOcr(normalized.filePath, tempMeta, opts)
        pages = r.pages
        extractionMethod = `image+${r.extractionMethod}`
        ocrService = r.ocrService
        canonicalText = r.canonicalText
        reportedTotalPages = r.totalPages
        promptTokens = r.promptTokens
        completionTokens = r.completionTokens
      } finally {
        await rm(hostedNormDir, { recursive: true, force: true })
      }
    } else {
      const engine = resolveExtractEngine(opts)
      if (engine !== 'tesseract') warnTesseractOnlyFlags(engine, opts)

      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-img-ocr-'))
      try {
        const result = await ocrSingleImage(filePath, 1, opts, engine, tempDir)
        pages = [result]
        extractionMethod = `image+${engineSuffix(engine)}`
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    }
  }
  // ─── PDF (and EPUB via OCR flag already handled above) ───────────────────
  else {
    inputFamily = 'pdf'

    if (hasHostedOcr(opts)) {
      if (format !== 'pdf') {
        const hostedEngine = getHostedOcrEngine(opts) ?? 'mistral-ocr'
        throw CLIUsageError(getHostedDirectImageSupportError(hostedEngine))
      }
      const r = await runHostedOcr(filePath, step1Metadata, opts)
      pages = r.pages
      extractionMethod = r.extractionMethod
      ocrService = r.ocrService
      canonicalText = r.canonicalText
      reportedTotalPages = r.totalPages
      promptTokens = r.promptTokens
      completionTokens = r.completionTokens
    } else {
      const engine = resolveExtractEngine(opts)
      if (engine !== 'tesseract') warnTesseractOnlyFlags(engine, opts)

      switch (engine) {
        case 'tesseract': {
          await ensureTesseractSetup()
          pages = await processPages(filePath, step1Metadata.pageCount, opts)
          extractionMethod = 'mutool+tesseract'
          break
        }
        case 'ocrmypdf': {
          const r = await runOcrmypdfWithAutoPdf(filePath, step1Metadata, opts)
          pages = r.pages
          extractionMethod = r.extractionMethod
          break
        }
        case 'paddle-ocr': {
          const paddleOcrFn = await buildPaddleOcrPageFn(opts)
          pages = await processPages(filePath, step1Metadata.pageCount, opts, paddleOcrFn)
          extractionMethod = 'mutool+paddle-ocr'
          break
        }
        default:
          assertNever(engine)
      }
    }
  }

  if (pdfChapterFilesRequested && format === 'pdf') {
    l.info(`Detecting PDF chapters with ${opts.pdfChapterMode} mode`)
    const pdfChapterOutput = await buildPdfChapterArtifacts({
      filePath,
      pages,
      mode: opts.pdfChapterMode,
      ...(typeof step1Metadata.title === 'string' ? { title: step1Metadata.title } : {}),
      ...(typeof step1Metadata.author === 'string' ? { author: step1Metadata.author } : {}),
      ...(typeof opts.password === 'string' ? { password: opts.password } : {}),
      ...(typeof opts.epubChunkLimitChars === 'number' ? { chunkLimitChars: opts.epubChunkLimitChars } : {}),
      ...(typeof opts.pdfChapterLlmService === 'string' ? { llmService: opts.pdfChapterLlmService } : {}),
      ...(typeof opts.pdfChapterLlmModel === 'string' ? { llmModel: opts.pdfChapterLlmModel } : {})
    })
    artifactFiles = pdfChapterOutput.files
    chapterExportSummary = pdfChapterOutput.summary as Record<string, unknown> | undefined
    pdfChapterDetectionSummary = pdfChapterOutput.detection as unknown as Record<string, unknown>
  }

  const text = opts.preparedMarkdown
    ? opts.preparedMarkdown.trim()
    : typeof canonicalText === 'string' && canonicalText.trim().length > 0
      ? canonicalText.trim()
      : buildCombinedText(pages, opts.pageSeparator, extractionMethod !== 'epub-text')
  const ocrPages = pages.filter(p => p.method === 'ocr').length
  const textPages = pages.filter(p => p.method === 'text').length

  const totalPages = typeof reportedTotalPages === 'number'
    ? reportedTotalPages
    : pages.length > 0
      ? pages.length
      : step1Metadata.pageCount

  const result = validateData(ExtractionResultSchema, {
    text,
    pages,
    totalPages,
    ocrPages,
    textPages
  }, 'extraction result')

  const step2MetadataPayload: Record<string, unknown> = {
    extractionMethod,
    totalPages,
    ocrPages,
    textPages,
    processingTime: Date.now() - start,
    dpi: opts.dpi,
    languages: opts.languages,
    tokenEstimate: estimateTokens(result.text)
  }

  if (typeof ocrService === 'string') {
    step2MetadataPayload['ocrService'] = ocrService
  }
  if (typeof opts.mistralOcrModel === 'string' && extractionMethod.includes('mistral-ocr')) {
    step2MetadataPayload['ocrModel'] = opts.mistralOcrModel
  }
  if (typeof opts.glmOcrModel === 'string' && extractionMethod.includes('glm-ocr')) {
    step2MetadataPayload['ocrModel'] = opts.glmOcrModel
  }
  if (typeof opts.openaiOcrModel === 'string' && extractionMethod.includes('openai-ocr')) {
    step2MetadataPayload['ocrModel'] = opts.openaiOcrModel
  }
  if (typeof opts.anthropicOcrModel === 'string' && extractionMethod.includes('anthropic-ocr')) {
    step2MetadataPayload['ocrModel'] = opts.anthropicOcrModel
  }
  if (typeof opts.geminiOcrModel === 'string' && extractionMethod.includes('gemini-ocr')) {
    step2MetadataPayload['ocrModel'] = opts.geminiOcrModel
  }
  if (typeof promptTokens === 'number') {
    step2MetadataPayload['promptTokens'] = promptTokens
  }
  if (typeof completionTokens === 'number') {
    step2MetadataPayload['completionTokens'] = completionTokens
  }
  if (epubPayload) step2MetadataPayload['epub'] = epubPayload
  if (chapterExportSummary) step2MetadataPayload['chapterExport'] = chapterExportSummary
  if (chapterExportSummary?.['sourceFormat'] === 'epub') step2MetadataPayload['epubExport'] = chapterExportSummary
  if (pdfChapterDetectionSummary) step2MetadataPayload['pdfChapterDetection'] = pdfChapterDetectionSummary
  if (inputFamily) step2MetadataPayload['inputFamily'] = inputFamily
  if (normalizedFrom) step2MetadataPayload['normalizedFrom'] = normalizedFrom
  if (conversionChain) step2MetadataPayload['conversionChain'] = conversionChain
  if (outputFidelity) step2MetadataPayload['outputFidelity'] = outputFidelity
  if (outputFidelity) step2MetadataPayload['outputFormat'] = opts.outputFormat

  const step2Metadata = validateData(ExtractionMetadataSchema, step2MetadataPayload, 'extraction metadata')

  return {
    result,
    step2Metadata,
    ...(artifactFiles ? { artifactFiles } : {})
  }
}

// Helper: run PDF OCR pipeline based on opts
const runPdfOcr = async (
  pdfPath: string,
  tempMeta: DocumentMetadata,
  opts: ExtractionOptions
): Promise<{ pages: PageResult[], extractionMethod: string }> => {
  const engine = resolveExtractEngine(opts)

  switch (engine) {
    case 'tesseract': {
      await ensureTesseractSetup()
      const pages = await processPages(pdfPath, tempMeta.pageCount, opts)
      return { pages, extractionMethod: `pdf+tesseract` }
    }
    case 'ocrmypdf': {
      const r = await runOcrmypdf(pdfPath, opts)
      return { pages: r.pages, extractionMethod: `pdf+ocrmypdf` }
    }
    case 'paddle-ocr': {
      const paddleOcrFn = await buildPaddleOcrPageFn(opts)
      const pages = await processPages(pdfPath, tempMeta.pageCount, opts, paddleOcrFn)
      return { pages, extractionMethod: `pdf+paddle-ocr` }
    }
    default:
      assertNever(engine)
  }
}
