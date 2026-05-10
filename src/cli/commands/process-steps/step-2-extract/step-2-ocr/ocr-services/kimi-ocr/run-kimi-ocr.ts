import OpenAI from 'openai'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import * as v from 'valibot'
import type { DocumentMetadata, ExtractionOptions, PageResult } from '~/types'
import { parseAndValidateStructured } from '~/cli/commands/process-steps/step-3-write/structured-output/validator'
import { renderPageToImage } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { OCR_SCHEMA_RETRY_ATTEMPTS, withOcrCreateRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { getCachedRenderedPageImage } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/preparation-cache'
import { OcrStructuredResponseError } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import {
  KIMI_OCR_IMAGE_BYTES,
  ensureKimiApiKey,
  resolveKimiBaseUrl
} from './kimi'

const KIMI_OCR_MAX_COMPLETION_TOKENS = 8192

const KimiOcrEnvelopeSchema = v.object({
  pages: v.array(v.object({
    pageNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
    text: v.string()
  }))
})

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
  'Perform OCR on the provided page image.',
  'Return only JSON.',
  'Do not summarize, explain, or translate.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'If the page is blank or unreadable, return one page object with an empty string for text.',
  'Return exactly this JSON object shape: {"pages":[{"pageNumber":1,"text":"..."}]}.',
  'Return exactly one page object with pageNumber set to 1.'
].join(' ')

const normalizePages = (
  value: unknown,
  pageNumber: number
): PageResult[] => {
  const parsed = v.safeParse(KimiOcrEnvelopeSchema, value)
  if (!parsed.success) {
    throw new Error('Kimi OCR response did not match the expected page schema.')
  }

  if (parsed.output.pages.length !== 1) {
    throw new Error(`Kimi OCR returned ${parsed.output.pages.length} pages for a single page image.`)
  }

  const page = parsed.output.pages[0]
  if (!page) {
    throw new Error('Kimi OCR returned no pages.')
  }

  return [{
    pageNumber,
    method: 'ocr',
    text: page.text
  }]
}

const parseOcrResponse = (
  rawText: string,
  pageNumber: number
): PageResult[] => {
  const validation = parseAndValidateStructured(KimiOcrEnvelopeSchema, rawText)
  if (!validation.success) {
    throw new OcrStructuredResponseError(validation.issue ?? 'Kimi OCR response was not valid JSON.', rawText)
  }

  try {
    return normalizePages(validation.value, pageNumber)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new OcrStructuredResponseError(message, rawText)
  }
}

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

const runKimiOcrImage = async (
  client: OpenAI,
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
      async (signal) => await client.chat.completions.create({
        model,
        stream: false,
        max_completion_tokens: KIMI_OCR_MAX_COMPLETION_TOKENS,
        response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: buildOcrPrompt() },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }]
      } as any, { signal })
    )
    const rawText = response.choices[0]?.message?.content ?? ''

    try {
      if (!rawText.trim()) {
        throw new Error('Kimi OCR returned no text output.')
      }

      const pages = parseOcrResponse(rawText, pageNumber)
      return {
        page: pages[0]!,
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
  opts: Pick<ExtractionOptions, 'dpi' | 'password' | 'rotate' | 'ocrPreparationCache'>
): Promise<{
  pages: PageResult[]
  extractionMethod: 'kimi-ocr'
  totalPages: number
  promptTokens?: number
  completionTokens?: number
}> => {
  const apiKey = ensureKimiApiKey('Kimi OCR')
  const client = new OpenAI({ apiKey, baseURL: resolveKimiBaseUrl(), maxRetries: 0 })
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
    const result = await runKimiOcrImage(client, filePath, step1Metadata.format, model, 1, 'input image')
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
          opts.password,
          opts.rotate
        )
        if (renderResult.exitCode !== 0) {
          throw new Error(renderResult.stderr || `Failed rendering page ${page} for Kimi OCR`)
        }
      }
      const result = await runKimiOcrImage(client, renderedImagePath, 'png', model, page, `page ${page}`)
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
