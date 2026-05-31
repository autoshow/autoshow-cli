import * as v from 'valibot'
import type { DocumentMetadata, PageResult } from '~/types'
import { parseAndValidateStructured } from '~/cli/commands/process-steps/step-3-write/structured-output/validator'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/openai/openai-utils'
import { OCR_SCHEMA_RETRY_ATTEMPTS, withOcrCreateRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { OcrStructuredResponseError } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import type { OpenAIOcrInputContent } from '~/types'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/client'
import { buildHostedOcrJsonPrompt, normalizeHostedOcrPages } from '../../ocr-utils/hosted-ocr-json'

const OPENAI_NATIVE_STRUCTURED_MODELS = new Set([
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
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

const buildSchemaGuidedPrompt = (expectedPageCount: number): string => [
  buildHostedOcrJsonPrompt(expectedPageCount),
  'Use this exact JSON shape:',
  JSON.stringify(OPENAI_OCR_JSON_SCHEMA)
].join('\n\n')

const buildSinglePageTextPrompt = (): string => [
  'Perform OCR on the provided single page.',
  'Return only the visible text from the page.',
  'Do not summarize, explain, translate, or wrap the text in JSON.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'If the page is blank or unreadable, return an empty response.'
].join(' ')

const normalizePages = (
  value: unknown,
  expectedPageCount: number
): PageResult[] => {
  const parsed = v.safeParse(OpenAIOcrEnvelopeSchema, value)
  if (!parsed.success) {
    throw new Error('OpenAI OCR response did not match the expected page schema.')
  }

  return normalizeHostedOcrPages(parsed.output.pages, expectedPageCount, {
    emptyPagesMessage: 'OpenAI OCR returned no pages.',
    countMismatchMessage: (actual, expected) => `OpenAI OCR returned ${actual} pages, expected ${expected}.`,
    nonContiguousMessage: 'OpenAI OCR returned non-contiguous page numbers.'
  })
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

const parseSinglePageOcrResponse = (rawText: string): PageResult[] => {
  try {
    return parseOcrResponse(rawText, 1)
  } catch {
    return [{
      pageNumber: 1,
      method: 'ocr' as const,
      text: rawText.trim()
    }]
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
  const singlePageText = expectedPageCount === 1

  const requestBody: Record<string, unknown> = {
    model,
    input: [{
      role: 'user',
      content: [
        {
          type: 'input_text',
          text: singlePageText
            ? buildSinglePageTextPrompt()
            : nativeStructured
            ? buildHostedOcrJsonPrompt(expectedPageCount)
            : buildSchemaGuidedPrompt(expectedPageCount)
        },
        inputContent
      ]
    }]
  }

  if (singlePageText) {
    requestBody['text'] = {
      verbosity: 'low'
    }
  } else if (nativeStructured) {
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

  let lastError: Error | undefined

  for (let attempt = 0; attempt < OCR_SCHEMA_RETRY_ATTEMPTS; attempt++) {
    const requestBody = await createRequestBody(filePath, step1Metadata, model, expectedPageCount)
    const response = await withOcrCreateRetry(
      'openai-ocr',
      async (signal) => await createOpenAIResponse(config, requestBody, {
        signal
      })
    )
    const rawText = extractOpenAIResponseText(response) ?? ''

    try {
      if (!rawText.trim()) {
        if (expectedPageCount === 1) {
          return {
            pages: [{
              pageNumber: 1,
              method: 'ocr',
              text: ''
            }],
            extractionMethod: 'openai-ocr',
            totalPages: 1,
            ...(typeof response.usage?.input_tokens === 'number' ? { promptTokens: response.usage.input_tokens } : {}),
            ...(typeof response.usage?.output_tokens === 'number' ? { completionTokens: response.usage.output_tokens } : {})
          }
        }
        throw new Error('OpenAI OCR returned no text output.')
      }

      const pages = expectedPageCount === 1
        ? parseSinglePageOcrResponse(rawText)
        : parseOcrResponse(rawText, expectedPageCount)

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
