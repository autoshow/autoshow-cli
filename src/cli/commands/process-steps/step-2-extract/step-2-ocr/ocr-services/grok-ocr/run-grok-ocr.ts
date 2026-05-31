import type { DocumentMetadata, ExtractionOptions, PageResult } from '~/types'
import { withOcrPageRequestRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import {
  assertHostedOcrImageWithinLimits,
  readHostedOcrImageDataUrl,
  runHostedOcrDocument,
  type HostedOcrImageResult
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/hosted-ocr-utils'
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
const GROK_OCR_IMAGE_MIME_TYPES: Partial<Record<DocumentMetadata['format'], string>> = {
  png: 'image/png',
  jpg: 'image/jpeg'
}

const buildOcrPrompt = (): string => [
  'Perform OCR on the provided page image.',
  'Return only the text visible on the page.',
  'Do not summarize, explain, or translate.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'If the page is blank or unreadable, return an empty string.'
].join(' ')

const runGrokOcrImage = async (
  config: OpenAIRestConfig,
  imagePath: string,
  format: DocumentMetadata['format'],
  model: string,
  pageNumber: number,
  pageLabel: string
): Promise<HostedOcrImageResult> => {
  await assertHostedOcrImageWithinLimits(imagePath, pageLabel, {
    providerLabel: 'Grok OCR',
    maxBytes: GROK_OCR_IMAGE_BYTES,
    limitLabel: '20 MiB'
  })
  const imageUrl = await readHostedOcrImageDataUrl(imagePath, format, {
    providerLabel: 'Grok OCR',
    supportedMimeTypes: GROK_OCR_IMAGE_MIME_TYPES
  })
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
  return await runHostedOcrDocument(filePath, step1Metadata, opts, {
    extractionMethod: 'grok-ocr',
    tempDirPrefix: 'autoshow-grok-ocr-',
    providerLabel: 'Grok OCR',
    runImage: async (imagePath, format, pageNumber, pageLabel) =>
      await runGrokOcrImage(config, imagePath, format, model, pageNumber, pageLabel)
  })
}
