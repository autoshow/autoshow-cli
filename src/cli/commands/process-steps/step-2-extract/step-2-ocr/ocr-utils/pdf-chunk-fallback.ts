import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { DocumentMetadata, HostedOcrRun, PageResult } from '~/types'
import { ensureMutoolSetup } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { exec } from '~/utils/cli-utils'
import * as l from '~/utils/logger'
import { readPositiveIntegerEnv } from '~/utils/timeouts'
import { classifyOcrProviderFailure } from '../ocr-run-state'

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
  chunkPages?: number | undefined
  runFull: () => Promise<HostedOcrRun>
  runChunk: (chunkPath: string, chunkMetadata: DocumentMetadata, range: OcrPdfChunkRange) => Promise<HostedOcrRun>
  createChunk?: (inputPath: string, outputPath: string, range: OcrPdfChunkRange, password?: string | undefined) => Promise<void>
}

export const DEFAULT_OCR_FALLBACK_CHUNK_PAGES = 5
export const OCR_FALLBACK_CHUNK_PAGES = readPositiveIntegerEnv(
  'AUTOSHOW_OCR_FALLBACK_CHUNK_PAGES',
  DEFAULT_OCR_FALLBACK_CHUNK_PAGES
)

const NON_FALLBACK_MESSAGE_PATTERN = /(?:api key|environment variable is required|auth(?:entication|orization)?|unauthori[sz]ed|forbidden|invalid api key|permission denied|access denied|credential|not configured|setup failed|bucket is required|project id|processor id|content (?:filter|filtering|policy)|blocked by content|safety|policy violation|encrypted|decrypt|unsupported .*format|only supports .*image|convert .*image)/i
const FALLBACK_MESSAGE_PATTERN = /(?:timed out|timeout|deadline exceeded|temporar(?:y|ily)|network|connection|socket|ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|rate limit|too many requests|overloaded|unavailable|malformed|invalid json|not valid json|schema|returned \d+ pages|non-contiguous|no pages|no text output|exceeds|too large|supports .* up to|file upload limit|page(?:s)? .*limit|maximum|payload too large|413|split .*smaller chunks?)/i

type ErrorLike = Error & {
  cause?: unknown
  status?: unknown
}

const isErrorLike = (value: unknown): value is ErrorLike =>
  value instanceof Error

const collectErrorChain = (error: unknown): ErrorLike[] => {
  const chain: ErrorLike[] = []
  const seen = new Set<unknown>()
  let current: unknown = error

  while (isErrorLike(current) && !seen.has(current)) {
    chain.push(current)
    seen.add(current)
    current = current.cause
  }

  return chain
}

const getErrorMessage = (error: unknown): string => {
  const chain = collectErrorChain(error)
  if (chain.length === 0) {
    return error instanceof Error ? error.message : String(error)
  }
  return chain.map((entry) => entry.message).filter(Boolean).join(' | ')
}

const getErrorStatus = (error: unknown): number | undefined => {
  for (const entry of collectErrorChain(error)) {
    if (typeof entry.status === 'number') {
      return entry.status
    }
  }
  return undefined
}

const formatRange = (range: OcrPdfChunkRange): string =>
  range.startPage === range.endPage ? `page ${range.startPage}` : `pages ${range.startPage}-${range.endPage}`

export const getOcrPdfChunkRangePageCount = (range: OcrPdfChunkRange): number =>
  Math.max(0, range.endPage - range.startPage + 1)

export const buildOcrPdfChunkRanges = (
  totalPages: number,
  chunkPages: number
): OcrPdfChunkRange[] => {
  const pageCount = Math.max(1, Math.floor(totalPages))
  const chunkSize = Math.max(1, Math.floor(chunkPages))
  const ranges: OcrPdfChunkRange[] = []

  for (let startPage = 1; startPage <= pageCount; startPage += chunkSize) {
    ranges.push({
      startPage,
      endPage: Math.min(pageCount, startPage + chunkSize - 1)
    })
  }

  return ranges
}

export const splitOcrPdfChunkRange = (range: OcrPdfChunkRange): [OcrPdfChunkRange, OcrPdfChunkRange] => {
  const midpoint = Math.floor((range.startPage + range.endPage) / 2)
  return [
    { startPage: range.startPage, endPage: midpoint },
    { startPage: midpoint + 1, endPage: range.endPage }
  ]
}

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

  if (classifyOcrProviderFailure(error).retryable) {
    return true
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
  const canonicalText = runs
    .map((run) => run.canonicalText?.trim())
    .filter((text): text is string => typeof text === 'string' && text.length > 0)
    .join('\n\n')
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
  await ensureMutoolSetup()
  const pageRange = range.startPage === range.endPage
    ? String(range.startPage)
    : `${range.startPage}-${range.endPage}`
  const baseArgs = ['convert', '-F', 'pdf', '-o', outputPath, inputPath, pageRange]
  const args = password ? [...baseArgs, '-p', password] : baseArgs
  const result = await exec('mutool', args)
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || result.stdout || `mutool convert failed for ${pageRange}`)
  }
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

export const runHostedOcrWithPdfChunkFallback = async (
  options: RunHostedOcrPdfChunkFallbackOptions
): Promise<HostedOcrRun> => {
  try {
    return await options.runFull()
  } catch (error) {
    if (!shouldFallbackToOcrPdfChunks(error) || options.totalPages <= 1) {
      throw error
    }

    const chunkPages = Math.max(1, Math.floor(options.chunkPages ?? OCR_FALLBACK_CHUNK_PAGES))
    const message = classifyOcrProviderFailure(error).message
    l.warn(`${options.serviceLabel}: full-document OCR failed (${message}); retrying PDF in ${chunkPages}-page chunks`)

    const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-ocr-pdf-chunks-'))
    const createChunk = options.createChunk ?? defaultCreatePdfChunk

    const processRange = async (range: OcrPdfChunkRange): Promise<HostedOcrRun[]> => {
      const chunkPath = join(tempDir, `${basename(options.filePath, '.pdf')}-${range.startPage}-${range.endPage}.pdf`)
      try {
        l.write('info', `${options.serviceLabel}: OCR fallback ${formatRange(range)}`)
        await createChunk(options.filePath, chunkPath, range, options.password)
        const chunkMetadata = await buildChunkMetadata(chunkPath, options.step1Metadata, range)
        const chunkRun = await options.runChunk(chunkPath, chunkMetadata, range)
        return [remapChunkRun(chunkRun, range)]
      } catch (chunkError) {
        if (
          getOcrPdfChunkRangePageCount(range) <= 1
          || !shouldFallbackToOcrPdfChunks(chunkError)
        ) {
          throw chunkError
        }

        const [left, right] = splitOcrPdfChunkRange(range)
        const chunkMessage = classifyOcrProviderFailure(chunkError).message
        l.warn(`${options.serviceLabel}: OCR fallback ${formatRange(range)} failed (${chunkMessage}); splitting into ${formatRange(left)} and ${formatRange(right)}`)
        const leftRuns = await processRange(left)
        const rightRuns = await processRange(right)
        return [...leftRuns, ...rightRuns]
      } finally {
        await rm(chunkPath, { force: true }).catch(() => {})
      }
    }

    try {
      const initialRanges = buildOcrPdfChunkRanges(options.totalPages, chunkPages)
      const runs: HostedOcrRun[] = []
      for (const range of initialRanges) {
        runs.push(...await processRange(range))
      }
      l.write('info', `${options.serviceLabel}: OCR PDF chunk fallback completed for ${options.totalPages} pages`)
      return stitchHostedOcrChunkRuns(runs, options.totalPages)
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  }
}
