import { basename } from 'node:path'
import { stat } from 'node:fs/promises'
import type { DeapiOcrModel, DocumentMetadata, ExtractionOptions, PageResult } from '~/types'
import {
  createDeapiHttpError,
  deapiFetch,
  ensureDeapiApiKey,
  extractDeapiErrorMessage,
  extractPriceUsd,
  extractResultUrl,
  fetchResultPayload,
  isRecord,
  parseRequestId,
  pollDeapiJob,
  readJsonOrText
} from '~/utils/deapi'
import { processPages } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/page-processor'
import { OCR_POLL_DEADLINE_MS } from '~/utils/timeouts'
import { withOcrCreateRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import * as l from '~/utils/logger'

const MAX_DEAPI_OCR_IMAGE_BYTES = 10 * 1024 * 1024
const DEAPI_OCR_JOB_RETRY_ATTEMPTS = 4

export type DeapiOcrRun = {
  pages: PageResult[]
  extractionMethod: 'deapi-ocr'
  totalPages: number
  providerCostCents?: number | undefined
  providerCostSource?: 'provider_quote' | 'registry_fallback' | undefined
}

const normalizeDeapiOcrLanguage = (languages: string | undefined): string | undefined => {
  const first = languages?.split(/[,+\s]+/).find((entry) => entry.trim().length > 0)?.trim().toLowerCase()
  if (!first) {
    return undefined
  }
  if (first === 'eng') {
    return 'en'
  }
  return first.length === 3 ? first.slice(0, 2) : first
}

const appendImage = async (body: FormData, imagePath: string): Promise<void> => {
  const imageFile = Bun.file(imagePath)
  body.append('image', imageFile, basename(imagePath))
}

const assertDeapiOcrImageWithinLimits = async (imagePath: string): Promise<void> => {
  const imageStats = await stat(imagePath)
  if (imageStats.size > MAX_DEAPI_OCR_IMAGE_BYTES) {
    throw new Error(`deAPI OCR supports image uploads up to 10 MB. Got ${(imageStats.size / (1024 * 1024)).toFixed(2)} MB for ${basename(imagePath)}.`)
  }
}

const collectTextFragments = (value: unknown, depth = 0): string[] => {
  if (depth > 8) {
    return []
  }

  if (typeof value === 'string') {
    const text = value.trim()
    return text.length > 0 ? [text] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectTextFragments(entry, depth + 1))
  }

  if (!isRecord(value)) {
    return []
  }

  for (const key of ['text', 'markdown', 'content', 'ocr_text', 'extracted_text', 'output'] as const) {
    const fragments = collectTextFragments(value[key], depth + 1)
    if (fragments.length > 0) {
      return fragments
    }
  }

  for (const key of ['pages', 'result', 'results', 'data'] as const) {
    const fragments = collectTextFragments(value[key], depth + 1)
    if (fragments.length > 0) {
      return fragments
    }
  }

  return []
}

const extractOcrText = async (status: unknown, resultUrl: string | undefined): Promise<string> => {
  const inlineFragments = collectTextFragments(status)
  if (inlineFragments.length > 0) {
    return inlineFragments.join('\n\n').trim()
  }

  if (resultUrl) {
    const resultPayload = await fetchResultPayload(resultUrl)
    const resultFragments = collectTextFragments(resultPayload)
    if (resultFragments.length > 0) {
      return resultFragments.join('\n\n').trim()
    }
  }

  throw new Error('deAPI OCR completed without extractable text')
}

const resolveDeapiOcrImagePrice = async (
  imagePath: string,
  model: DeapiOcrModel,
  language?: string | undefined
): Promise<number | undefined> => {
  const apiKey = ensureDeapiApiKey('deAPI OCR pricing')
  const body = new FormData()
  await appendImage(body, imagePath)
  body.append('model', model)
  body.append('format', 'text')
  if (language) {
    body.append('language', language)
  }

  const response = await deapiFetch('/api/v2/images/ocr/price', {
    apiKey,
    method: 'POST',
    body
  })
  const payload = await readJsonOrText(response)
  if (!response.ok) {
    throw new Error(`deAPI OCR price request failed (${response.status}): ${extractDeapiErrorMessage(payload) ?? 'Unknown error'}`)
  }

  const priceUsd = extractPriceUsd(payload)
  if (priceUsd === undefined) {
    throw new Error('deAPI OCR price response did not include data.price')
  }
  return priceUsd * 100
}

type DeapiOcrJobError = Error & {
  cause?: unknown
  retryable?: unknown
  stage?: unknown
  status?: unknown
}

const isDeapiOcrJobError = (value: unknown): value is DeapiOcrJobError =>
  value instanceof Error

const collectDeapiOcrJobErrorChain = (error: unknown): DeapiOcrJobError[] => {
  const chain: DeapiOcrJobError[] = []
  const seen = new Set<unknown>()
  let current: unknown = error

  while (isDeapiOcrJobError(current) && !seen.has(current)) {
    chain.push(current)
    seen.add(current)
    current = current.cause
  }

  return chain
}

export const isRetryableDeapiOcrJobFailure = (error: unknown): boolean => {
  const chain = collectDeapiOcrJobErrorChain(error)
  const message = chain.length > 0
    ? chain.map((entry) => entry.message).join(' | ')
    : error instanceof Error ? error.message : String(error)

  if (/api key|auth(?:entication|orization)?|unauthori[sz]ed|forbidden|credential/i.test(message)) {
    return false
  }

  if (/deAPI job failed:\s*unknown error/i.test(message)) {
    return true
  }

  const retryable = chain.find((entry) => typeof entry.retryable === 'boolean')?.retryable
  if (retryable === true) {
    return true
  }

  const stage = chain.find((entry) => typeof entry.stage === 'string')?.stage
  if (stage === 'create') {
    return false
  }

  const status = chain.find((entry) => typeof entry.status === 'number')?.status
  if (typeof status === 'number' && (status === 408 || status === 425 || status === 429 || status >= 500)) {
    return true
  }

  return /timed out waiting|deadline exceeded|polling failed|result_url fetch failed|network|connection|socket|timeout/i.test(message)
}

const createDeapiOcrJob = async (
  imagePath: string,
  model: DeapiOcrModel,
  apiKey: string,
  language?: string | undefined
): Promise<string> => {
  const createPayload = await withOcrCreateRetry(
    'deapi-ocr-create',
    async (signal) => {
      const body = new FormData()
      await appendImage(body, imagePath)
      body.append('model', model)
      body.append('format', 'text')
      body.append('return_result_in_response', 'true')
      if (language) {
        body.append('language', language)
      }

      const response = await deapiFetch('/api/v2/images/ocr', {
        apiKey,
        method: 'POST',
        body,
        signal: signal ?? null
      })
      const payload = await readJsonOrText(response)
      if (!response.ok) {
        throw createDeapiHttpError(
          `deAPI OCR request failed (${response.status}): ${extractDeapiErrorMessage(payload) ?? 'Unknown error'}`,
          response,
          'create',
          'runtime_http_create_conservative',
          payload
        )
      }
      return payload
    }
  )

  const requestId = parseRequestId(createPayload)
  if (!requestId) {
    throw new Error('deAPI OCR request did not return request_id')
  }
  return requestId
}

const runDeapiOcrImageJob = async (
  imagePath: string,
  model: DeapiOcrModel,
  apiKey: string,
  language?: string | undefined
): Promise<string> => {
  const requestId = await createDeapiOcrJob(imagePath, model, apiKey, language)
  const { status } = await pollDeapiJob({
    requestId,
    apiKey,
    operationName: 'deapi-poll-ocr',
    deadlineMs: OCR_POLL_DEADLINE_MS
  })
  return await extractOcrText(status.raw, extractResultUrl(status))
}

export const runDeapiOcrImage = async (
  imagePath: string,
  model: DeapiOcrModel,
  language?: string | undefined
): Promise<{
  text: string
  providerCostCents?: number | undefined
  providerCostSource?: 'provider_quote' | 'registry_fallback' | undefined
}> => {
  await assertDeapiOcrImageWithinLimits(imagePath)
  const apiKey = ensureDeapiApiKey('deAPI OCR')

  let providerCostCents: number | undefined
  let providerCostSource: 'provider_quote' | 'registry_fallback' | undefined
  try {
    providerCostCents = await resolveDeapiOcrImagePrice(imagePath, model, language)
    providerCostSource = 'provider_quote'
  } catch (error) {
    l.warn(`deAPI OCR exact pricing failed; recording registry fallback cost (${error instanceof Error ? error.message : String(error)})`)
    providerCostCents = 0
    providerCostSource = 'registry_fallback'
  }

  let lastJobError: Error | undefined
  for (let attempt = 0; attempt < DEAPI_OCR_JOB_RETRY_ATTEMPTS; attempt++) {
    try {
      const text = await runDeapiOcrImageJob(imagePath, model, apiKey, language)
      return {
        text,
        ...(providerCostCents !== undefined ? { providerCostCents } : {}),
        ...(providerCostSource ? { providerCostSource } : {})
      }
    } catch (error) {
      lastJobError = error instanceof Error ? error : new Error(String(error))
      if (attempt < DEAPI_OCR_JOB_RETRY_ATTEMPTS - 1 && isRetryableDeapiOcrJobFailure(error)) {
        l.warn(`deAPI OCR job failed (${lastJobError.message}); recreating job`)
        continue
      }
      throw error
    }
  }

  throw lastJobError ?? new Error('deAPI OCR failed')
}

export const runDeapiOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: DeapiOcrModel,
  opts: ExtractionOptions
): Promise<DeapiOcrRun> => {
  const language = normalizeDeapiOcrLanguage(opts.languages)

  if (step1Metadata.format !== 'pdf') {
    const image = await runDeapiOcrImage(filePath, model, language)
    return {
      pages: [{ pageNumber: 1, method: 'ocr', text: image.text }],
      extractionMethod: 'deapi-ocr',
      totalPages: 1,
      ...(image.providerCostCents !== undefined ? { providerCostCents: image.providerCostCents } : {}),
      ...(image.providerCostSource ? { providerCostSource: image.providerCostSource } : {})
    }
  }

  let totalCostCents = 0
  let hasCost = false
  let hasRegistryFallback = false
  const pages = await processPages(filePath, step1Metadata.pageCount, opts, async (imagePath) => {
    const image = await runDeapiOcrImage(imagePath, model, language)
    if (image.providerCostCents !== undefined) {
      totalCostCents += image.providerCostCents
      hasCost = true
    }
    if (image.providerCostSource === 'registry_fallback') {
      hasRegistryFallback = true
    }
    return { text: image.text }
  })

  return {
    pages,
    extractionMethod: 'deapi-ocr',
    totalPages: step1Metadata.pageCount,
    ...(hasCost
      ? {
          providerCostCents: totalCostCents,
          providerCostSource: hasRegistryFallback ? 'registry_fallback' : 'provider_quote'
        }
      : {})
  }
}
