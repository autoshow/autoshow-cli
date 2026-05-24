import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { DocumentMetadata, ExtractionOptions, PageResult } from '~/types'
import { renderPageToImage } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { OCR_SCHEMA_RETRY_ATTEMPTS, withOcrCreateRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { getCachedRenderedPageImage } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/preparation-cache'
import { OcrStructuredResponseError } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import {
  KIMI_OCR_IMAGE_BYTES,
  ensureKimiApiKey,
  resolveKimiBaseUrl
} from './kimi'
import {
  createOpenAIChatCompletion,
  extractOpenAIChatCompletionText,
  type OpenAIRestConfig
} from '~/utils/openai/client'

const KIMI_OCR_MAX_COMPLETION_TOKENS = 8192

const getImageMimeType = (format: DocumentMetadata['format']): string => {
  switch (format) {
    case 'png':
      return 'image/png'
    case 'jpg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    case 'gif':
      return 'image/gif'
    default:
      throw new Error(`Unsupported Kimi OCR image format: ${format}`)
  }
}

const buildOcrPrompt = (): string => [
  'Perform OCR on the provided single page image.',
  'Return only the visible text from the page.',
  'Do not summarize, explain, or translate.',
  'Do not wrap the text in JSON, Markdown, or code fences.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'Collapse long runs of spaces or tabs used only for visual alignment.',
  'If the page is blank or unreadable, return an empty response.'
].join(' ')

const assertImageWithinLimits = async (filePath: string, pageLabel: string): Promise<void> => {
  const fileStats = await stat(filePath)
  if (fileStats.size > KIMI_OCR_IMAGE_BYTES) {
    throw new Error(`Kimi OCR image input exceeds the 100 MB image limit for ${basename(filePath)} (${pageLabel}).`)
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

const isLengthFinishReason = (
  finishReason: string | null | undefined
): boolean =>
  finishReason === 'length' || finishReason === 'max_tokens'

const buildTruncatedResponseError = (
  rawText: string,
  pageLabel: string
): OcrStructuredResponseError => {
  const error = new OcrStructuredResponseError(
    `Kimi OCR response for ${pageLabel} stopped at the max completion token limit before finishing.`,
    rawText
  )
  ;(error as OcrStructuredResponseError & { category: 'provider_limit' }).category = 'provider_limit'
  return error
}

const runKimiOcrImage = async (
  config: OpenAIRestConfig,
  imagePath: string,
  format: DocumentMetadata['format'],
  model: string,
  pageNumber: number,
  pageLabel: string
): Promise<{ page: PageResult, promptTokens?: number, completionTokens?: number }> => {
  await assertImageWithinLimits(imagePath, pageLabel)
  const imageUrl = await readImageDataUrl(imagePath, format)
  let lastError: Error | undefined

  for (let attempt = 0; attempt < OCR_SCHEMA_RETRY_ATTEMPTS; attempt++) {
    const response = await withOcrCreateRetry(
      'kimi-ocr',
      async (signal) => await createOpenAIChatCompletion(config, {
        model,
        stream: false,
        max_completion_tokens: KIMI_OCR_MAX_COMPLETION_TOKENS,
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: buildOcrPrompt() },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }]
      }, { signal, errorMessagePrefix: 'Kimi OCR request failed' })
    )
    const rawText = extractOpenAIChatCompletionText(response) ?? ''
    const finishReason = response.choices?.[0]?.finish_reason

    try {
      if (isLengthFinishReason(finishReason)) {
        throw buildTruncatedResponseError(rawText, pageLabel)
      }
      if (!rawText.trim()) {
        throw new Error('Kimi OCR returned no text output.')
      }

      return {
        page: {
          pageNumber,
          method: 'ocr',
          text: rawText.trim()
        },
        ...(typeof response.usage?.prompt_tokens === 'number' ? { promptTokens: response.usage.prompt_tokens } : {}),
        ...(typeof response.usage?.completion_tokens === 'number' ? { completionTokens: response.usage.completion_tokens } : {})
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < OCR_SCHEMA_RETRY_ATTEMPTS - 1) {
        continue
      }
    }
  }

  throw lastError ?? new Error('Kimi OCR failed')
}

export const runKimiOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  opts: Pick<ExtractionOptions, 'dpi' | 'password' | 'ocrPreparationCache'>
): Promise<{
  pages: PageResult[]
  extractionMethod: 'kimi-ocr'
  totalPages: number
  promptTokens?: number
  completionTokens?: number
}> => {
  const apiKey = ensureKimiApiKey('Kimi OCR')
  const config = { apiKey, baseURL: resolveKimiBaseUrl() }
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
    const result = await runKimiOcrImage(config, filePath, step1Metadata.format, model, 1, 'input image')
    addUsage(result)
    return {
      pages: [result.page],
      extractionMethod: 'kimi-ocr',
      totalPages: 1,
      ...(hasPromptTokens ? { promptTokens } : {}),
      ...(hasCompletionTokens ? { completionTokens } : {})
    }
  }

  const totalPages = Math.max(1, step1Metadata.pageCount)
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-kimi-ocr-'))
  try {
    for (let page = 1; page <= totalPages; page++) {
      const imagePath = join(tempDir, `page-${String(page).padStart(3, '0')}.png`)
      let renderedImagePath = imagePath
      let removeRenderedImage = true
      if (opts.ocrPreparationCache) {
        const rendered = await getCachedRenderedPageImage(
          opts.ocrPreparationCache,
          {
            filePath,
            page,
            dpi: opts.dpi,
            password: opts.password
          },
          async (outputPath) => {
            const renderResult = await renderPageToImage(
              filePath,
              page,
              opts.dpi,
              outputPath,
              opts.password
            )
            if (renderResult.exitCode !== 0) {
              throw new Error(renderResult.stderr || `Failed rendering page ${page} for Kimi OCR`)
            }
          }
        )
        renderedImagePath = rendered.imagePath
        removeRenderedImage = false
      } else {
        const renderResult = await renderPageToImage(
          filePath,
          page,
          opts.dpi,
          imagePath,
          opts.password
        )
        if (renderResult.exitCode !== 0) {
          throw new Error(renderResult.stderr || `Failed rendering page ${page} for Kimi OCR`)
        }
      }
      const result = await runKimiOcrImage(config, renderedImagePath, 'png', model, page, `page ${page}`)
      addUsage(result)
      pages.push(result.page)
      if (removeRenderedImage) {
        await rm(imagePath, { force: true })
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }

  return {
    pages,
    extractionMethod: 'kimi-ocr',
    totalPages,
    ...(hasPromptTokens ? { promptTokens } : {}),
    ...(hasCompletionTokens ? { completionTokens } : {})
  }
}
