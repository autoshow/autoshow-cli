import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { DocumentMetadata, ExtractionOptions, PageResult } from '~/types'
import { runWithRenderedOcrPdfPages } from './pdf-page-rendering'

export type HostedOcrImageResult = {
  page: PageResult
  promptTokens?: number
  completionTokens?: number
}

export const getHostedOcrImageMimeType = (
  format: DocumentMetadata['format'],
  providerLabel: string,
  supported: Partial<Record<DocumentMetadata['format'], string>>
): string => {
  const mimeType = supported[format]
  if (!mimeType) {
    throw new Error(`Unsupported ${providerLabel} image format: ${format}`)
  }
  return mimeType
}

export const assertHostedOcrImageWithinLimits = async (
  filePath: string,
  pageLabel: string,
  options: {
    providerLabel: string
    maxBytes: number
    limitLabel: string
  }
): Promise<void> => {
  const fileStats = await stat(filePath)
  if (fileStats.size > options.maxBytes) {
    throw new Error(`${options.providerLabel} image input exceeds the ${options.limitLabel} image limit for ${basename(filePath)} (${pageLabel}).`)
  }
}

export const readHostedOcrImageDataUrl = async (
  filePath: string,
  format: DocumentMetadata['format'],
  options: {
    providerLabel: string
    supportedMimeTypes: Partial<Record<DocumentMetadata['format'], string>>
  }
): Promise<string> => {
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  return `data:${getHostedOcrImageMimeType(format, options.providerLabel, options.supportedMimeTypes)};base64,${base64}`
}

export const createHostedOcrUsageAccumulator = (): {
  add: (result: Pick<HostedOcrImageResult, 'promptTokens' | 'completionTokens'>) => void
  values: () => { promptTokens?: number, completionTokens?: number }
} => {
  let promptTokens = 0
  let completionTokens = 0
  let hasPromptTokens = false
  let hasCompletionTokens = false

  return {
    add: (result) => {
      if (typeof result.promptTokens === 'number') {
        promptTokens += result.promptTokens
        hasPromptTokens = true
      }
      if (typeof result.completionTokens === 'number') {
        completionTokens += result.completionTokens
        hasCompletionTokens = true
      }
    },
    values: () => ({
      ...(hasPromptTokens ? { promptTokens } : {}),
      ...(hasCompletionTokens ? { completionTokens } : {})
    })
  }
}

export const runHostedOcrDocument = async <TExtractionMethod extends string>(
  filePath: string,
  step1Metadata: DocumentMetadata,
  opts: Pick<ExtractionOptions, 'dpi' | 'password' | 'ocrPreparationCache'>,
  options: {
    extractionMethod: TExtractionMethod
    tempDirPrefix: string
    providerLabel: string
    runImage: (
      imagePath: string,
      format: DocumentMetadata['format'],
      pageNumber: number,
      pageLabel: string
    ) => Promise<HostedOcrImageResult>
  }
): Promise<{
  pages: PageResult[]
  extractionMethod: TExtractionMethod
  totalPages: number
  promptTokens?: number
  completionTokens?: number
}> => {
  const usage = createHostedOcrUsageAccumulator()

  if (step1Metadata.format !== 'pdf') {
    const result = await options.runImage(filePath, step1Metadata.format, 1, 'input image')
    usage.add(result)
    return {
      pages: [result.page],
      extractionMethod: options.extractionMethod,
      totalPages: 1,
      ...usage.values()
    }
  }

  const totalPages = Math.max(1, step1Metadata.pageCount)
  const pages = await runWithRenderedOcrPdfPages({
    filePath,
    totalPages,
    dpi: opts.dpi,
    password: opts.password,
    ocrPreparationCache: opts.ocrPreparationCache,
    tempDirPrefix: options.tempDirPrefix,
    providerLabel: options.providerLabel,
    onPage: async ({ imagePath, page }) => {
      const result = await options.runImage(imagePath, 'png', page, `page ${page}`)
      usage.add(result)
      return result.page
    }
  })

  return {
    pages,
    extractionMethod: options.extractionMethod,
    totalPages,
    ...usage.values()
  }
}
