import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import type { DocumentMetadata, ExtractionOptions, PageResult } from '~/types'
import { withOcrPageRequestRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { runWithRenderedOcrPdfPages } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/pdf-page-rendering'
import {
  createOpenAIChatCompletion,
  extractOpenAIChatCompletionText,
  type OpenAIRestConfig
} from '~/utils/openai/client'
import {
  getGrokOcrClientConfig,
  GROK_OCR_IMAGE_BYTES
} from './grok'

const GROK_OCR_MAX_COMPLETION_TOKENS = 4096

const getImageMimeType = (format: DocumentMetadata['format']): string => {
  switch (format) {
    case 'png':
      return 'image/png'
    case 'jpg':
      return 'image/jpeg'
    default:
      throw new Error(`Unsupported Grok OCR image format: ${format}`)
  }
}

const buildOcrPrompt = (): string => [
  'Perform OCR on the provided page image.',
  'Return only the text visible on the page.',
  'Do not summarize, explain, or translate.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'If the page is blank or unreadable, return an empty string.'
].join(' ')

const assertImageWithinLimits = async (filePath: string, pageLabel: string): Promise<void> => {
  const fileStats = await stat(filePath)
  if (fileStats.size > GROK_OCR_IMAGE_BYTES) {
    throw new Error(`Grok OCR image input exceeds the 20 MiB image limit for ${basename(filePath)} (${pageLabel}).`)
  }
}

const readImageDataUrl = async (
  filePath: string,
  format: DocumentMetadata['format']
): Promise<string> => {
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  return `data:${getImageMimeType(format)};base64,${base64}`
}

const runGrokOcrImage = async (
  config: OpenAIRestConfig,
  imagePath: string,
  format: DocumentMetadata['format'],
  model: string,
  pageNumber: number,
  pageLabel: string
): Promise<{ page: PageResult, promptTokens?: number, completionTokens?: number }> => {
  await assertImageWithinLimits(imagePath, pageLabel)
  const imageUrl = await readImageDataUrl(imagePath, format)
  return await withOcrPageRequestRetry(
    `grok-ocr ${pageLabel}`,
    async (signal) => {
      const response = await createOpenAIChatCompletion(config, {
        model,
        max_completion_tokens: GROK_OCR_MAX_COMPLETION_TOKENS,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: buildOcrPrompt() },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }]
      }, { signal, errorMessagePrefix: 'Grok OCR request failed' })
      const rawText = extractOpenAIChatCompletionText(response) ?? ''

      return {
        page: { pageNumber, method: 'ocr', text: rawText.trim() },
        ...(typeof response.usage?.prompt_tokens === 'number' ? { promptTokens: response.usage.prompt_tokens } : {}),
        ...(typeof response.usage?.completion_tokens === 'number' ? { completionTokens: response.usage.completion_tokens } : {})
      }
    }
  )
}

export const runGrokOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  opts: Pick<ExtractionOptions, 'dpi' | 'password' | 'ocrPreparationCache'>
): Promise<{
  pages: PageResult[]
  extractionMethod: 'grok-ocr'
  totalPages: number
  promptTokens?: number
  completionTokens?: number
}> => {
  const config = getGrokOcrClientConfig()
  let promptTokens = 0
  let completionTokens = 0
  let hasPromptTokens = false
  let hasCompletionTokens = false
  const pages: PageResult[] = []

  const addUsage = (result: { promptTokens?: number, completionTokens?: number }): void => {
    if (typeof result.promptTokens === 'number') {
      promptTokens += result.promptTokens
      hasPromptTokens = true
    }
    if (typeof result.completionTokens === 'number') {
      completionTokens += result.completionTokens
      hasCompletionTokens = true
    }
  }

  if (step1Metadata.format !== 'pdf') {
    const result = await runGrokOcrImage(config, filePath, step1Metadata.format, model, 1, 'input image')
    addUsage(result)
    return {
      pages: [result.page],
      extractionMethod: 'grok-ocr',
      totalPages: 1,
      ...(hasPromptTokens ? { promptTokens } : {}),
      ...(hasCompletionTokens ? { completionTokens } : {})
    }
  }

  const totalPages = Math.max(1, step1Metadata.pageCount)
  pages.push(...await runWithRenderedOcrPdfPages({
    filePath,
    totalPages,
    dpi: opts.dpi,
    password: opts.password,
    ocrPreparationCache: opts.ocrPreparationCache,
    tempDirPrefix: 'autoshow-grok-ocr-',
    providerLabel: 'Grok OCR',
    onPage: async ({ imagePath, page }) => {
      const result = await runGrokOcrImage(config, imagePath, 'png', model, page, `page ${page}`)
      addUsage(result)
      return result.page
    }
  }))

  return {
    pages,
    extractionMethod: 'grok-ocr',
    totalPages,
    ...(hasPromptTokens ? { promptTokens } : {}),
    ...(hasCompletionTokens ? { completionTokens } : {})
  }
}
