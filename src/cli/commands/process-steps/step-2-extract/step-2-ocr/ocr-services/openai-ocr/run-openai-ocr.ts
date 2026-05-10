import OpenAI from 'openai'
import * as v from 'valibot'
import type { DocumentMetadata, PageResult } from '~/types'
import { parseAndValidateStructured } from '~/cli/commands/process-steps/step-3-write/structured-output/validator'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/openai/openai-utils'
import { OCR_SCHEMA_RETRY_ATTEMPTS, withOcrCreateRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { OcrStructuredResponseError } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import type { OpenAIOcrInputContent } from '~/types'

const OPENAI_NATIVE_STRUCTURED_MODELS = new Set([
  'gpt-5.4',
  'gpt-5.4-nano'
])

const OpenAIOcrEnvelopeSchema = v.object({
  pages: v.array(v.object({
    pageNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
    text: v.string()
  }))
})

const OPENAI_OCR_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['pages'],
  properties: {
    pages: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['pageNumber', 'text'],
        properties: {
          pageNumber: {
            type: 'integer',
            minimum: 1
          },
          text: {
            type: 'string'
          }
        }
      }
    }
  }
} as const

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
      throw new Error(`Unsupported OpenAI OCR image format: ${format}`)
  }
}

const supportsNativeStructuredOutput = (model: string): boolean =>
  OPENAI_NATIVE_STRUCTURED_MODELS.has(model)

const buildOcrPrompt = (expectedPageCount: number): string => [
  'Perform OCR on the provided document or image.',
  'Return only JSON.',
  'Do not summarize, explain, or translate.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'If a page is blank or unreadable, return that page with an empty string for text.',
  `Return exactly ${expectedPageCount} page objects with contiguous pageNumber values from 1 through ${expectedPageCount}.`
].join(' ')

const buildSchemaGuidedPrompt = (expectedPageCount: number): string => [
  buildOcrPrompt(expectedPageCount),
  'Use this exact JSON shape:',
  JSON.stringify(OPENAI_OCR_JSON_SCHEMA)
].join('\n\n')

const normalizePages = (
  value: unknown,
  expectedPageCount: number
): PageResult[] => {
  const parsed = v.safeParse(OpenAIOcrEnvelopeSchema, value)
  if (!parsed.success) {
    throw new Error('OpenAI OCR response did not match the expected page schema.')
  }

  const pages = parsed.output.pages
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => ({
      pageNumber: page.pageNumber,
      method: 'ocr' as const,
      text: page.text
    }))

  if (pages.length === 0) {
    throw new Error('OpenAI OCR returned no pages.')
  }

  if (pages.length !== expectedPageCount) {
    throw new Error(`OpenAI OCR returned ${pages.length} pages, expected ${expectedPageCount}.`)
  }

  for (let i = 0; i < pages.length; i++) {
    const expectedPageNumber = i + 1
    if (pages[i]?.pageNumber !== expectedPageNumber) {
      throw new Error('OpenAI OCR returned non-contiguous page numbers.')
    }
  }

  return pages
}

const parseOcrResponse = (
  rawText: string,
  expectedPageCount: number
): PageResult[] => {
  const validation = parseAndValidateStructured(OpenAIOcrEnvelopeSchema, rawText)
  if (!validation.success) {
    throw new OcrStructuredResponseError(validation.issue ?? 'OpenAI OCR response was not valid JSON.', rawText)
  }

  try {
    return normalizePages(validation.value, expectedPageCount)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new OcrStructuredResponseError(message, rawText)
  }
}

const createInputContent = async (
  filePath: string,
  step1Metadata: DocumentMetadata
): Promise<OpenAIOcrInputContent> => {
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  if (step1Metadata.format === 'pdf') {
    return {
      type: 'input_file',
      filename: 'document.pdf',
      file_data: `data:application/pdf;base64,${base64}`
    }
  }

  return {
    type: 'input_image',
    detail: 'high',
    image_url: `data:${getImageMimeType(step1Metadata.format)};base64,${base64}`
  }
}

const createRequestBody = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  expectedPageCount: number
): Promise<Record<string, unknown>> => {
  const inputContent = await createInputContent(filePath, step1Metadata)
  const nativeStructured = supportsNativeStructuredOutput(model)

  const requestBody: Record<string, unknown> = {
    model,
    input: [{
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: nativeStructured
            ? buildOcrPrompt(expectedPageCount)
            : buildSchemaGuidedPrompt(expectedPageCount)
        },
        inputContent
      ]
    }]
  }

  if (nativeStructured) {
    requestBody['text'] = {
      verbosity: 'low',
      format: {
        type: 'json_schema',
        name: 'ocr_pages',
        schema: OPENAI_OCR_JSON_SCHEMA,
        strict: true
      }
    }
  } else {
    requestBody['text'] = {
      verbosity: 'low'
    }
  }

  return requestBody
}

export const runOpenAIOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string
): Promise<{
  pages: PageResult[]
  extractionMethod: 'openai-ocr'
  totalPages: number
  promptTokens?: number
  completionTokens?: number
}> => {
  const expectedPageCount = Math.max(1, step1Metadata.pageCount)
  const config = getOpenAIClientConfig()
  const client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, ...(config.baseURL ? { baseURL: config.baseURL } : {}) })

  let lastError: Error | undefined

  for (let attempt = 0; attempt < OCR_SCHEMA_RETRY_ATTEMPTS; attempt++) {
    const requestBody = await createRequestBody(filePath, step1Metadata, model, expectedPageCount)
    const response = await withOcrCreateRetry(
      'openai-ocr',
      async (signal) => await client.responses.create(requestBody as OpenAI.Responses.ResponseCreateParamsNonStreaming, {
        signal
      })
    )
    const rawText = response.output_text || ''

    try {
      if (!rawText.trim()) {
        throw new Error('OpenAI OCR returned no text output.')
      }

      const pages = parseOcrResponse(rawText, expectedPageCount)

      return {
        pages,
        extractionMethod: 'openai-ocr',
        totalPages: pages.length,
        ...(typeof response.usage?.input_tokens === 'number' ? { promptTokens: response.usage.input_tokens } : {}),
        ...(typeof response.usage?.output_tokens === 'number' ? { completionTokens: response.usage.output_tokens } : {})
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < OCR_SCHEMA_RETRY_ATTEMPTS - 1) {
        continue
      }
    }
  }

  throw lastError ?? new Error('OpenAI OCR failed')
}
