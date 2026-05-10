import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { DocumentMetadata, PageResult } from '~/types'
import { validateData } from '~/utils/validate/validation'
import { OCR_POLL_DEADLINE_MS } from '~/utils/timeouts'
import {
  ensureAwsTextractSetup,
  runAws,
  AWS_TEXTRACT_ASYNC_FILE_SIZE_BYTES,
  AWS_TEXTRACT_SYNC_BYTES
} from './aws-textract'

const POLL_INTERVAL_MS = 3000

const TextractBlockSchema = v.object({
  BlockType: v.string(),
  Text: v.optional(v.string(), undefined),
  Page: v.optional(v.number(), undefined),
  Confidence: v.optional(v.number(), undefined),
  Relationships: v.optional(v.array(v.object({
    Type: v.string(),
    Ids: v.array(v.string())
  })), undefined),
  Id: v.optional(v.string(), undefined)
})

const TextractSyncResponseSchema = v.object({
  Blocks: v.array(TextractBlockSchema),
  DocumentMetadata: v.object({
    Pages: v.number()
  })
})

const TextractStartResponseSchema = v.object({
  JobId: v.string()
})

const TextractGetResponseSchema = v.object({
  JobStatus: v.picklist(['IN_PROGRESS', 'SUCCEEDED', 'FAILED', 'PARTIAL_SUCCESS']),
  StatusMessage: v.optional(v.string(), undefined),
  Blocks: v.optional(v.array(TextractBlockSchema), undefined),
  DocumentMetadata: v.optional(v.object({
    Pages: v.number()
  }), undefined),
  NextToken: v.optional(v.string(), undefined)
})

type TextractBlock = v.InferOutput<typeof TextractBlockSchema>

const isAnalyzeMode = (model: string): boolean =>
  model === 'analyze-document'

const buildPageResults = (blocks: TextractBlock[], totalPages: number): PageResult[] => {
  const pageTexts = new Map<number, string[]>()

  for (let i = 1; i <= totalPages; i++) {
    pageTexts.set(i, [])
  }

  for (const block of blocks) {
    if (block.BlockType === 'LINE' && typeof block.Text === 'string') {
      const pageNum = block.Page ?? 1
      const lines = pageTexts.get(pageNum) ?? []
      lines.push(block.Text)
      pageTexts.set(pageNum, lines)
    }
  }

  const pages: PageResult[] = []
  for (let i = 1; i <= totalPages; i++) {
    const lines = pageTexts.get(i) ?? []
    pages.push({
      pageNumber: i,
      method: 'ocr',
      text: lines.join('\n')
    })
  }

  return pages
}

export const writeAwsTextractSyncDocumentFile = async (
  filePath: string,
  tempDir: string
): Promise<string> => {
  const bytes = await Bun.file(filePath).arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const documentJsonPath = join(tempDir, 'document.json')
  await Bun.write(documentJsonPath, JSON.stringify({ Bytes: base64 }))
  return `file://${documentJsonPath}`
}

const runSyncTextract = async (
  filePath: string,
  region: string,
  model: string
): Promise<{ pages: PageResult[], totalPages: number }> => {
  const command = isAnalyzeMode(model)
    ? 'analyze-document'
    : 'detect-document-text'

  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-textract-sync-'))

  try {
    const documentArg = await writeAwsTextractSyncDocumentFile(filePath, tempDir)
    const args = [
      'textract',
      command,
      '--document', documentArg,
      '--region', region,
      '--output', 'json'
    ]

    if (isAnalyzeMode(model)) {
      args.push('--feature-types', 'TABLES', 'FORMS', 'LAYOUT')
    }

    l.write('info', `AWS Textract sync ${command} for ${basename(filePath)}`)
    const result = await runAws(args)
    if (result.exitCode !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || 'command failed'
      throw new Error(`AWS Textract ${command} failed: ${detail}`)
    }

    const response = validateData(TextractSyncResponseSchema, JSON.parse(result.stdout), `AWS Textract ${command} response`)
    const totalPages = response.DocumentMetadata.Pages
    const pages = buildPageResults(response.Blocks, totalPages)
    return { pages, totalPages }
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}

const runAsyncTextract = async (
  filePath: string,
  region: string,
  bucket: string,
  model: string
): Promise<{ pages: PageResult[], totalPages: number }> => {
  const s3Key = `autoshow-textract/${crypto.randomUUID()}/${basename(filePath)}`
  const s3Uri = `s3://${bucket}/${s3Key}`

  l.write('info', `Uploading ${basename(filePath)} to ${s3Uri}`)
  const uploadResult = await runAws(['s3', 'cp', filePath, s3Uri, '--region', region])
  if (uploadResult.exitCode !== 0) {
    const detail = uploadResult.stderr.trim() || uploadResult.stdout.trim() || 'upload failed'
    throw new Error(`AWS S3 upload failed for Textract: ${detail}`)
  }

  try {
    const startCommand = isAnalyzeMode(model)
      ? 'start-document-analysis'
      : 'start-document-text-detection'

    const startArgs = [
      'textract',
      startCommand,
      '--document-location', JSON.stringify({ S3Object: { Bucket: bucket, Name: s3Key } }),
      '--region', region,
      '--output', 'json'
    ]

    if (isAnalyzeMode(model)) {
      startArgs.push('--feature-types', 'TABLES', 'FORMS', 'LAYOUT')
    }

    l.write('info', `Starting AWS Textract async ${startCommand} for ${basename(filePath)}`)
    const startResult = await runAws(startArgs)
    if (startResult.exitCode !== 0) {
      const detail = startResult.stderr.trim() || startResult.stdout.trim() || 'command failed'
      throw new Error(`AWS Textract ${startCommand} failed: ${detail}`)
    }

    const startResponse = validateData(TextractStartResponseSchema, JSON.parse(startResult.stdout), `AWS Textract ${startCommand} response`)
    const jobId = startResponse.JobId
    l.write('info', `AWS Textract job started: ${jobId}`)

    const getCommand = isAnalyzeMode(model)
      ? 'get-document-analysis'
      : 'get-document-text-detection'

    let allBlocks: TextractBlock[] = []
    let totalPages = 0
    let completed = false
    let attempt = 0
    const pollStartedAt = Date.now()

    while (Date.now() - pollStartedAt < OCR_POLL_DEADLINE_MS && !completed) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
      attempt += 1

      let nextToken: string | undefined
      let firstPoll = true

      while (firstPoll || nextToken) {
        firstPoll = false
        const getArgs = [
          'textract',
          getCommand,
          '--job-id', jobId,
          '--region', region,
          '--output', 'json',
          ...(nextToken ? ['--next-token', nextToken] : [])
        ]

        const getResult = await runAws(getArgs)
        if (getResult.exitCode !== 0) {
          const detail = getResult.stderr.trim() || getResult.stdout.trim() || 'command failed'
          throw new Error(`AWS Textract ${getCommand} failed: ${detail}`)
        }

        const getResponse = validateData(TextractGetResponseSchema, JSON.parse(getResult.stdout), `AWS Textract ${getCommand} response`)

        if (getResponse.JobStatus === 'FAILED') {
          throw new Error(`AWS Textract job failed: ${getResponse.StatusMessage ?? 'unknown error'}`)
        }

        if (getResponse.JobStatus === 'IN_PROGRESS') {
          if (attempt % 10 === 9) {
            l.write('info', `AWS Textract job ${jobId} still in progress (attempt ${attempt + 1})...`)
          }
          break
        }

        if (getResponse.Blocks) {
          allBlocks = allBlocks.concat(getResponse.Blocks)
        }
        if (getResponse.DocumentMetadata) {
          totalPages = getResponse.DocumentMetadata.Pages
        }

        nextToken = getResponse.NextToken ?? undefined

        if (!nextToken) {
          completed = true
        }
      }
    }

    if (!completed) {
      throw new Error(`AWS Textract job ${jobId} did not complete before OCR poll deadline (${OCR_POLL_DEADLINE_MS}ms)`)
    }

    l.write('info', `AWS Textract job ${jobId} completed, ${totalPages} pages`)
    const pages = buildPageResults(allBlocks, totalPages)
    return { pages, totalPages }
  } finally {
    l.write('info', `Cleaning up S3 object ${s3Uri}`)
    await runAws(['s3', 'rm', s3Uri, '--region', region]).catch(() => {})
  }
}

export const runAwsTextract = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string,
  options: {
    region?: string | undefined
    bucket?: string | undefined
    configPath?: string | undefined
  } = {}
): Promise<{
  pages: PageResult[]
  extractionMethod: 'aws-textract'
  totalPages: number
}> => {
  const fileSize = Bun.file(filePath).size
  const isPdf = step1Metadata.format === 'pdf'
  const isTiff = step1Metadata.format === 'tif'
  const isMultipage = isPdf || isTiff
  const requiresAsync = isMultipage || fileSize > AWS_TEXTRACT_SYNC_BYTES

  if (requiresAsync) {
    if (fileSize > AWS_TEXTRACT_ASYNC_FILE_SIZE_BYTES) {
      throw new Error(
        `AWS Textract async supports files up to ${AWS_TEXTRACT_ASYNC_FILE_SIZE_BYTES / (1024 * 1024)} MB. ` +
        `Got ${(fileSize / (1024 * 1024)).toFixed(1)} MB for ${basename(filePath)}.`
      )
    }

    const config = await ensureAwsTextractSetup({
      preferredRegion: options.region,
      preferredBucket: options.bucket,
      configPath: options.configPath,
      requireBucket: true
    })
    if (!config.bucket) {
      throw new Error('AWS S3 bucket setup failed for AWS Textract staging.')
    }

    const result = await runAsyncTextract(filePath, config.region, config.bucket, model)
    return { ...result, extractionMethod: 'aws-textract' }
  }

  const config = await ensureAwsTextractSetup({
    preferredRegion: options.region,
    preferredBucket: options.bucket,
    configPath: options.configPath
  })
  const result = await runSyncTextract(filePath, config.region, model)
  return { ...result, extractionMethod: 'aws-textract' }
}
