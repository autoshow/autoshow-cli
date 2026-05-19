import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import type { DocumentMetadata, ExtractionOptions, PageResult } from '~/types'
import { renderPageToImage } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { withOcrPageRequestRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { getCachedRenderedPageImage } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/preparation-cache'
import {
  DEEPINFRA_OCR_IMAGE_BYTES,
  getDeepinfraOcrClientConfig
} from './deepinfra-ocr'
import {
  createOpenAIChatCompletion,
  extractOpenAIChatCompletionText,
  type OpenAIRestConfig
} from '~/utils/openai/client'

const DEEPINFRA_OCR_MAX_TOKENS = 4092

const getImageMimeType = (format: DocumentMetadata['format']): string => {
  switch (format) {
    case 'png':
      return 'image/png'
    case 'jpg':
      return 'image/jpeg'
    case 'webp':
      return 'image/webp'
    default:
      throw new Error(`Unsupported DeepInfra OCR image format: ${format}`)
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
  if (fileStats.size > DEEPINFRA_OCR_IMAGE_BYTES) {
    throw new Error(`DeepInfra OCR image input exceeds the 20 MB image limit for ${basename(filePath)} (${pageLabel}).`)
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

const runDeepinfraOcrImage = async (
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
    `deepinfra-ocr ${pageLabel}`,
    async (signal) => {
      const response = await createOpenAIChatCompletion(config, {
        model,
        max_tokens: DEEPINFRA_OCR_MAX_TOKENS,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: buildOcrPrompt() },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }]
      }, { signal, errorMessagePrefix: 'DeepInfra OCR request failed' })
      const rawText = extractOpenAIChatCompletionText(response) ?? ''

      if (!rawText.trim()) {
        throw new Error('DeepInfra OCR returned no text output.')
      }

      return {
        page: { pageNumber, method: 'ocr', text: rawText.trim() },
        ...(typeof response.usage?.prompt_tokens === 'number' ? { promptTokens: response.usage.prompt_tokens } : {}),
        ...(typeof response.usage?.completion_tokens === 'number' ? { completionTokens: response.usage.completion_tokens } : {})
      }
    }
  )
}

export const runDeepinfraOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  opts: Pick<ExtractionOptions, 'dpi' | 'password' | 'rotate' | 'ocrPreparationCache'>
): Promise<{
  pages: PageResult[]
  extractionMethod: 'deepinfra-ocr'
  totalPages: number
  promptTokens?: number
  completionTokens?: number
}> => {
  const config = getDeepinfraOcrClientConfig()
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
    const result = await runDeepinfraOcrImage(config, filePath, step1Metadata.format, model, 1, 'input image')
    addUsage(result)
    return {
      pages: [result.page],
      extractionMethod: 'deepinfra-ocr',
      totalPages: 1,
      ...(hasPromptTokens ? { promptTokens } : {}),
      ...(hasCompletionTokens ? { completionTokens } : {})
    }
  }

  const totalPages = Math.max(1, step1Metadata.pageCount)
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-deepinfra-ocr-'))
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
            password: opts.password,
            rotate: opts.rotate
          },
          async (outputPath) => {
            const renderResult = await renderPageToImage(
              filePath,
              page,
              opts.dpi,
              outputPath,
              opts.password,
              opts.rotate
            )
            if (renderResult.exitCode !== 0) {
              throw new Error(renderResult.stderr || `Failed rendering page ${page} for DeepInfra OCR`)
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
          opts.password,
          opts.rotate
        )
        if (renderResult.exitCode !== 0) {
          throw new Error(renderResult.stderr || `Failed rendering page ${page} for DeepInfra OCR`)
        }
      }
      const result = await runDeepinfraOcrImage(config, renderedImagePath, 'png', model, page, `page ${page}`)
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
    extractionMethod: 'deepinfra-ocr',
    totalPages,
    ...(hasPromptTokens ? { promptTokens } : {}),
    ...(hasCompletionTokens ? { completionTokens } : {})
  }
}
