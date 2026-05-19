import { basename, extname } from 'node:path'
import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { DocumentMetadata, PageResult } from '~/types'
import { validateData } from '~/utils/validate/validation'
import { withOcrCreateRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { OCR_POLL_DEADLINE_MS } from '~/utils/timeouts'
import {
  ensureGcloudDocaiSetup,
  runGcloud,
  GCLOUD_DOCAI_BATCH_BYTES,
  GCLOUD_DOCAI_SYNC_BYTES,
  type GcloudDocaiRuntimeConfig
} from './gcloud-docai'
import { logOcrJobProgress, logOcrTransfer } from '../../ocr-logging'

const POLL_INTERVAL_MS = 3000

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

const readDocumentAiJson = async (
  response: Response,
  context: string
): Promise<unknown> => {
  const rawText = await response.text()
  if (!response.ok) {
    throw Object.assign(
      new Error(`${context} (${response.status}): ${rawText || 'Unknown error'}`),
      {
        status: response.status,
        headers: response.headers
      }
    )
  }

  return rawText.length > 0 ? JSON.parse(rawText) as unknown : {}
}

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

    // Try page-level layout first, then fall back to nested anchors when needed.
    const segments = page.layout?.textAnchor?.textSegments
    let pageText = segments && segments.length > 0
      ? extractTextFromSegments(segments, fullText)
      : ''

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
  config: GcloudDocaiRuntimeConfig
): Promise<{ pages: PageResult[], totalPages: number }> => {
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mimeType = resolveMimeType(filePath)

  const body: Record<string, unknown> = {
    rawDocument: {
      mimeType,
      content: base64
    },
    processOptions: {
      ocrConfig: {
        enableNativePdfParsing: true
      }
    }
  }

  const endpoint = buildEndpointUrl(config, 'process')
  logOcrJobProgress(l, {
    provider: 'gcloud-docai',
    action: 'process',
    state: 'running',
    detail: basename(filePath)
  })

  const data = await withOcrCreateRetry('gcloud-docai-process', async (signal) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
        'X-Goog-User-Project': config.projectId
      },
      body: JSON.stringify(body),
      signal: signal ?? null
    })
    return await readDocumentAiJson(response, 'Google Cloud Document AI API error')
  })
  const validated = validateData(DocaiProcessResponseSchema, data, 'Document AI process response')
  const pages = buildPageResults(validated.document)
  return { pages, totalPages: pages.length }
}

const runBatchDocai = async (
  filePath: string,
  config: GcloudDocaiRuntimeConfig
): Promise<{ pages: PageResult[], totalPages: number }> => {
  const s3Key = `autoshow-docai/${crypto.randomUUID()}/${basename(filePath)}`
  const gcsUri = `gs://${config.bucket}/${s3Key}`
  const outputPrefix = `gs://${config.bucket}/autoshow-docai/${crypto.randomUUID()}/output/`

  logOcrTransfer(l, {
    action: 'upload',
    file: basename(filePath),
    destination: gcsUri
  })
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
      processOptions: {
        ocrConfig: {
          enableNativePdfParsing: true
        }
      }
    }

    const endpoint = buildEndpointUrl(config, 'batchProcess')
    logOcrJobProgress(l, {
      provider: 'gcloud-docai',
      action: 'batchProcess',
      state: 'starting',
      detail: basename(filePath)
    })

    const startData = await withOcrCreateRetry('gcloud-docai-batch-start', async (signal) => {
      const startResponse = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
          'X-Goog-User-Project': config.projectId
        },
        body: JSON.stringify(body),
        signal: signal ?? null
      })
      return await readDocumentAiJson(startResponse, 'Google Cloud Document AI batch API error')
    })
    const operation = validateData(DocaiOperationSchema, startData, 'Document AI batch response')
    const operationName = operation.name
    logOcrJobProgress(l, {
      provider: 'gcloud-docai',
      action: 'batchProcess',
      remoteId: operationName,
      state: 'started'
    })

    let completed = false
    let attempt = 0
    const pollStartedAt = Date.now()
    while (Date.now() - pollStartedAt < OCR_POLL_DEADLINE_MS && !completed) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
      attempt += 1

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
        logOcrJobProgress(l, {
          provider: 'gcloud-docai',
          action: 'poll',
          remoteId: operationName,
          state: 'in_progress',
          detail: `attempt ${attempt + 1}`
        })
      }
    }

    if (!completed) {
      throw new Error(`Document AI batch job did not complete before OCR poll deadline (${OCR_POLL_DEADLINE_MS}ms)`)
    }

    logOcrJobProgress(l, {
      provider: 'gcloud-docai',
      action: 'poll',
      remoteId: operationName,
      state: 'completed',
      detail: 'reading output from GCS'
    })

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
    logOcrJobProgress(l, {
      provider: 'gcloud-docai',
      action: 'read-output',
      remoteId: operationName,
      state: 'completed',
      pages: allPages.length
    })
    return { pages: allPages, totalPages: allPages.length }
  } finally {
    logOcrTransfer(l, {
      action: 'cleanup',
      file: basename(filePath),
      destination: `${gcsUri}, ${outputPrefix}`
    })
    await runGcloud(['storage', 'rm', gcsUri]).catch(() => {})
    await runGcloud(['storage', 'rm', '-r', outputPrefix]).catch(() => {})
  }
}

export const runGcloudDocai = async (
  filePath: string,
  step1Metadata: DocumentMetadata
): Promise<{
  pages: PageResult[]
  extractionMethod: 'gcloud-docai'
  totalPages: number
}> => {
  const config = await ensureGcloudDocaiSetup()
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

    const result = await runBatchDocai(filePath, config)
    return { ...result, extractionMethod: 'gcloud-docai' }
  }

  const result = await runSyncDocai(filePath, config)
  return { ...result, extractionMethod: 'gcloud-docai' }
}
