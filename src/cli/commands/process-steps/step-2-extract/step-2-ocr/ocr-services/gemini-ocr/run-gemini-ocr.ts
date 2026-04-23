import { GoogleGenAI, createPartFromUri, createUserContent } from '@google/genai'
import { basename } from 'node:path'
import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { DocumentMetadata, PageResult } from '~/types'
import { parseAndValidateStructured } from '~/cli/commands/process-steps/step-3-write/structured-output/validator'
import { withRetry } from '~/utils/retries'
import { readEnv } from '~/utils/validate/env-utils'
import { classifyGeminiRetry } from '~/cli/commands/process-steps/step-3-write/write-services/gemini/gemini-utils'
import {
  GEMINI_FILE_UPLOAD_BYTES,
  GEMINI_INLINE_NON_PDF_BYTES,
  GEMINI_INLINE_PDF_BYTES
} from './gemini'

const GeminiOcrEnvelopeSchema = v.object({
  pages: v.array(v.object({
    pageNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
    text: v.string()
  }))
})

const GEMINI_OCR_JSON_SCHEMA = {
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

const buildOcrPrompt = (expectedPageCount: number): string => [
  'Perform OCR on the provided document or image.',
  'Return only JSON.',
  'Do not summarize, explain, or translate.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'If a page is blank or unreadable, return that page with an empty string for text.',
  `Return exactly ${expectedPageCount} page objects with contiguous pageNumber values from 1 through ${expectedPageCount}.`
].join(' ')

const normalizePages = (
  value: unknown,
  expectedPageCount: number
): PageResult[] => {
  const parsed = v.safeParse(GeminiOcrEnvelopeSchema, value)
  if (!parsed.success) {
    throw new Error('Gemini OCR response did not match the expected page schema.')
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
    throw new Error('Gemini OCR returned no pages.')
  }

  if (pages.length !== expectedPageCount) {
    throw new Error(`Gemini OCR returned ${pages.length} pages, expected ${expectedPageCount}.`)
  }

  for (let i = 0; i < pages.length; i++) {
    const expectedPageNumber = i + 1
    if (pages[i]?.pageNumber !== expectedPageNumber) {
      throw new Error('Gemini OCR returned non-contiguous page numbers.')
    }
  }

  return pages
}

const parseOcrResponse = (
  rawText: string,
  expectedPageCount: number
): PageResult[] => {
  const validation = parseAndValidateStructured(GeminiOcrEnvelopeSchema, rawText)
  if (!validation.success) {
    throw new Error(validation.issue ?? 'Gemini OCR response was not valid JSON.')
  }

  return normalizePages(validation.value, expectedPageCount)
}

const getGeminiMimeType = (format: DocumentMetadata['format']): string => {
  switch (format) {
    case 'pdf':
      return 'application/pdf'
    case 'bmp':
      return 'image/bmp'
    case 'jpg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    default:
      throw new Error(`Unsupported Gemini OCR format: ${format}`)
  }
}

const buildInlineContents = async (
  filePath: string,
  mimeType: string,
  prompt: string
): Promise<ReturnType<typeof createUserContent>> => {
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  return createUserContent([
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: base64
      }
    }
  ] as any)
}

const shouldUploadFile = (fileSizeBytes: number, format: DocumentMetadata['format']): boolean => {
  const inlineLimit = format === 'pdf'
    ? GEMINI_INLINE_PDF_BYTES
    : GEMINI_INLINE_NON_PDF_BYTES
  return fileSizeBytes > inlineLimit
}

export const runGeminiOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string
): Promise<{
  pages: PageResult[]
  extractionMethod: 'gemini-ocr'
  totalPages: number
  promptTokens?: number
  completionTokens?: number
}> => {
  const apiKey = readEnv('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is required for Gemini OCR')
  }

  const expectedPageCount = Math.max(1, step1Metadata.pageCount)
  const mimeType = getGeminiMimeType(step1Metadata.format)
  const prompt = buildOcrPrompt(expectedPageCount)
  const fileSizeBytes = Bun.file(filePath).size
  if (fileSizeBytes > GEMINI_FILE_UPLOAD_BYTES) {
    throw new Error(`Gemini OCR input exceeds the 2 GB file upload limit for ${basename(filePath)}.`)
  }

  const baseUrl = readEnv('GEMINI_BASE_URL')
  const ai = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {})
  })

  const response = await withRetry(
    {
      retryClass: 'runtime_http_create_conservative',
      operationName: 'gemini-ocr',
      policy: { maxAttempts: 3 }
    },
    async () => {
      let uploadedFileName: string | undefined
      try {
        const contents = shouldUploadFile(fileSizeBytes, step1Metadata.format)
          ? await (async () => {
              const uploadedFile = await ai.files.upload({
                file: filePath,
                config: {
                  mimeType,
                  displayName: basename(filePath)
                }
              })
              uploadedFileName = uploadedFile.name ?? undefined
              const fileMimeType = uploadedFile.mimeType ?? mimeType
              if (typeof uploadedFile.uri !== 'string' || uploadedFile.uri.length === 0) {
                throw new Error('Gemini Files API upload did not return a file URI.')
              }
              return createUserContent([
                { text: prompt },
                createPartFromUri(uploadedFile.uri, fileMimeType)
              ] as any)
            })()
          : await buildInlineContents(filePath, mimeType, prompt)

        return await ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: 'application/json',
            responseJsonSchema: GEMINI_OCR_JSON_SCHEMA
          }
        })
      } finally {
        if (uploadedFileName) {
          try {
            await ai.files.delete({ name: uploadedFileName })
          } catch (error) {
            l.warn(`Failed to delete Gemini OCR upload ${uploadedFileName}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }
    },
    classifyGeminiRetry
  )

  const rawText = response.text ?? ''
  if (!rawText.trim()) {
    throw new Error('Gemini OCR returned no text output.')
  }

  const usage = response.usageMetadata
  return {
    pages: parseOcrResponse(rawText, expectedPageCount),
    extractionMethod: 'gemini-ocr',
    totalPages: expectedPageCount,
    ...(typeof usage?.promptTokenCount === 'number' ? { promptTokens: usage.promptTokenCount } : {}),
    ...(typeof usage?.candidatesTokenCount === 'number' ? { completionTokens: usage.candidatesTokenCount } : {})
  }
}
