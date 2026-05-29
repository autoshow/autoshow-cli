import * as l from '~/utils/logger'
import * as v from 'valibot'
import type { BflImageModel, RetryClass, Step5Metadata } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateImageCosts, logImageEstimate } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { classifyFetchRetry, isRetryableStatus, pollUntil, withRetry } from '~/utils/retries'
import { validateData } from '~/utils/validate/validation'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { imageReferenceToUrlOrDataUrl } from '../../image-utils/image-inputs'
import { ensureBflImageGenSetup, getBflBaseUrl } from './bfl-image-gen'

const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

const BFL_OUTPUT_FORMATS = ['jpeg', 'png', 'webp'] as const
type BflOutputFormat = typeof BFL_OUTPUT_FORMATS[number]

const BflAsyncResponseSchema = v.object({
  id: v.string(),
  polling_url: v.string(),
  cost: v.optional(v.nullable(v.number()), undefined),
  input_mp: v.optional(v.nullable(v.number()), undefined),
  output_mp: v.optional(v.nullable(v.number()), undefined)
})

const BflPollResponseSchema = v.object({
  status: v.string(),
  result: v.optional(v.nullable(v.object({
    sample: v.optional(v.string(), undefined)
  })), undefined),
  cost: v.optional(v.nullable(v.number()), undefined),
  error: v.optional(v.unknown(), undefined),
  details: v.optional(v.unknown(), undefined)
})

export const normalizeBflImageSize = (
  size: string | undefined
): { width: number, height: number } | undefined => {
  if (size === undefined || size.length === 0) {
    return undefined
  }

  const match = /^(\d{2,5})x(\d{2,5})$/i.exec(size.trim())
  if (!match) {
    throw CLIUsageError(`Invalid --image-size value "${size}" for BFL. Expected WIDTHxHEIGHT, e.g. 1024x1024.`)
  }

  const width = Number.parseInt(match[1]!, 10)
  const height = Number.parseInt(match[2]!, 10)
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 64 || height < 64) {
    throw CLIUsageError(`Invalid --image-size value "${size}" for BFL. Width and height must each be at least 64 pixels.`)
  }

  return { width, height }
}

export const normalizeBflImageOutputFormat = (format: string | undefined): BflOutputFormat => {
  if (format === undefined || format.length === 0) {
    return 'jpeg'
  }

  const normalized = format.toLowerCase()
  if ((BFL_OUTPUT_FORMATS as readonly string[]).includes(normalized)) {
    return normalized as BflOutputFormat
  }

  throw CLIUsageError(`Invalid --image-format value "${format}" for BFL. Expected jpeg, png, or webp.`)
}

export const getBflImageExtension = (format: string | undefined): string => {
  const outputFormat = normalizeBflImageOutputFormat(format)
  return outputFormat === 'jpeg' ? 'jpg' : outputFormat
}

const readJsonOrText = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (text.length === 0) return ''
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const extractErrorMessage = (payload: unknown): string | undefined => {
  if (typeof payload === 'string') return payload
  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as Record<string, unknown>
  for (const key of ['message', 'error', 'detail', 'details']) {
    const value = record[key]
    if (typeof value === 'string') return value
    if (value !== undefined) return JSON.stringify(value)
  }
  return JSON.stringify(payload)
}

const fetchBflJson = async (
  url: string,
  apiKey: string,
  init: RequestInit
): Promise<{ response: Response, payload: unknown }> => {
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  headers.set('x-key', apiKey)

  const response = await fetch(url, {
    ...init,
    headers
  })
  const payload = await readJsonOrText(response)
  return { response, payload }
}

const downloadBflImage = async (
  url: string,
  outputPath: string,
  outputFormat: BflOutputFormat,
  signal?: AbortSignal | undefined
): Promise<void> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: { accept: `image/${outputFormat},image/*;q=0.9,*/*;q=0.8` },
    ...(signal ? { signal } : {})
  })
  if (!response.ok) {
    const err = new Error(`BFL image result download failed (${response.status})`) as Error & {
      status: number
      headers: Headers
      stage: string
      retryClass: RetryClass
      retryable: boolean
    }
    err.status = response.status
    err.headers = response.headers
    err.stage = 'result-download'
    err.retryClass = 'runtime_http_read'
    err.retryable = isRetryableStatus(response.status)
    throw err
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new Error('BFL image generation returned an empty image')
  }
  await Bun.write(outputPath, bytes)
}

export const runBflImageGen = async (
  prompt: string,
  outputDir: string,
  options: { model: BflImageModel, imageSize?: string | undefined, outputFormat?: string | undefined, inputs?: string[] | undefined }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiKey = await ensureBflImageGenSetup()
  const dimensions = normalizeBflImageSize(options.imageSize)
  const outputFormat = normalizeBflImageOutputFormat(options.outputFormat)
  const inputs = options.inputs ?? []
  const mode = inputs.length > 0 ? 'edit' : 'generation'
  const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat
  const fileName = `generated-image.${ext}`
  const outputPath = `${outputDir}/${fileName}`

  const estimate = estimateImageCosts({ bflImageModel: options.model, imageSize: options.imageSize })[0]
  if (estimate) {
    logImageEstimate(estimate)
  }

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'bfl',
    model: options.model,
    status: 'started',
    detail: mode
  })

  const startTime = Date.now()
  const inputFields = Object.fromEntries(
    await Promise.all(inputs.map(async (input, index) => [
      index === 0 ? 'input_image' : `input_image_${index + 1}`,
      await imageReferenceToUrlOrDataUrl(input)
    ] as const))
  )
  const body = {
    prompt,
    output_format: outputFormat,
    ...inputFields,
    ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {})
  }

  const { response: createResponse, payload: createPayload } = await fetchBflJson(
    `${getBflBaseUrl()}/v1/${encodeURIComponent(options.model)}`,
    apiKey,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }
  )

  if (!createResponse.ok) {
    throw new Error(`BFL image request failed (${createResponse.status}): ${extractErrorMessage(createPayload) ?? 'Unknown error'}`)
  }

  const createData = validateData(BflAsyncResponseSchema, createPayload, 'BFL image generation create response')

  const pollData = await pollUntil({
    operationName: 'bfl-image-gen',
    intervalMs: POLL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS,
    pollFn: async () => {
      const { response, payload } = await fetchBflJson(createData.polling_url, apiKey, { method: 'GET' })
      if (!response.ok) {
        throw new Error(`BFL image status query failed (${response.status}): ${extractErrorMessage(payload) ?? 'Unknown error'}`)
      }
      const data = validateData(BflPollResponseSchema, payload, 'BFL image generation poll response')
      logMediaGenerationStatus(l, {
        mediaType: 'image',
        provider: 'bfl',
        model: options.model,
        status: data.status
      })
      return data
    },
    isDone: (data) => data.status.toLowerCase() === 'ready',
    isFailed: (data) => {
      const status = data.status.toLowerCase()
      if (status === 'error' || status === 'failed') {
        return { failed: true, reason: extractErrorMessage(data) ?? 'Unknown error' }
      }
      return { failed: false }
    }
  })

  const sampleUrl = pollData.result?.sample
  if (!sampleUrl) {
    throw new Error('BFL image generation completed without result.sample')
  }

  await withRetry(
    { retryClass: 'runtime_http_read', operationName: 'bfl-image-result-download' },
    async (signal) => await downloadBflImage(sampleUrl, outputPath, outputFormat, signal),
    (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
  )

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(outputPath)
  const providerCostCredits = typeof pollData.cost === 'number'
    ? pollData.cost
    : typeof createData.cost === 'number'
      ? createData.cost
      : undefined
  const providerCostCents = providerCostCredits ?? estimate?.totalCost

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'bfl',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1
  })

  return {
    imagePaths: [outputPath],
    metadata: {
      imageService: 'bfl',
      imageModel: options.model,
      processingTime,
      imageCount: 1,
      imageFileNames: [fileName],
      imageFileSize: imageFile.size,
      imageWidth: dimensions?.width,
      imageHeight: dimensions?.height,
      requestMode: mode,
      ...(providerCostCents !== undefined ? {
        providerCostCents,
        providerCostSource: providerCostCredits !== undefined ? 'provider_quote' : 'registry_fallback'
      } : {})
    }
  }
}
