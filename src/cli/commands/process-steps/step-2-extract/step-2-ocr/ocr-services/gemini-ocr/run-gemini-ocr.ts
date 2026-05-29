import { basename } from 'node:path'
import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { DocumentMetadata, PageResult } from '~/types'
import { parseAndValidateStructured } from '~/cli/commands/process-steps/step-3-write/structured-output/validator'
import { readEnv } from '~/utils/validate/env-utils'
import { classifyGeminiRetry } from '~/cli/commands/process-steps/step-3-write/write-services/gemini/gemini-utils'
import { classifyOcrCreateRetry, OCR_SCHEMA_RETRY_ATTEMPTS, withOcrCreateRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { getCachedCloudStagingObject } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/preparation-cache'
import { OcrStructuredResponseError } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import type { RetryDecision } from '~/types'
import { buildHostedOcrJsonPrompt, normalizeHostedOcrPages } from '../../ocr-utils/hosted-ocr-json'
import {
  geminiDeleteFile,
  geminiFileDataPart,
  geminiGenerateContent,
  geminiGetFile,
  geminiUploadFile,
  geminiUserContent,
  getGeminiFileState,
  type GeminiContent
} from '~/utils/gemini/gemini-rest'
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

const normalizePages = (
  value: unknown,
  expectedPageCount: number
): PageResult[] => {
  const parsed = v.safeParse(GeminiOcrEnvelopeSchema, value)
  if (!parsed.success) {
    throw new Error('Gemini OCR response did not match the expected page schema.')
  }

  return normalizeHostedOcrPages(parsed.output.pages, expectedPageCount, {
    emptyPagesMessage: 'Gemini OCR returned no pages.',
    countMismatchMessage: (actual, expected) => `Gemini OCR returned ${actual} pages, expected ${expected}.`,
    nonContiguousMessage: 'Gemini OCR returned non-contiguous page numbers.'
  })
}

const parseOcrResponse = (
  rawText: string,
  expectedPageCount: number
): PageResult[] => {
  const validation = parseAndValidateStructured(GeminiOcrEnvelopeSchema, rawText)
  if (!validation.success) {
    throw new OcrStructuredResponseError(validation.issue ?? 'Gemini OCR response was not valid JSON.', rawText)
  }

  try {
    return normalizePages(validation.value, expectedPageCount)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new OcrStructuredResponseError(message, rawText)
  }
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
): Promise<GeminiContent> => {
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  return geminiUserContent([
    { text: prompt },
    {
      inlineData: {
        mimeType,
        data: base64
      }
    }
  ])
}

const shouldUploadFile = (fileSizeBytes: number, format: DocumentMetadata['format']): boolean => {
  const inlineLimit = format === 'pdf'
    ? GEMINI_INLINE_PDF_BYTES
    : GEMINI_INLINE_NON_PDF_BYTES
  return fileSizeBytes > inlineLimit
}

const classifyGeminiOcrRetry = (error: unknown): RetryDecision => {
  const ocrDecision = classifyOcrCreateRetry(error)
  if (ocrDecision.shouldRetry) {
    return ocrDecision
  }
  return classifyGeminiRetry(error)
}

const waitForGeminiFile = async (
  apiKey: string,
  fileName: string
): Promise<void> => {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    const file = await geminiGetFile(apiKey, fileName)
    const state = getGeminiFileState(file)
    if (state === undefined || state === 'ACTIVE') {
      return
    }
    if (state === 'FAILED') {
      throw new Error(`Gemini Files API upload failed for ${fileName}`)
    }
    await Bun.sleep(1000)
  }
  throw new Error(`Gemini Files API upload did not become active for ${fileName}`)
}

export const runGeminiOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  opts: { ocrPreparationCache?: import('~/types').OcrPreparationCache | undefined } = {}
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
  const prompt = buildHostedOcrJsonPrompt(expectedPageCount)
  const fileSizeBytes = Bun.file(filePath).size
  if (fileSizeBytes > GEMINI_FILE_UPLOAD_BYTES) {
    throw new Error(`Gemini OCR input exceeds the 2 GB file upload limit for ${basename(filePath)}.`)
  }

  let lastSchemaError: Error | undefined

  for (let attempt = 0; attempt < OCR_SCHEMA_RETRY_ATTEMPTS; attempt++) {
    const response = await withOcrCreateRetry(
      'gemini-ocr',
      async (signal) => {
        let uploadedFileName: string | undefined
        try {
          const contents = shouldUploadFile(fileSizeBytes, step1Metadata.format)
            ? await (async () => {
                const staged = await getCachedCloudStagingObject(
                  opts.ocrPreparationCache,
                  {
                    provider: 'gemini',
                    filePath,
                    mimeType,
                    displayName: basename(filePath)
                  },
                  async () => {
                    const uploadedFile = await geminiUploadFile(apiKey, filePath, {
                      mimeType,
                      displayName: basename(filePath),
                      ...(signal ? { abortSignal: signal } : {})
                    })
                    const name = uploadedFile.name ?? undefined
                    if (name) {
                      await waitForGeminiFile(apiKey, name)
                    }
                    const fileMimeType = uploadedFile.mimeType ?? mimeType
                    if (typeof uploadedFile.uri !== 'string' || uploadedFile.uri.length === 0) {
                      throw new Error('Gemini Files API upload did not return a file URI.')
                    }
                    return {
                      uri: uploadedFile.uri,
                      mimeType: fileMimeType,
                      name,
                      cleanup: async () => {
                        if (name) {
                          await geminiDeleteFile(apiKey, name)
                        }
                      }
                    }
                  }
                )
                uploadedFileName = opts.ocrPreparationCache ? undefined : staged.name
                return geminiUserContent([
                  { text: prompt },
                  geminiFileDataPart(staged.uri, staged.mimeType)
                ])
              })()
            : await buildInlineContents(filePath, mimeType, prompt)

          return await geminiGenerateContent(apiKey, {
            model,
            contents,
            generationConfig: {
              responseMimeType: 'application/json',
              responseJsonSchema: GEMINI_OCR_JSON_SCHEMA
            },
            ...(signal ? { abortSignal: signal } : {})
          })
        } finally {
          if (uploadedFileName) {
            try {
              await geminiDeleteFile(apiKey, uploadedFileName)
            } catch (error) {
              l.warn(`Failed to delete Gemini OCR upload ${uploadedFileName}: ${error instanceof Error ? error.message : String(error)}`)
            }
          }
        }
      },
      classifyGeminiOcrRetry
    )

    const rawText = response.text ?? ''
    try {
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
    } catch (error) {
      lastSchemaError = error instanceof Error ? error : new Error(String(error))
      if (attempt < OCR_SCHEMA_RETRY_ATTEMPTS - 1) {
        l.warn('Gemini OCR returned malformed output; retrying')
      }
    }
  }

  throw lastSchemaError ?? new Error('Gemini OCR failed')
}
