import { extname } from 'node:path'
import { Mistral } from '@mistralai/mistralai'
import type { DocumentMetadata, PageResult } from '~/types'
import { MistralOcrResponseSchema } from '~/types'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const normalizeMistralServerURL = (serverURL: string): string => serverURL.replace(/\/v1\/?$/, '')

const imageMimeType = (filePath: string): string => {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.tif' || ext === '.tiff') return 'image/tiff'
  if (ext === '.webp') return 'image/webp'
  return 'application/octet-stream'
}

export const runMistralOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string
): Promise<{ pages: PageResult[], extractionMethod: 'mistral-ocr' }> => {
  const apiKey = readEnvFallback('MISTRAL_API_KEY')
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY environment variable is required for Mistral OCR')
  }

  const serverURL = normalizeMistralServerURL(readEnv('MISTRAL_BASE_URL') ?? 'https://api.mistral.ai/v1')
  const client = new Mistral({ apiKey, serverURL })
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

  const rawPayload: unknown = step1Metadata.format === 'pdf'
    ? await client.ocr.process({
        model,
        document: {
          type: 'document_url',
          documentUrl: `data:application/pdf;base64,${base64}`
        },
        includeImageBase64: false
      })
    : await client.ocr.process({
        model,
        document: {
          type: 'image_url',
          imageUrl: `data:${imageMimeType(filePath)};base64,${base64}`
        },
        includeImageBase64: false
      })

  const payload = validateData(MistralOcrResponseSchema, rawPayload, 'Mistral OCR response')
  const pages: PageResult[] = payload.pages.map(page => ({
    pageNumber: page.index,
    method: 'ocr',
    text: page.markdown
  }))

  return { pages, extractionMethod: 'mistral-ocr' }
}
