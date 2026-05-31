import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  DocumentMetadata,
  EpubArtifactFile,
  ExtractionMetadata,
  ExtractionOptions,
  ExtractionResult,
  HostedOcrRun,
  PageResult
} from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { writeFile } from '~/utils/cli-utils'
import * as l from '~/utils/logger'
import { buildPdfChapterArtifacts } from './chapters/artifacts'
import { buildEpubTextOutput } from './epub/export'
import { runEpubBunInspect } from './epub/run-epub-bun-inspect'
import { runEpubCalibreInspect } from './epub/run-epub-calibre-inspect'
import {
  countSelectedOcrEngines,
  engineSuffix,
  getHostedOcrEngine,
  hasEpubExportFlags,
  hasHostedOcr,
  hasOcrFlag,
  resolveExtractEngine
} from './ocr-engine-selection'
import {
  getHostedDirectImageSupportError,
  normalizeHostedDirectImageInput,
  runHostedOcr
} from './hosted-ocr'
import {
  IMAGE_FORMATS,
  extractCbzImages,
  ocrSingleImage
} from './image-ocr'
import {
  buildCombinedText,
  extractRtfFile,
  isZipXmlFormat,
  runZipXmlExtract
} from './native-text-extractors'
import { buildOcrOutput } from './ocr-result'
import {
  buildHostedUploadMetadata,
  convertEpubToPdfForOcr,
  runLocalPdfOcr,
  runPdfOcr
} from './pdf-utils'
import {
  CHAPTER_EXPORT_FLAGS_IGNORED_WARNING,
  CSV_OCR_FLAGS_IGNORED_WARNING,
  EPUB_EXPORT_FLAGS_IGNORED_INSPECT_WARNING,
  EPUB_EXPORT_FLAGS_IGNORED_OCR_WARNING,
  EPUB_INSPECT_NON_EPUB_INFO,
  PDF_LENGTH_WITHOUT_CHAPTERS_WARNING
} from '../step-2-shared/inactive-flag-warnings'

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
  let providerCostCents: number | undefined
  let providerCostSource: HostedOcrRun['providerCostSource'] | undefined
  let ocrProviderUsage: HostedOcrRun['providerUsage'] | undefined
  let chapterExportSummary: Record<string, unknown> | undefined
  let pdfChapterDetectionSummary: Record<string, unknown> | undefined
  let artifactFiles: EpubArtifactFile[] | undefined

  const mergeHostedProviderCost = (run: HostedOcrRun): void => {
    if (typeof run.providerCostCents !== 'number') {
      if (run.providerUsage && run.providerUsage.length > 0) {
        ocrProviderUsage = [...(ocrProviderUsage ?? []), ...run.providerUsage]
      }
      return
    }
    providerCostCents = (providerCostCents ?? 0) + run.providerCostCents
    providerCostSource = run.providerCostSource ?? providerCostSource
    if (run.providerUsage && run.providerUsage.length > 0) {
      ocrProviderUsage = [...(ocrProviderUsage ?? []), ...run.providerUsage]
    }
  }

  const useEpubBun = opts.useEpubBun === true
  const useEpubCalibre = opts.useEpubCalibre === true
  const useEpubInspect = step1Metadata.format === 'epub' && (useEpubBun || useEpubCalibre)
  const ocrEngineCount = countSelectedOcrEngines(opts)

  if ((typeof opts.preparedMarkdown !== 'string' || opts.preparedMarkdown.trim().length === 0) && ocrEngineCount > 1) {
    throw CLIUsageError('Use at most one OCR provider at a time. Select one with --provider provider[=model].')
  }

  if (useEpubBun && useEpubCalibre) {
    throw CLIUsageError('Cannot use both EPUB inspect engines at the same time (--epub-bun, --epub-calibre).')
  }

  if (step1Metadata.format !== 'epub' && (useEpubBun || useEpubCalibre)) {
    l.write('info', EPUB_INSPECT_NON_EPUB_INFO)
  }

  const writeExtractionTextCheckpoint = async (): Promise<void> => {
    if (opts.outputFormat !== 'text' || extractionMethod === 'epub-bun' || extractionMethod === 'epub-calibre') {
      return
    }

    const text = opts.preparedMarkdown
      ? opts.preparedMarkdown.trim()
      : typeof canonicalText === 'string' && canonicalText.trim().length > 0
        ? canonicalText.trim()
        : buildCombinedText(pages, extractionMethod !== 'epub-text')

    await writeFile(`${opts.outputDir}/extraction.txt`, text)
  }

  const format = step1Metadata.format
  const epubExportFlagsActive = hasEpubExportFlags(opts)
  const pdfChapterFilesRequested = format === 'pdf' && opts.epubChapterFiles === true
  const pdfChunkOnlyRequested = format === 'pdf' && opts.epubChapterFiles !== true && typeof opts.epubChunkLimitChars === 'number'

  if (format !== 'epub' && format !== 'pdf' && epubExportFlagsActive) {
    l.warn(CHAPTER_EXPORT_FLAGS_IGNORED_WARNING)
  }
  if (pdfChunkOnlyRequested) {
    l.warn(PDF_LENGTH_WITHOUT_CHAPTERS_WARNING)
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
  } else if (useEpubInspect) {
    if (epubExportFlagsActive) {
      l.warn(EPUB_EXPORT_FLAGS_IGNORED_INSPECT_WARNING)
    }
    if (useEpubCalibre) {
      l.write('info', 'Inspecting EPUB with Bun ZIP/XML parser (--epub-calibre compatibility alias)')
      const inspected = await runEpubCalibreInspect(filePath)
      pages = inspected.payload.chapters.map((chapter) => ({
        pageNumber: chapter.index,
        method: 'text',
        text: chapter.text
      }))
      extractionMethod = 'epub-calibre'
      epubPayload = inspected.payload as Record<string, unknown>
    } else {
      l.write('info', 'Inspecting EPUB with Bun ZIP/XML parser')
      const inspected = await runEpubBunInspect(filePath)
      pages = inspected.payload.chapters.map((chapter) => ({
        pageNumber: chapter.index,
        method: 'text',
        text: chapter.text
      }))
      extractionMethod = 'epub-bun'
      epubPayload = inspected.payload as Record<string, unknown>
    }
  } else if (format === 'epub' && !hasOcrFlag(opts)) {
    l.write('info', 'Extracting EPUB chapter text with Bun ZIP/XML parser')
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
  } else if (format === 'epub' && hasOcrFlag(opts)) {
    if (epubExportFlagsActive) {
      l.warn(EPUB_EXPORT_FLAGS_IGNORED_OCR_WARNING)
    }
    inputFamily = 'epub'
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-epub-ocr-'))
    try {
      const { pdfPath, conversionChain: epubConversionChain } = await convertEpubToPdfForOcr(filePath, tempDir, opts.password)
      const tempMeta = await buildHostedUploadMetadata(pdfPath, step1Metadata, 'pdf', opts.password)
      if (hasHostedOcr(opts)) {
        const run = await runHostedOcr(pdfPath, tempMeta, opts)
        pages = run.pages
        extractionMethod = `pdf+${run.extractionMethod}`
        ocrService = run.ocrService
        canonicalText = run.canonicalText
        reportedTotalPages = run.totalPages
        promptTokens = run.promptTokens
        completionTokens = run.completionTokens
        mergeHostedProviderCost(run)
      } else {
        const run = await runPdfOcr(pdfPath, tempMeta, opts, resolveExtractEngine(opts))
        pages = run.pages
        extractionMethod = run.extractionMethod
      }
      conversionChain = epubConversionChain
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  } else if (isZipXmlFormat(format)) {
    inputFamily = 'office'
    if (hasOcrFlag(opts)) {
      l.warn(`${format.toUpperCase()} OCR flags are ignored; extracting native ZIP/XML text with Bun`)
    }

    l.write('info', `Extracting ${format.toUpperCase()} with native ZIP/XML parser`)
    const run = await runZipXmlExtract(filePath, format)
    pages = run.pages
    extractionMethod = 'office-native'
  } else if (format === 'rtf') {
    inputFamily = 'rtf'
    if (hasOcrFlag(opts)) {
      l.warn('RTF OCR flags are ignored; extracting native RTF text with Bun')
    }
    l.write('info', 'Extracting RTF with native text parser')
    pages = await extractRtfFile(filePath)
    extractionMethod = 'rtf-native'
  } else if (format === 'csv') {
    inputFamily = 'csv'
    if (hasOcrFlag(opts)) {
      l.warn(CSV_OCR_FLAGS_IGNORED_WARNING)
    }
    const text = await Bun.file(filePath).text()
    pages = [{ pageNumber: 1, method: 'text', text }]
    extractionMethod = 'csv-raw'
  } else if (format === 'cbz') {
    inputFamily = 'cbz'
    l.write('info', 'Extracting images from CBZ archive')
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-cbz-'))
    try {
      const images = await extractCbzImages(filePath, tempDir)
      l.write('info', `Processing ${images.length} images from CBZ`)

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
            const run = await runHostedOcr(normalized.filePath, tempMeta, opts)
            imagePages.push(...run.pages.map(page => ({ ...page, pageNumber: i + 1 })))
            ocrService = run.ocrService
            totalPromptTokens += run.promptTokens ?? 0
            totalCompletionTokens += run.completionTokens ?? 0
            mergeHostedProviderCost(run)
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
  } else if (IMAGE_FORMATS.has(format)) {
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
        const run = await runHostedOcr(normalized.filePath, tempMeta, opts)
        pages = run.pages
        extractionMethod = `image+${run.extractionMethod}`
        ocrService = run.ocrService
        canonicalText = run.canonicalText
        reportedTotalPages = run.totalPages
        promptTokens = run.promptTokens
        completionTokens = run.completionTokens
        mergeHostedProviderCost(run)
      } finally {
        await rm(hostedNormDir, { recursive: true, force: true })
      }
    } else {
      const engine = resolveExtractEngine(opts)

      const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-img-ocr-'))
      try {
        const result = await ocrSingleImage(filePath, 1, opts, engine, tempDir)
        pages = [result]
        extractionMethod = `image+${engineSuffix(engine)}`
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    }
  } else {
    inputFamily = 'pdf'

    if (hasHostedOcr(opts)) {
      if (format !== 'pdf') {
        const hostedEngine = getHostedOcrEngine(opts) ?? 'mistral-ocr'
        throw CLIUsageError(getHostedDirectImageSupportError(hostedEngine))
      }
      const run = await runHostedOcr(filePath, step1Metadata, opts)
      pages = run.pages
      extractionMethod = run.extractionMethod
      ocrService = run.ocrService
      canonicalText = run.canonicalText
      reportedTotalPages = run.totalPages
      promptTokens = run.promptTokens
      completionTokens = run.completionTokens
      mergeHostedProviderCost(run)
    } else {
      const engine = resolveExtractEngine(opts)

      const run = await runLocalPdfOcr(filePath, step1Metadata, opts, engine)
      pages = run.pages
      extractionMethod = run.extractionMethod
    }
  }

  if (pdfChapterFilesRequested && format === 'pdf') {
    await writeExtractionTextCheckpoint()
    l.write('info', `Detecting PDF chapters with ${opts.pdfChapterMode} mode`)
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

  return buildOcrOutput({
    start,
    pages,
    extractionMethod,
    step1Metadata,
    opts,
    epubPayload,
    inputFamily,
    normalizedFrom,
    conversionChain,
    outputFidelity,
    canonicalText,
    reportedTotalPages,
    ocrService,
    promptTokens,
    completionTokens,
    providerCostCents,
    providerCostSource,
    ocrProviderUsage,
    chapterExportSummary,
    pdfChapterDetectionSummary,
    artifactFiles
  })
}
