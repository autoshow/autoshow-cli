import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { DeapiImageModel, Step5Metadata } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateImageCosts, logImageEstimate } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import {
  deapiFetch,
  ensureDeapiApiKey,
  extractDeapiErrorMessage,
  extractResultUrl,
  parseRequestId,
  pollDeapiJob,
  readJsonOrText
} from '~/utils/deapi'
import { validateData } from '~/utils/validate/validation'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'

const POLL_INITIAL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS
const MAX_31_BIT_SEED = 0x7fffffff

type DeapiImageModelSpec = {
  minWidth: number
  maxWidth: number
  defaultWidth: number
  minHeight: number
  maxHeight: number
  defaultHeight: number
  minSteps: number
  maxSteps: number
  defaultSteps: number
  resolutionStep: number
}

const DEAPI_IMAGE_MODEL_SPECS: Record<DeapiImageModel, DeapiImageModelSpec> = {
  Flux1schnell: {
    minWidth: 256,
    maxWidth: 2048,
    defaultWidth: 768,
    minHeight: 256,
    maxHeight: 2048,
    defaultHeight: 768,
    minSteps: 1,
    maxSteps: 10,
    defaultSteps: 4,
    resolutionStep: 128
  },
  ZImageTurbo_INT8: {
    minWidth: 128,
    maxWidth: 2048,
    defaultWidth: 768,
    minHeight: 128,
    maxHeight: 2048,
    defaultHeight: 768,
    minSteps: 1,
    maxSteps: 50,
    defaultSteps: 8,
    resolutionStep: 16
  },
  Flux_2_Klein_4B_BF16: {
    minWidth: 256,
    maxWidth: 1536,
    defaultWidth: 1024,
    minHeight: 256,
    maxHeight: 1536,
    defaultHeight: 1024,
    minSteps: 4,
    maxSteps: 4,
    defaultSteps: 4,
    resolutionStep: 16
  }
}

const DeapiCreateImageResponseSchema = v.object({
  data: v.object({
    request_id: v.string()
  })
})

const DeapiJobDataSchema = v.object({
  status: v.string(),
  result_url: v.optional(v.string(), undefined),
  result: v.optional(v.unknown(), undefined)
})

const DeapiPollImageResponseSchema = v.union([
  v.object({ data: DeapiJobDataSchema }),
  DeapiJobDataSchema
])

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const snapDimension = (value: number, spec: DeapiImageModelSpec, axis: 'width' | 'height'): number => {
  const min = axis === 'width' ? spec.minWidth : spec.minHeight
  const max = axis === 'width' ? spec.maxWidth : spec.maxHeight
  const clamped = clamp(value, min, max)
  const snapped = Math.round(clamped / spec.resolutionStep) * spec.resolutionStep
  return clamp(snapped, min, max)
}

export const normalizeDeapiImageSize = (
  model: DeapiImageModel,
  size: string | undefined
): { width: number, height: number } => {
  const spec = DEAPI_IMAGE_MODEL_SPECS[model]
  if (size === undefined || size.length === 0) {
    return { width: spec.defaultWidth, height: spec.defaultHeight }
  }

  const match = /^(\d{2,5})x(\d{2,5})$/i.exec(size.trim())
  if (!match) {
    throw CLIUsageError(`Invalid --image-size value "${size}" for deAPI. Expected WIDTHxHEIGHT, e.g. ${spec.defaultWidth}x${spec.defaultHeight}.`)
  }

  return {
    width: snapDimension(Number.parseInt(match[1]!, 10), spec, 'width'),
    height: snapDimension(Number.parseInt(match[2]!, 10), spec, 'height')
  }
}

const buildSeed = (): number =>
  Math.floor(Math.random() * MAX_31_BIT_SEED) + 1

const downloadResultImage = async (resultUrl: string, outputPath: string): Promise<void> => {
  const response = await fetch(resultUrl, {
    method: 'GET',
    headers: { accept: 'image/png,image/*;q=0.9,*/*;q=0.8' }
  })
  if (!response.ok) {
    throw new Error(`deAPI image result download failed (${response.status})`)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new Error('deAPI image generation returned an empty image')
  }
  await Bun.write(outputPath, bytes)
}

export const runDeapiImageGen = async (
  prompt: string,
  outputDir: string,
  options: { model: DeapiImageModel, imageSize?: string | undefined }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiKey = ensureDeapiApiKey('deAPI image generation')
  const { width, height } = normalizeDeapiImageSize(options.model, options.imageSize)
  const spec = DEAPI_IMAGE_MODEL_SPECS[options.model]
  const steps = clamp(spec.defaultSteps, spec.minSteps, spec.maxSteps)
  const outputPath = `${outputDir}/generated-image.png`

  const estimate = estimateImageCosts({ deapiImageModel: options.model, imageSize: options.imageSize })[0]
  if (estimate) {
    logImageEstimate(estimate)
  }

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'deapi',
    model: options.model,
    status: 'started'
  })

  const startTime = Date.now()
  const createResponse = await deapiFetch('/api/v2/images/generations', {
    apiKey,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt,
      model: options.model,
      width,
      height,
      guidance: 0,
      steps,
      seed: buildSeed()
    })
  })

  const createPayload = await readJsonOrText(createResponse)
  if (!createResponse.ok) {
    throw new Error(`deAPI image request failed (${createResponse.status}): ${extractDeapiErrorMessage(createPayload) ?? 'Unknown error'}`)
  }

  validateData(DeapiCreateImageResponseSchema, createPayload, 'deAPI image generation create response')
  const requestId = parseRequestId(createPayload)
  if (!requestId) {
    throw new Error('deAPI image request did not return request_id')
  }

  const { status } = await pollDeapiJob({
    requestId,
    apiKey,
    operationName: 'deapi-poll-image',
    initialPollIntervalMs: POLL_INITIAL_INTERVAL_MS,
    maxPollIntervalMs: POLL_INITIAL_INTERVAL_MS,
    deadlineMs: POLL_TIMEOUT_MS
  })
  validateData(DeapiPollImageResponseSchema, status.raw, 'deAPI image generation poll response')

  const resultUrl = extractResultUrl(status)
  if (!resultUrl) {
    throw new Error('deAPI image generation completed without result_url')
  }

  await downloadResultImage(resultUrl, outputPath)

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(outputPath)

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'deapi',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1
  })

  return {
    imagePaths: [outputPath],
    metadata: {
      imageService: 'deapi',
      imageModel: options.model,
      processingTime,
      imageCount: 1,
      imageFileNames: ['generated-image.png'],
      imageFileSize: imageFile.size,
      imageWidth: width,
      imageHeight: height,
      requestMode: 'generation'
    }
  }
}
