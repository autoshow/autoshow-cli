import { basename, extname } from 'node:path'
import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { DocumentMetadata, PageResult } from '~/types'
import { validateData } from '~/utils/validate/validation'
import {
  ensureGcloudDocaiSetup,
  runGcloud,
  GCLOUD_DOCAI_BATCH_BYTES,
  GCLOUD_DOCAI_SYNC_BYTES,
  type GcloudDocaiRuntimeConfig
} from './gcloud-docai'

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 600

const TextSegmentSchema = v.object({
  startIndex: v.optional(v.union([v.string(), v.number()]), '0'),
  endIndex: v.union([v.string(), v.number()])
})

const TextAnchorSchema = v.object({
  textSegments: v.optional(v.array(TextSegmentSchema), [])
})

const LayoutSchema = v.object({
  textAnchor: v.optional(TextAnchorSchema, undefined)
})

const DocaiBlockSchema = v.object({
  layout: v.optional(LayoutSchema, undefined)
})

const DocaiPageSchema = v.object({
  pageNumber: v.optional(v.number(), undefined),
  layout: v.optional(LayoutSchema, undefined),
  paragraphs: v.optional(v.array(DocaiBlockSchema), []),
  blocks: v.optional(v.array(DocaiBlockSchema), []),
  lines: v.optional(v.array(DocaiBlockSchema), [])
})

const DocaiDocumentSchema = v.object({
  text: v.optional(v.string(), ''),
  pages: v.optional(v.array(DocaiPageSchema), [])
})

const DocaiProcessResponseSchema = v.object({
  document: DocaiDocumentSchema
})

const DocaiOperationSchema = v.object({
  name: v.string(),
  done: v.optional(v.boolean(), false),
  error: v.optional(v.object({
    code: v.optional(v.number(), undefined),
    message: v.optional(v.string(), undefined)
  }), undefined),
  metadata: v.optional(v.unknown(), undefined),
  response: v.optional(v.unknown(), undefined)
})

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.webp': 'image/webp'
}

const resolveMimeType = (filePath: string): string => {
  const ext = extname(filePath).toLowerCase()
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

const buildEndpointUrl = (
  config: GcloudDocaiRuntimeConfig,
  action: 'process' | 'batchProcess'
): string =>
  `https://${config.location}-documentai.googleapis.com/v1/projects/${config.projectId}/locations/${config.location}/processors/${config.processorId}:${action}`

const buildOperationUrl = (
  config: GcloudDocaiRuntimeConfig,
  operationName: string
): string =>
  `https://${config.location}-documentai.googleapis.com/v1/${operationName}`

const extractTextFromSegments = (
  segments: v.InferOutput<typeof TextSegmentSchema>[],
  fullText: string
): string => {
  let text = ''
  for (const seg of segments) {
    const start = typeof seg.startIndex === 'string' ? parseInt(seg.startIndex, 10) : (seg.startIndex ?? 0)
    const end = typeof seg.endIndex === 'string' ? parseInt(seg.endIndex, 10) : seg.endIndex
    text += fullText.slice(start, end)
  }
  return text
}

const extractTextFromBlocks = (
  blocks: v.InferOutput<typeof DocaiBlockSchema>[],
  fullText: string
): string => {
  let text = ''
  for (const block of blocks) {
    const segments = block.layout?.textAnchor?.textSegments
    if (segments && segments.length > 0) {
      text += extractTextFromSegments(segments, fullText)
    }
  }
  return text
}

const buildPageResults = (document: v.InferOutput<typeof DocaiDocumentSchema>): PageResult[] => {
  const fullText = document.text ?? ''
  const pages: PageResult[] = []

  if (document.pages.length === 0 && fullText.length > 0) {
    return [{ pageNumber: 1, method: 'ocr' as const, text: fullText }]
  }

  for (let i = 0; i < document.pages.length; i++) {
    const page = document.pages[i]!
    const pageNumber = page.pageNumber ?? (i + 1)

    // Try page-level layout first (used by OCR processor)
    const segments = page.layout?.textAnchor?.textSegments
    let pageText = segments && segments.length > 0
      ? extractTextFromSegments(segments, fullText)
      : ''

    // Fall back to paragraph/block/line-level anchors (used by Layout Parser)
    if (!pageText && page.paragraphs && page.paragraphs.length > 0) {
      pageText = extractTextFromBlocks(page.paragraphs, fullText)
    }
    if (!pageText && page.blocks && page.blocks.length > 0) {
      pageText = extractTextFromBlocks(page.blocks, fullText)
    }
    if (!pageText && page.lines && page.lines.length > 0) {
      pageText = extractTextFromBlocks(page.lines, fullText)
    }

    pages.push({
      pageNumber,
      method: 'ocr' as const,
      text: pageText
    })
  }

  return pages
}

const runSyncDocai = async (
  filePath: string,
  config: GcloudDocaiRuntimeConfig,
  model: string
): Promise<{ pages: PageResult[], totalPages: number }> => {
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mimeType = resolveMimeType(filePath)

  const body: Record<string, unknown> = {
    rawDocument: {
      mimeType,
      content: base64
    },
    ...(model === 'ocr' ? {
      processOptions: {
        ocrConfig: {
          enableNativePdfParsing: true
        }
      }
    } : {})
  }

  const endpoint = buildEndpointUrl(config, 'process')
  l.write('info', `Google Cloud Document AI sync process for ${basename(filePath)}`)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
      'X-Goog-User-Project': config.projectId
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Google Cloud Document AI API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const validated = validateData(DocaiProcessResponseSchema, data, 'Document AI process response')
  const pages = buildPageResults(validated.document)
  return { pages, totalPages: pages.length }
}

const runBatchDocai = async (
  filePath: string,
  config: GcloudDocaiRuntimeConfig,
  model: string
): Promise<{ pages: PageResult[], totalPages: number }> => {
  const s3Key = `autoshow-docai/${crypto.randomUUID()}/${basename(filePath)}`
  const gcsUri = `gs://${config.bucket}/${s3Key}`
  const outputPrefix = `gs://${config.bucket}/autoshow-docai/${crypto.randomUUID()}/output/`

  l.write('info', `Uploading ${basename(filePath)} to ${gcsUri}`)
  const uploadResult = await runGcloud(['storage', 'cp', filePath, gcsUri])
  if (uploadResult.exitCode !== 0) {
    const detail = uploadResult.stderr.trim() || uploadResult.stdout.trim() || 'upload failed'
    throw new Error(`GCS upload failed for Document AI: ${detail}`)
  }

  try {
    const mimeType = resolveMimeType(filePath)
    const body: Record<string, unknown> = {
      inputDocuments: {
        gcsDocuments: {
          documents: [{ gcsUri, mimeType }]
        }
      },
      documentOutputConfig: {
        gcsOutputConfig: {
          gcsUri: outputPrefix
        }
      },
      ...(model === 'ocr' ? {
        processOptions: {
          ocrConfig: {
            enableNativePdfParsing: true
          }
        }
      } : {})
    }

    const endpoint = buildEndpointUrl(config, 'batchProcess')
    l.write('info', `Starting Google Cloud Document AI batch process for ${basename(filePath)}`)

    const startResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        'X-Goog-User-Project': config.projectId
      },
      body: JSON.stringify(body)
    })

    if (!startResponse.ok) {
      const errorText = await startResponse.text()
      throw new Error(`Google Cloud Document AI batch API error (${startResponse.status}): ${errorText}`)
    }

    const startData = await startResponse.json()
    const operation = validateData(DocaiOperationSchema, startData, 'Document AI batch response')
    const operationName = operation.name
    l.write('info', `Document AI batch job started: ${operationName}`)

    let completed = false
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && !completed; attempt++) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

      const pollUrl = buildOperationUrl(config, operationName)
      const pollResponse = await fetch(pollUrl, {
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'X-Goog-User-Project': config.projectId
        }
      })

      if (!pollResponse.ok) {
        const errorText = await pollResponse.text()
        throw new Error(`Document AI operation poll failed (${pollResponse.status}): ${errorText}`)
      }

      const pollData = await pollResponse.json()
      const pollResult = validateData(DocaiOperationSchema, pollData, 'Document AI operation poll')

      if (pollResult.error?.message) {
        throw new Error(`Document AI batch job failed: ${pollResult.error.message}`)
      }

      if (pollResult.done) {
        completed = true
      } else if (attempt % 10 === 9) {
        l.write('info', `Document AI batch job still in progress (attempt ${attempt + 1})...`)
      }
    }

    if (!completed) {
      throw new Error(`Document AI batch job did not complete within ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s`)
    }

    l.write('info', 'Document AI batch job completed, reading output from GCS...')

    const listResult = await runGcloud(['storage', 'ls', '-r', outputPrefix])
    if (listResult.exitCode !== 0) {
      throw new Error(`Failed to list Document AI output from GCS: ${listResult.stderr.trim() || listResult.stdout.trim() || 'command failed'}`)
    }

    const outputFiles = listResult.stdout.trim().split('\n').filter(f => f.endsWith('.json'))
    if (outputFiles.length === 0) {
      throw new Error('Document AI batch job produced no output files')
    }

    let allPages: PageResult[] = []

    for (const outputFile of outputFiles) {
      const catResult = await runGcloud(['storage', 'cat', outputFile])
      if (catResult.exitCode !== 0) {
        l.warn(`Failed to read Document AI output shard ${outputFile}: ${catResult.stderr.trim()}`)
        continue
      }

      const shardData = JSON.parse(catResult.stdout)
      const shardDoc = validateData(DocaiDocumentSchema, shardData, 'Document AI output shard')
      const shardPages = buildPageResults(shardDoc)
      allPages = allPages.concat(shardPages)
    }

    allPages.sort((a, b) => a.pageNumber - b.pageNumber)
    l.write('info', `Document AI batch job completed, ${allPages.length} pages`)
    return { pages: allPages, totalPages: allPages.length }
  } finally {
    l.write('info', `Cleaning up GCS objects under ${gcsUri}`)
    await runGcloud(['storage', 'rm', gcsUri]).catch(() => {})
    await runGcloud(['storage', 'rm', '-r', outputPrefix]).catch(() => {})
  }
}

export const runGcloudDocai = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string
): Promise<{
  pages: PageResult[]
  extractionMethod: 'gcloud-docai'
  totalPages: number
}> => {
  const config = await ensureGcloudDocaiSetup(model)
  const fileSize = Bun.file(filePath).size
  const isPdf = step1Metadata.format === 'pdf'
  const isTiff = step1Metadata.format === 'tif'
  const isMultipage = isPdf || isTiff

  if (isMultipage || fileSize > GCLOUD_DOCAI_SYNC_BYTES) {
    if (!config.bucket) {
      throw new Error(
        'A GCS bucket is required for multi-page or large-file Google Cloud Document AI OCR. ' +
        'Set AUTOSHOW_GCLOUD_BUCKET, save a bucket in AutoShow config explicitly, or run `bun as setup --gcloud --gcloud-project PROJECT_ID` to create one and print the value.'
      )
    }

    if (fileSize > GCLOUD_DOCAI_BATCH_BYTES) {
      throw new Error(
        `Google Cloud Document AI batch supports files up to ${GCLOUD_DOCAI_BATCH_BYTES / (1024 * 1024)} MB. ` +
        `Got ${(fileSize / (1024 * 1024)).toFixed(1)} MB for ${basename(filePath)}.`
      )
    }

    const result = await runBatchDocai(filePath, config, model)
    return { ...result, extractionMethod: 'gcloud-docai' }
  }

  const result = await runSyncDocai(filePath, config, model)
  return { ...result, extractionMethod: 'gcloud-docai' }
}
