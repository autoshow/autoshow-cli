import { basename, join } from 'node:path'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { DocumentMetadata, PageResult } from '~/types'
import { parseAndValidateStructured } from '~/cli/commands/process-steps/step-3-write/structured-output/validator'
import { splitPdfPages } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { getAnthropicClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/anthropic/anthropic-utils'
import { OCR_SCHEMA_RETRY_ATTEMPTS, withOcrCreateRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { OcrStructuredResponseError } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-structured-response-error'
import { OCR_REQUEST_TIMEOUT_MS } from '~/utils/timeouts'
import {
  createAnthropicMessage,
  deleteAnthropicFile,
  uploadAnthropicFile
} from '~/utils/anthropic/client'
import {
  ANTHROPIC_OCR_FILES_BETA,
  ANTHROPIC_OCR_FILES_UPLOAD_BYTES,
  ANTHROPIC_OCR_IMAGE_BYTES,
  ANTHROPIC_OCR_MAX_TOKENS
} from './anthropic-ocr'

const AnthropicOcrEnvelopeSchema = v.object({
  pages: v.array(v.object({
    pageNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
    text: v.string()
  }))
})

const ANTHROPIC_OCR_JSON_SCHEMA = {
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

const getImageMimeType = (format: DocumentMetadata['format']): 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' => {
  switch (format) {
    case 'jpg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'gif':
      return 'image/gif'
    case 'webp':
      return 'image/webp'
    default:
      throw new Error(`Unsupported Anthropic OCR image format: ${format}`)
  }
}

const buildOcrPrompt = (expectedPageCount: number): string => [
  'Perform OCR on the provided document or image.',
  'Return only JSON.',
  'Do not summarize, explain, or translate.',
  'Preserve the visible reading order.',
  'Preserve paragraph breaks and line breaks when they are meaningful.',
  'If a page is blank or unreadable, return that page with an empty string for text.',
  `Return exactly ${expectedPageCount} page objects with contiguous pageNumber values from 1 through ${expectedPageCount}.`,
  `Use this exact JSON schema: ${JSON.stringify(ANTHROPIC_OCR_JSON_SCHEMA)}`
].join(' ')

const extractAnthropicText = (content: Array<{ type: string, text?: string | undefined }>): string =>
  content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')

const normalizePages = (
  value: unknown,
  expectedPageCount: number,
  pageLabel: string
): PageResult[] => {
  const parsed = v.safeParse(AnthropicOcrEnvelopeSchema, value)
  if (!parsed.success) {
    throw new Error(`Anthropic OCR response for ${pageLabel} did not match the expected page schema.`)
  }

  const pages = parsed.output.pages
    .slice()
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map((page) => ({
      pageNumber: page.pageNumber,
      method: 'ocr' as const,
      text: page.text
    }))

  if (pages.length !== expectedPageCount) {
    throw new Error(`Anthropic OCR returned ${pages.length} pages for ${pageLabel}, expected ${expectedPageCount}. Split the document into smaller chunks and retry.`)
  }

  for (let i = 0; i < pages.length; i++) {
    const expectedPageNumber = i + 1
    if (pages[i]?.pageNumber !== expectedPageNumber) {
      throw new Error(`Anthropic OCR returned non-contiguous page numbers for ${pageLabel}. Split the document into smaller chunks and retry.`)
    }
  }

  return pages
}

const parseOcrResponse = (
  rawText: string,
  expectedPageCount: number,
  pageLabel: string
): PageResult[] => {
  const validation = parseAndValidateStructured(AnthropicOcrEnvelopeSchema, rawText)
  if (!validation.success) {
    throw new OcrStructuredResponseError(`Anthropic OCR returned malformed JSON for ${pageLabel}. Split the document into smaller chunks and retry.`, rawText)
  }

  try {
    return normalizePages(validation.value, expectedPageCount, pageLabel)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new OcrStructuredResponseError(message, rawText)
  }
}

const callAnthropicMessage = async (
  requestBody: Record<string, unknown>,
  operationName: string,
  beta?: string | string[] | undefined
) => {
  const config = getAnthropicClientConfig()
  return await withOcrCreateRetry(
    operationName,
    async (signal) => await createAnthropicMessage(config, requestBody, {
      signal,
      beta
    })
  )
}

const runMessageWithSchemaRetry = async (
  requestBody: Record<string, unknown>,
  expectedPageCount: number,
  pageLabel: string,
  operationName: string,
  beta?: string | string[] | undefined
): Promise<{ pages: PageResult[], promptTokens?: number, completionTokens?: number }> => {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < OCR_SCHEMA_RETRY_ATTEMPTS; attempt++) {
    const message = await callAnthropicMessage(requestBody, operationName, beta)
    const rawText = extractAnthropicText(message.content ?? [])

    try {
      if (!rawText.trim()) {
        throw new Error(`Anthropic OCR returned no text output for ${pageLabel}.`)
      }

      const pages = parseOcrResponse(rawText, expectedPageCount, pageLabel)
      return {
        pages,
        ...(typeof message.usage?.input_tokens === 'number' ? { promptTokens: message.usage.input_tokens } : {}),
        ...(typeof message.usage?.output_tokens === 'number' ? { completionTokens: message.usage.output_tokens } : {})
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt < OCR_SCHEMA_RETRY_ATTEMPTS - 1) {
        l.warn(`Anthropic OCR returned malformed output for ${pageLabel}; retrying`)
        continue
      }
    }
  }

  throw lastError ?? new Error(`Anthropic OCR failed for ${pageLabel}.`)
}

const createImageRequestBody = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string
): Promise<Record<string, unknown>> => {
  const file = Bun.file(filePath)
  if (file.size > ANTHROPIC_OCR_IMAGE_BYTES) {
    throw new Error(`Anthropic OCR image input exceeds the 5 MB per-image limit for ${basename(filePath)}.`)
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  return {
    model,
    max_tokens: ANTHROPIC_OCR_MAX_TOKENS,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: buildOcrPrompt(1)
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: getImageMimeType(step1Metadata.format),
            data: base64
          }
        }
      ]
    }]
  }
}

const createPdfChunk = async (
  inputPath: string,
  outputPath: string,
  pageRange: string
): Promise<void> => {
  const result = await splitPdfPages(inputPath, outputPath, pageRange)
  if (result.exitCode !== 0 && !(result.exitCode === 3 && result.tool === 'qpdf')) {
    throw new Error(result.stderr || result.stdout || `PDF page split failed for pages ${pageRange}`)
  }
}

const runPdfChunk = async (
  filePath: string,
  model: string,
  startPage: number,
  endPage: number
): Promise<{ pages: PageResult[], promptTokens: number, completionTokens: number }> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-anthropic-ocr-'))
  const pageLabel = `pages ${startPage}-${endPage}`
  const chunkPath = join(tempDir, `chunk-${startPage}-${endPage}.pdf`)
  const config = getAnthropicClientConfig()
  let uploadedFileId: string | undefined

  try {
    await createPdfChunk(filePath, chunkPath, `${startPage}-${endPage}`)
    const chunkFile = Bun.file(chunkPath)
    if (chunkFile.size > ANTHROPIC_OCR_FILES_UPLOAD_BYTES) {
      throw new Error(`Anthropic OCR PDF chunk ${pageLabel} exceeds the 500 MB Files API upload limit. Split the document into smaller chunks and retry.`)
    }
    const uploadFile = new File([await chunkFile.arrayBuffer()], basename(chunkPath), {
      type: 'application/pdf'
    })

    const uploaded = await withOcrCreateRetry(
      'anthropic-ocr-file-upload',
      async (signal) => await uploadAnthropicFile(config, uploadFile, {
        signal,
        beta: ANTHROPIC_OCR_FILES_BETA
      })
    )

    uploadedFileId = uploaded.id
    const expectedPageCount = endPage - startPage + 1
    const requestBody = {
      model,
      max_tokens: ANTHROPIC_OCR_MAX_TOKENS,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildOcrPrompt(expectedPageCount)
          },
          {
            type: 'document',
            title: basename(chunkPath),
            source: {
              type: 'file',
              file_id: uploadedFileId
            }
          }
        ]
      }]
    } satisfies Record<string, unknown>

    const result = await runMessageWithSchemaRetry(
      requestBody,
      expectedPageCount,
      pageLabel,
      'anthropic-ocr',
      ANTHROPIC_OCR_FILES_BETA
    )

    return {
      pages: result.pages.map((page) => ({
        ...page,
        pageNumber: page.pageNumber + startPage - 1
      })),
      promptTokens: result.promptTokens ?? 0,
      completionTokens: result.completionTokens ?? 0
    }
  } finally {
    if (uploadedFileId) {
      try {
        await deleteAnthropicFile(config, uploadedFileId, {
          signal: AbortSignal.timeout(OCR_REQUEST_TIMEOUT_MS),
          beta: ANTHROPIC_OCR_FILES_BETA
        })
      } catch (error) {
        l.warn(`Failed to delete Anthropic OCR upload ${uploadedFileId}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    await rm(tempDir, { recursive: true, force: true })
  }
}

export const runAnthropicOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string
): Promise<{
  pages: PageResult[]
  extractionMethod: 'anthropic-ocr'
  totalPages: number
  promptTokens?: number
  completionTokens?: number
}> => {
  if (step1Metadata.format !== 'pdf') {
    const requestBody = await createImageRequestBody(filePath, step1Metadata, model)
    const result = await runMessageWithSchemaRetry(requestBody, 1, 'page 1', 'anthropic-ocr')
    return {
      pages: result.pages,
      extractionMethod: 'anthropic-ocr',
      totalPages: 1,
      ...(typeof result.promptTokens === 'number' ? { promptTokens: result.promptTokens } : {}),
      ...(typeof result.completionTokens === 'number' ? { completionTokens: result.completionTokens } : {})
    }
  }

  const totalPages = Math.max(1, step1Metadata.pageCount)
  const chunk = await runPdfChunk(filePath, model, 1, totalPages)

  return {
    pages: chunk.pages,
    extractionMethod: 'anthropic-ocr',
    totalPages,
    ...(chunk.promptTokens > 0 ? { promptTokens: chunk.promptTokens } : {}),
    ...(chunk.completionTokens > 0 ? { completionTokens: chunk.completionTokens } : {})
  }
}
