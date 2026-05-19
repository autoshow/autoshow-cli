import { mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { DocumentMetadata, HostedOcrRun, PageResult } from '~/types'
import { splitPdfPages } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import * as l from '~/utils/logger'
import { classifyOcrProviderFailure, stripAnsi } from '../ocr-run-state'
import { findOcrStructuredResponseError } from '../ocr-structured-response-error'
import { collectErrorChain } from '~/utils/error-handler'

export type OcrPdfChunkRange = {
  startPage: number
  endPage: number
}

type RunHostedOcrPdfChunkFallbackOptions = {
  filePath: string
  step1Metadata: DocumentMetadata
  serviceLabel: string
  totalPages: number
  password?: string | undefined
  fallbackDir?: string | undefined
  runFull: () => Promise<HostedOcrRun>
  runChunk: (chunkPath: string, chunkMetadata: DocumentMetadata, range: OcrPdfChunkRange) => Promise<HostedOcrRun>
  buildMalformedPageRun?: (rawText: string, range: OcrPdfChunkRange) => HostedOcrRun
  createChunk?: (inputPath: string, outputPath: string, range: OcrPdfChunkRange, password?: string | undefined) => Promise<void>
}

export const HOSTED_OCR_PDF_PAGE_FALLBACK_THRESHOLD = 20
const HOSTED_OCR_PDF_PAGE_FALLBACK_VERSION = 1
const HOSTED_OCR_PDF_PAGE_FALLBACK_MODE = 'single-page'
const HOSTED_OCR_PDF_PAGE_FALLBACK_STATE_FILE = 'fallback-state.json'
const HOSTED_OCR_PDF_PAGE_INPUTS_DIR = 'page-inputs'
const HOSTED_OCR_PDF_PAGE_RESULTS_DIR = 'page-results'
const HOSTED_OCR_PDF_PARTIAL_TEXT_FILE = 'partial-extraction.txt'

const NON_FALLBACK_MESSAGE_PATTERN = /(?:api key|environment variable is required|auth(?:entication|orization)?|unauthori[sz]ed|forbidden|invalid api key|permission denied|access denied|credential|not configured|setup failed|bucket is required|project id|processor id|content (?:filter|filtering|policy)|blocked by content|safety|policy violation|encrypted|decrypt|unsupported .*format|only supports .*image|convert .*image)/i
const FALLBACK_MESSAGE_PATTERN = /(?:timed out|timeout|deadline exceeded|temporar(?:y|ily)|network|connection|socket|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|rate limit|too many requests|overloaded|unavailable|malformed|invalid json|not valid json|schema|returned \d+ pages|non-contiguous|no pages|no text output|exceeds|too large|supports .* up to|file upload limit|page(?:s)? .*limit|maximum|payload too large|413|split .*smaller chunks?)/i

type StoredHostedOcrFallbackPage = {
  version: number
  mode: typeof HOSTED_OCR_PDF_PAGE_FALLBACK_MODE
  totalPages: number
  pageNumber: number
  run: HostedOcrRun
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getErrorMessage = (error: unknown): string => {
  const chain = collectErrorChain(error)
  if (chain.length === 0) {
    return error instanceof Error ? error.message : String(error)
  }
  return chain.map((entry) => entry.message).filter(Boolean).join(' | ')
}

const getErrorStatus = (error: unknown): number | undefined => {
  for (const entry of collectErrorChain(error)) {
    if (typeof entry['status'] === 'number') {
      return entry['status']
    }
  }
  return undefined
}

const formatRange = (range: OcrPdfChunkRange): string =>
  range.startPage === range.endPage ? `page ${range.startPage}` : `pages ${range.startPage}-${range.endPage}`

const summarizePdfChunkCreateCause = (stderr: string, stdout: string): string => {
  const raw = stripAnsi(stderr || stdout || '').trim()
  const firstLine = raw.split(/\r?\n/).map(line => line.trim()).find(line => line.length > 0)
  if (!firstLine) {
    return 'mutool convert failed'
  }
  return firstLine.length > 160 ? `${firstLine.slice(0, 157)}...` : firstLine
}

export const createOcrPdfChunkRenderError = (
  range: OcrPdfChunkRange,
  result: { exitCode: number, stderr: string, stdout: string, command: string }
): Error & {
  category: 'pdf_chunk_render'
  stage: 'pdf_chunk_render'
  pageStart: number
  pageEnd: number
  exitCode: number
  stderr: string
  stdout: string
  command: string
} =>
  Object.assign(
    new Error(`PDF chunk creation failed for ${formatRange(range)}: ${summarizePdfChunkCreateCause(result.stderr, result.stdout)}`),
    {
      category: 'pdf_chunk_render' as const,
      stage: 'pdf_chunk_render' as const,
      pageStart: range.startPage,
      pageEnd: range.endPage,
      exitCode: result.exitCode,
      stderr: result.stderr,
      stdout: result.stdout,
      command: result.command
    }
  )

export const getOcrPdfChunkRangePageCount = (range: OcrPdfChunkRange): number =>
  Math.max(0, range.endPage - range.startPage + 1)

export const shouldFallbackToOcrPdfChunks = (error: unknown): boolean => {
  const message = getErrorMessage(error)
  if (NON_FALLBACK_MESSAGE_PATTERN.test(message)) {
    return false
  }

  const status = getErrorStatus(error)
  if (typeof status === 'number') {
    if (status === 401 || status === 403) {
      return false
    }
    if (status === 408 || status === 425 || status === 429 || status === 413 || status >= 500) {
      return true
    }
  }

  return FALLBACK_MESSAGE_PATTERN.test(message)
}

export const remapOcrPagesToRange = (
  pages: PageResult[],
  range: OcrPdfChunkRange
): PageResult[] =>
  pages
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page, index) => ({
      ...page,
      pageNumber: range.startPage + index
    }))

export const stitchHostedOcrChunkRuns = (
  runs: HostedOcrRun[],
  totalPages: number
): HostedOcrRun => {
  const firstRun = runs[0]
  if (!firstRun) {
    throw new Error('OCR PDF chunk fallback produced no chunk results.')
  }

  const pages = runs
    .flatMap((run) => run.pages)
    .sort((a, b) => a.pageNumber - b.pageNumber)
  const canonicalTextChunks = runs
    .map((run) => run.canonicalText?.trim() ?? '')
  const canonicalText = canonicalTextChunks.every((text) => text.length > 0)
    ? canonicalTextChunks.join('\n\n')
    : ''
  const promptTokens = runs.reduce((sum, run) => sum + (run.promptTokens ?? 0), 0)
  const completionTokens = runs.reduce((sum, run) => sum + (run.completionTokens ?? 0), 0)
  const providerCostCents = runs.reduce((sum, run) => sum + (run.providerCostCents ?? 0), 0)
  const hasPromptTokens = runs.some((run) => typeof run.promptTokens === 'number')
  const hasCompletionTokens = runs.some((run) => typeof run.completionTokens === 'number')
  const hasProviderCost = runs.some((run) => typeof run.providerCostCents === 'number')
  const providerCostSources = runs
    .map((run) => run.providerCostSource)
    .filter((source): source is NonNullable<HostedOcrRun['providerCostSource']> => source !== undefined)
  const providerUsage = runs.flatMap((run) => run.providerUsage ?? [])

  return {
    pages,
    extractionMethod: firstRun.extractionMethod,
    ocrService: firstRun.ocrService,
    ocrModel: firstRun.ocrModel,
    totalPages,
    ...(canonicalText.length > 0 ? { canonicalText } : {}),
    ...(hasPromptTokens ? { promptTokens } : {}),
    ...(hasCompletionTokens ? { completionTokens } : {}),
    ...(hasProviderCost ? { providerCostCents } : {}),
    ...(providerCostSources.length > 0
      ? { providerCostSource: providerCostSources.includes('registry_fallback') ? 'registry_fallback' as const : 'provider_quote' as const }
      : {}),
    ...(providerUsage.length > 0 ? { providerUsage } : {})
  }
}

const defaultCreatePdfChunk = async (
  inputPath: string,
  outputPath: string,
  range: OcrPdfChunkRange,
  password?: string | undefined
): Promise<void> => {
  const pageRange = range.startPage === range.endPage
    ? String(range.startPage)
    : `${range.startPage}-${range.endPage}`
  const result = await splitPdfPages(inputPath, outputPath, pageRange, password)
  if (result.exitCode === 0 || (result.exitCode === 3 && result.tool === 'qpdf')) {
    return
  }
  try {
    const outputStat = await stat(outputPath)
    if (outputStat.size > 0) return
  } catch {
    // output file doesn't exist
  }
  throw createOcrPdfChunkRenderError(range, {
    exitCode: result.exitCode,
    stderr: result.stderr,
    stdout: result.stdout,
    command: `${result.tool} (${formatRange(range)})`
  })
}

const buildChunkMetadata = async (
  chunkPath: string,
  baseMetadata: DocumentMetadata,
  range: OcrPdfChunkRange
): Promise<DocumentMetadata> => {
  const chunkStats = await stat(chunkPath)
  return {
    ...baseMetadata,
    format: 'pdf',
    fileSize: chunkStats.size,
    pageCount: getOcrPdfChunkRangePageCount(range)
  }
}

const remapChunkRun = (
  run: HostedOcrRun,
  range: OcrPdfChunkRange
): HostedOcrRun => ({
  ...run,
  pages: remapOcrPagesToRange(run.pages, range),
  totalPages: getOcrPdfChunkRangePageCount(range)
})

const getFallbackStatePath = (fallbackDir: string): string =>
  join(fallbackDir, HOSTED_OCR_PDF_PAGE_FALLBACK_STATE_FILE)

const getFallbackPageResultsDir = (fallbackDir: string): string =>
  join(fallbackDir, HOSTED_OCR_PDF_PAGE_RESULTS_DIR)

const getFallbackPageInputsDir = (fallbackDir: string): string =>
  join(fallbackDir, HOSTED_OCR_PDF_PAGE_INPUTS_DIR)

const getFallbackPageResultPath = (fallbackDir: string, pageNumber: number): string =>
  join(getFallbackPageResultsDir(fallbackDir), `page-${String(pageNumber).padStart(6, '0')}.json`)

const getFallbackPageTextPath = (fallbackDir: string, pageNumber: number): string =>
  join(getFallbackPageResultsDir(fallbackDir), `page-${String(pageNumber).padStart(6, '0')}.txt`)

const getFallbackPageInvalidResponsePath = (fallbackDir: string, pageNumber: number): string =>
  join(getFallbackPageResultsDir(fallbackDir), `page-${String(pageNumber).padStart(6, '0')}-invalid-response.txt`)

const getFallbackPageInputPath = (fallbackDir: string, pageNumber: number): string =>
  join(getFallbackPageInputsDir(fallbackDir), `page-${String(pageNumber).padStart(6, '0')}.pdf`)

const getFallbackPartialTextPath = (fallbackDir: string): string =>
  join(fallbackDir, HOSTED_OCR_PDF_PARTIAL_TEXT_FILE)

const fallbackStateExists = async (fallbackDir: string | undefined): Promise<boolean> =>
  fallbackDir !== undefined && await Bun.file(getFallbackStatePath(fallbackDir)).exists()

const hasNonEmptyFile = async (filePath: string): Promise<boolean> => {
  try {
    const fileStats = await stat(filePath)
    return fileStats.size > 0
  } catch {
    return false
  }
}

const isPageResult = (value: unknown): value is PageResult =>
  isRecord(value)
  && typeof value['pageNumber'] === 'number'
  && (value['method'] === 'text' || value['method'] === 'ocr' || value['method'] === 'skipped')
  && typeof value['text'] === 'string'
  && (value['confidence'] === undefined || typeof value['confidence'] === 'number')

const isHostedOcrRun = (value: unknown): value is HostedOcrRun =>
  isRecord(value)
  && Array.isArray(value['pages'])
  && value['pages'].every(isPageResult)
  && typeof value['extractionMethod'] === 'string'
  && typeof value['ocrService'] === 'string'
  && typeof value['ocrModel'] === 'string'

const parseStoredFallbackPage = (
  value: unknown,
  pageNumber: number,
  totalPages: number
): HostedOcrRun | undefined => {
  if (
    !isRecord(value)
    || value['version'] !== HOSTED_OCR_PDF_PAGE_FALLBACK_VERSION
    || value['mode'] !== HOSTED_OCR_PDF_PAGE_FALLBACK_MODE
    || value['pageNumber'] !== pageNumber
    || value['totalPages'] !== totalPages
    || !isHostedOcrRun(value['run'])
  ) {
    return undefined
  }

  const run = value['run']
  if (run.pages.length !== 1 || run.pages[0]?.pageNumber !== pageNumber) {
    return undefined
  }

  return run
}

const readCachedFallbackPage = async (
  fallbackDir: string | undefined,
  pageNumber: number,
  totalPages: number
): Promise<HostedOcrRun | undefined> => {
  if (fallbackDir === undefined) {
    return undefined
  }

  try {
    const raw = await Bun.file(getFallbackPageResultPath(fallbackDir, pageNumber)).json()
    return parseStoredFallbackPage(raw, pageNumber, totalPages)
  } catch {
    return undefined
  }
}

const hasValidFallbackPageResults = async (
  fallbackDir: string | undefined,
  totalPages: number
): Promise<boolean> => {
  if (fallbackDir === undefined) {
    return false
  }

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    if (await readCachedFallbackPage(fallbackDir, pageNumber, totalPages) !== undefined) {
      return true
    }
  }

  return false
}

const writeFallbackState = async (
  fallbackDir: string | undefined,
  options: Pick<RunHostedOcrPdfChunkFallbackOptions, 'filePath' | 'serviceLabel'>,
  totalPages: number
): Promise<void> => {
  if (fallbackDir === undefined) {
    return
  }

  await mkdir(fallbackDir, { recursive: true })
  await Bun.write(getFallbackStatePath(fallbackDir), JSON.stringify({
    version: HOSTED_OCR_PDF_PAGE_FALLBACK_VERSION,
    mode: HOSTED_OCR_PDF_PAGE_FALLBACK_MODE,
    totalPages,
    serviceLabel: options.serviceLabel,
    sourceFile: basename(options.filePath)
  }, null, 2) + '\n')
}

const writeCachedFallbackPage = async (
  fallbackDir: string | undefined,
  pageNumber: number,
  totalPages: number,
  run: HostedOcrRun
): Promise<void> => {
  if (fallbackDir === undefined) {
    return
  }

  await mkdir(getFallbackPageResultsDir(fallbackDir), { recursive: true })
  await writeFallbackPageText(fallbackDir, pageNumber, run)
  const payload: StoredHostedOcrFallbackPage = {
    version: HOSTED_OCR_PDF_PAGE_FALLBACK_VERSION,
    mode: HOSTED_OCR_PDF_PAGE_FALLBACK_MODE,
    totalPages,
    pageNumber,
    run
  }
  await Bun.write(getFallbackPageResultPath(fallbackDir, pageNumber), JSON.stringify(payload, null, 2) + '\n')
}

const writeFallbackPageText = async (
  fallbackDir: string | undefined,
  pageNumber: number,
  run: HostedOcrRun
): Promise<void> => {
  if (fallbackDir === undefined) {
    return
  }

  const pageText = run.pages.find((page) => page.pageNumber === pageNumber)?.text ?? ''
  await mkdir(getFallbackPageResultsDir(fallbackDir), { recursive: true })
  await Bun.write(getFallbackPageTextPath(fallbackDir, pageNumber), pageText.endsWith('\n') ? pageText : `${pageText}\n`)
}

const writeInvalidFallbackPageResponse = async (
  fallbackDir: string | undefined,
  pageNumber: number,
  error: unknown
): Promise<void> => {
  if (fallbackDir === undefined) {
    return
  }

  const structuredError = findOcrStructuredResponseError(error)
  if (!structuredError) {
    return
  }

  await mkdir(getFallbackPageResultsDir(fallbackDir), { recursive: true })
  await Bun.write(getFallbackPageInvalidResponsePath(fallbackDir, pageNumber), structuredError.rawResponse)
}

const writeFallbackPartialText = async (
  fallbackDir: string | undefined,
  runs: HostedOcrRun[]
): Promise<void> => {
  if (fallbackDir === undefined) {
    return
  }

  const text = runs
    .flatMap((run) => run.pages)
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => `Page ${page.pageNumber}\n${page.text.trim()}`)
    .join('\n\n')
    .trim()

  await Bun.write(getFallbackPartialTextPath(fallbackDir), text.length > 0 ? `${text}\n` : '')
}

const resolveFallbackChunkPath = async (
  fallbackDir: string | undefined,
  tempDir: string,
  sourceFilePath: string,
  pageNumber: number
): Promise<{ chunkPath: string, persistent: boolean }> => {
  if (fallbackDir !== undefined) {
    await mkdir(getFallbackPageInputsDir(fallbackDir), { recursive: true })
    return {
      chunkPath: getFallbackPageInputPath(fallbackDir, pageNumber),
      persistent: true
    }
  }

  return {
    chunkPath: join(tempDir, `${basename(sourceFilePath, '.pdf')}-${pageNumber}.pdf`),
    persistent: false
  }
}

const validateSinglePageFallbackRun = (
  run: HostedOcrRun,
  pageNumber: number,
  serviceLabel: string
): HostedOcrRun => {
  if (run.pages.length !== 1 || run.pages[0]?.pageNumber !== pageNumber) {
    throw new Error(`${serviceLabel}: OCR fallback page ${pageNumber} returned ${run.pages.length} pages.`)
  }
  return run
}

const buildMalformedFallbackPageRun = (
  options: RunHostedOcrPdfChunkFallbackOptions,
  error: unknown,
  range: OcrPdfChunkRange
): HostedOcrRun | undefined => {
  const structuredError = findOcrStructuredResponseError(error)
  if (
    structuredError === undefined
    || structuredError.rawResponse.trim().length === 0
    || options.buildMalformedPageRun === undefined
  ) {
    return undefined
  }

  return validateSinglePageFallbackRun(
    options.buildMalformedPageRun(structuredError.rawResponse, range),
    range.startPage,
    options.serviceLabel
  )
}

type InitialFallbackReason = 'large-pdf' | 'fallback-state' | 'page-cache'

const resolveInitialFallbackReason = async (
  options: RunHostedOcrPdfChunkFallbackOptions,
  totalPages: number
): Promise<InitialFallbackReason | undefined> => {
  if (totalPages > HOSTED_OCR_PDF_PAGE_FALLBACK_THRESHOLD) {
    return 'large-pdf'
  }
  if (await fallbackStateExists(options.fallbackDir)) {
    return 'fallback-state'
  }
  if (await hasValidFallbackPageResults(options.fallbackDir, totalPages)) {
    return 'page-cache'
  }
  return undefined
}

export const runHostedOcrWithPdfChunkFallback = async (
  options: RunHostedOcrPdfChunkFallbackOptions
): Promise<HostedOcrRun> => {
  const totalPages = Math.max(1, Math.floor(options.totalPages))
  const runPageFallback = async (): Promise<HostedOcrRun> => {
    await writeFallbackState(options.fallbackDir, options, totalPages)
    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-pdf-pages-'))
    const createChunk = options.createChunk ?? defaultCreatePdfChunk

    const processPage = async (pageNumber: number): Promise<HostedOcrRun> => {
      const cached = await readCachedFallbackPage(options.fallbackDir, pageNumber, totalPages)
      if (cached !== undefined) {
        await writeFallbackPageText(options.fallbackDir, pageNumber, cached)
        l.write('info', `${options.serviceLabel}: OCR fallback page ${pageNumber} already cached`)
        return cached
      }

      const range = { startPage: pageNumber, endPage: pageNumber }
      const { chunkPath, persistent } = await resolveFallbackChunkPath(
        options.fallbackDir,
        tempDir,
        options.filePath,
        pageNumber
      )
      try {
        l.write('info', `${options.serviceLabel}: OCR fallback ${formatRange(range)}`)
        if (!await hasNonEmptyFile(chunkPath)) {
          await createChunk(options.filePath, chunkPath, range, options.password)
        }
        const chunkMetadata = await buildChunkMetadata(chunkPath, options.step1Metadata, range)
        const pageRun = validateSinglePageFallbackRun(
          remapChunkRun(await options.runChunk(chunkPath, chunkMetadata, range), range),
          pageNumber,
          options.serviceLabel
        )
        await writeCachedFallbackPage(options.fallbackDir, pageNumber, totalPages, pageRun)
        return pageRun
      } catch (error) {
        await writeInvalidFallbackPageResponse(options.fallbackDir, pageNumber, error)
        const malformedPageRun = buildMalformedFallbackPageRun(options, error, range)
        if (malformedPageRun !== undefined) {
          l.warn(`${options.serviceLabel}: OCR fallback page ${pageNumber} returned malformed structured output; treating raw response as page text`)
          await writeCachedFallbackPage(options.fallbackDir, pageNumber, totalPages, malformedPageRun)
          return malformedPageRun
        }
        throw error
      } finally {
        if (!persistent) {
          await rm(chunkPath, { force: true }).catch(() => {})
        }
      }
    }

    try {
      const runs: HostedOcrRun[] = []
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
        runs.push(await processPage(pageNumber))
        await writeFallbackPartialText(options.fallbackDir, runs)
      }
      l.write('info', `${options.serviceLabel}: OCR PDF page fallback completed for ${totalPages} pages`)
      return stitchHostedOcrChunkRuns(runs, totalPages)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }

  const initialFallbackReason = await resolveInitialFallbackReason(options, totalPages)
  if (initialFallbackReason !== undefined) {
    if (initialFallbackReason === 'large-pdf') {
      l.write('info', `${options.serviceLabel}: PDF has ${totalPages} pages; using resumable single-page OCR`)
    } else {
      l.write('info', `${options.serviceLabel}: OCR page fallback artifacts found; resuming single-page OCR`)
    }
    return await runPageFallback()
  }

  try {
    return await options.runFull()
  } catch (error) {
    if (!shouldFallbackToOcrPdfChunks(error)) {
      throw error
    }

    const message = classifyOcrProviderFailure(error).message
    l.warn(`${options.serviceLabel}: full-document OCR failed (${message}); retrying PDF one page at a time`)
    return await runPageFallback()
  }
}
