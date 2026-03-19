import { validateData } from '~/utils/validate/validation'
import { assertNever } from '~/utils/validate/assert-never'
import * as l from '~/logger'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, basename, extname } from 'node:path'
import { exec, commandExists } from '~/utils/cli-utils'
import {
  ExtractionMetadataSchema,
  ExtractionResultSchema,
  type DocumentMetadata,
  type ExtractionMetadata,
  type ExtractionOptions,
  type ExtractionResult,
  type ExtractOcrEngine,
  type PageResult
} from '~/types'
import { ensureTesseractSetup, ocrImage } from './document-utils/tesseract-utils'
import { processPages } from './document-utils/page-processor'
import { runOcrmypdf } from './document-local/ocrmypdf/run-ocrmypdf'
import { buildPaddleOcrPageFn, runPaddleOcrOnImage } from './document-local/paddle-ocr/run-paddle-ocr'
import { runMistralOcr } from './document-services/mistral-ocr/run-mistral-ocr'
import { convertDocumentToPdf } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { extractDocx, extractPptx, extractXlsx, extractOdf, type ZipXmlPage } from '~/cli/commands/process-steps/step-1-download/document/zip-xml-utils'
import { CLIUsageError } from '~/utils/error-handler'
import type { ZipXmlFormat } from '~/types'
import { ensureMistralOcrSetup } from '~/cli/commands/process-steps/step-2-document/document-services/mistral-ocr/mistral'
import { runEpubBunInspect, runEpubCalibreInspect } from './epub'
import { isOfficeTextUsable } from './document-utils/page-triage'

const ZIP_XML_FORMATS = new Set(['docx', 'pptx', 'xlsx', 'odf'] as const)
const IMAGE_FORMATS = new Set(['png', 'jpg', 'tif', 'webp', 'bmp', 'gif'])
const isZipXmlFormat = (f: string): f is ZipXmlFormat => ZIP_XML_FORMATS.has(f as ZipXmlFormat)

type LocalExtractOcrEngine = Exclude<ExtractOcrEngine, 'mistral-ocr'>

const estimateTokens = (text: string): number => text.split(/\s+/).filter(Boolean).length

const buildCombinedText = (pages: PageResult[], pageSeparator: string): string => {
  return pages
    .map(page => `Page ${page.pageNumber}\n${page.text.trim()}`)
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
      const r = await extractDocx(filePath)
      return { pages: r.pages.map(zipXmlPageToPageResult), extractionMethod: 'docx' }
    }
    case 'pptx': {
      const r = await extractPptx(filePath)
      return { pages: r.pages.map(zipXmlPageToPageResult), extractionMethod: 'pptx' }
    }
    case 'xlsx': {
      const r = await extractXlsx(filePath)
      return { pages: r.pages.map(zipXmlPageToPageResult), extractionMethod: 'xlsx' }
    }
    case 'odf': {
      const r = await extractOdf(filePath)
      return { pages: r.pages.map(zipXmlPageToPageResult), extractionMethod: 'odf' }
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

const hasOcrFlag = (opts: ExtractionOptions): boolean =>
  opts.useOcrmypdf === true || opts.usePaddleOcr === true || hasMistralOcr(opts)

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

const warnMistralOnlyFlags = (opts: ExtractionOptions): void => {
  if (opts.psm !== 3) {
    l.warn('Flag --psm is Tesseract-specific and has no effect with the mistral-ocr engine')
  }
  if (opts.oem !== 1) {
    l.warn('Flag --oem is Tesseract-specific and has no effect with the mistral-ocr engine')
  }
  if (opts.preserveInterwordSpaces === true) {
    l.warn('Flag --preserve-spaces is Tesseract-specific and has no effect with the mistral-ocr engine')
  }
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

export const runExtract = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: ExtractionOptions
): Promise<{ result: ExtractionResult, step2Metadata: ExtractionMetadata }> => {

  const start = Date.now()

  let pages: PageResult[] = []
  let extractionMethod: string
  let epubPayload: Record<string, unknown> | undefined
  let inputFamily: string | undefined
  let normalizedFrom: string | undefined
  let conversionChain: string[] | undefined

  const useEpubBun = opts.useEpubBun === true
  const useEpubCalibre = opts.useEpubCalibre === true
  const useEpubInspect = step1Metadata.format === 'epub' && (useEpubBun || useEpubCalibre)

  if (useEpubBun && useEpubCalibre) {
    throw CLIUsageError('Cannot use both EPUB inspect engines at the same time (--epub-bun, --epub-calibre).')
  }

  if (step1Metadata.format !== 'epub' && (useEpubBun || useEpubCalibre)) {
    l.info('EPUB inspect flag was provided for a non-EPUB input. Falling back to normal extract flow for this file.')
  }

  const format = step1Metadata.format

  // ─── EPUB inspect mode (--epub-bun or --epub-calibre) ─────────────────────
  if (useEpubInspect) {
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

    pages = inspected.payload.chapters.map((chapter) => {
      const heading = chapter.title ? `## ${chapter.title}\n\n` : ''
      return {
        pageNumber: chapter.index,
        method: 'text' as const,
        text: `${heading}${chapter.text}`
      }
    })

    extractionMethod = 'epub-text'
    inputFamily = 'epub'
  }
  // ─── EPUB with OCR flag → convert to PDF first ───────────────────────────
  else if (format === 'epub' && hasOcrFlag(opts)) {
    inputFamily = 'epub'
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-epub-ocr-'))
    try {
      const { pdfPath, conversionChain: epubConversionChain } = await convertEpubToPdfForOcr(filePath, tempDir, opts.password)
      const tempMeta: DocumentMetadata = { ...step1Metadata, format: 'pdf' }
      const r = await runPdfOcr(pdfPath, tempMeta, opts)
      pages = r.pages
      extractionMethod = r.extractionMethod
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
      // OCR flag: force LibreOffice conversion + OCR
      const engine = hasMistralOcr(opts) ? 'mistral' : resolveExtractEngine(opts)
      l.info(`${format.toUpperCase()} with OCR flag: converting to PDF via LibreOffice`)
      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-office-ocr-'))
      try {
        const pdfPath = await convertToLibreOfficePdf(filePath, tempDir)
        const tempMeta: DocumentMetadata = { ...step1Metadata, format: 'pdf' }

        if (hasMistralOcr(opts)) {
          await ensureMistralOcrSetup()
          warnMistralOnlyFlags(opts)
          const r = await runMistralOcr(pdfPath, tempMeta, opts.mistralOcrModel as string)
          pages = r.pages
          extractionMethod = 'office+mistral-ocr'
        } else {
          const r = await runPdfOcr(pdfPath, tempMeta, opts)
          pages = r.pages
          extractionMethod = `office+${engineSuffix(engine as LocalExtractOcrEngine)}`
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
      const tempMeta: DocumentMetadata = { ...step1Metadata, format: 'pdf' }

      if (hasMistralOcr(opts)) {
        await ensureMistralOcrSetup()
        warnMistralOnlyFlags(opts)
        const r = await runMistralOcr(pdfPath, tempMeta, opts.mistralOcrModel as string)
        pages = r.pages
        extractionMethod = 'rtf+mistral-ocr'
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

      if (hasMistralOcr(opts)) {
        await ensureMistralOcrSetup()
        warnMistralOnlyFlags(opts)
        // Process CBZ images via Mistral by converting to PDF first
        // (Mistral only supports PDF/image input)
        const imagePages: PageResult[] = []
        for (let i = 0; i < images.length; i++) {
          const imgPath = images[i]!
          const r = await runMistralOcr(imgPath, { ...step1Metadata, format: 'png', pageCount: 1 }, opts.mistralOcrModel as string)
          imagePages.push(...r.pages.map(p => ({ ...p, pageNumber: i + 1 })))
        }
        pages = imagePages
        extractionMethod = 'cbz+mistral-ocr'
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

    if (hasMistralOcr(opts)) {
      const mistralFormats = new Set(['png', 'jpg', 'tif'])
      if (!mistralFormats.has(format)) {
        throw CLIUsageError('The --mistral-ocr engine supports PDF and standard image files (PNG/JPG/TIF) only.')
      }
      await ensureMistralOcrSetup()
      warnMistralOnlyFlags(opts)
      const r = await runMistralOcr(filePath, step1Metadata, opts.mistralOcrModel as string)
      pages = r.pages
      extractionMethod = 'image+mistral-ocr'
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
    // PDF or fallback
    const useMistralOcr = hasMistralOcr(opts)
    inputFamily = 'pdf'

    if (useMistralOcr) {
      if (format !== 'pdf') {
        throw CLIUsageError('The --mistral-ocr engine supports PDF and image files only.')
      }
      await ensureMistralOcrSetup()
      warnMistralOnlyFlags(opts)
      const r = await runMistralOcr(filePath, step1Metadata, opts.mistralOcrModel as string)
      pages = r.pages
      extractionMethod = r.extractionMethod
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

  const text = buildCombinedText(pages, opts.pageSeparator)
  const ocrPages = pages.filter(p => p.method === 'ocr').length
  const textPages = pages.filter(p => p.method === 'text').length

  const totalPages = pages.length > 0 ? pages.length : step1Metadata.pageCount

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

  if (epubPayload) step2MetadataPayload['epub'] = epubPayload
  if (inputFamily) step2MetadataPayload['inputFamily'] = inputFamily
  if (normalizedFrom) step2MetadataPayload['normalizedFrom'] = normalizedFrom
  if (conversionChain) step2MetadataPayload['conversionChain'] = conversionChain

  const step2Metadata = validateData(ExtractionMetadataSchema, step2MetadataPayload, 'extraction metadata')

  return {
    result,
    step2Metadata
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
