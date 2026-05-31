import * as l from '~/utils/logger'
import { mkdir } from 'node:fs/promises'
import type { ReveImageModel, Step5Metadata } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { estimateImageCosts, logImageEstimate } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { imageReferenceToBase64 } from '../../image-utils/image-inputs'
import { ensureReveImageGenSetup, getReveBaseUrl } from './reve-image-gen'

const REVE_ASPECT_RATIOS = ['16:9', '9:16', '3:2', '2:3', '4:3', '3:4', '1:1'] as const
const REVE_OUTPUT_FORMATS = ['png', 'jpeg', 'webp'] as const
const REVE_CENTS_PER_CREDIT = 1000 / 7500

type ReveOutputFormat = typeof REVE_OUTPUT_FORMATS[number]

type ReveDimensions = {
  width: number
  height: number
}

export const normalizeReveImageSize = (size: string | undefined): ReveDimensions | undefined => {
  if (size === undefined || size.length === 0) {
    return undefined
  }

  const match = /^(\d{1,5})x(\d{1,5})$/i.exec(size.trim())
  if (!match) {
    throw CLIUsageError(`Invalid --image-size value "${size}" for Reve. Expected WIDTHxHEIGHT, e.g. 1024x1024. Reve uses this as a fit-within resize, not an exact canvas guarantee.`)
  }

  const width = Number.parseInt(match[1]!, 10)
  const height = Number.parseInt(match[2]!, 10)
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw CLIUsageError(`Invalid --image-size value "${size}" for Reve. Width and height must be positive integers.`)
  }

  return { width, height }
}

export const normalizeReveImageOutputFormat = (format: string | undefined): ReveOutputFormat => {
  if (format === undefined || format.length === 0) {
    return 'png'
  }

  const normalized = format.toLowerCase()
  if ((REVE_OUTPUT_FORMATS as readonly string[]).includes(normalized)) {
    return normalized as ReveOutputFormat
  }

  throw CLIUsageError(`Invalid --image-format value "${format}" for Reve. Expected png, jpeg, or webp.`)
}

export const normalizeReveImageAspectRatio = (aspectRatio: string | undefined): string | undefined => {
  if (aspectRatio === undefined || aspectRatio.length === 0) {
    return undefined
  }

  if ((REVE_ASPECT_RATIOS as readonly string[]).includes(aspectRatio)) {
    return aspectRatio
  }

  throw CLIUsageError(`Invalid --image-aspect-ratio value "${aspectRatio}" for Reve. Supported values: ${REVE_ASPECT_RATIOS.join(', ')}.`)
}

export const getReveImageExtension = (format: string | undefined): string =>
  normalizeReveImageOutputFormat(format) === 'jpeg' ? 'jpg' : normalizeReveImageOutputFormat(format)

const readResponseText = async (response: Response): Promise<string> => {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

const buildReveErrorMessage = async (response: Response, prefix: string): Promise<string> => {
  const text = await readResponseText(response)
  if (text.length === 0) {
    return `${prefix} (${response.status})`
  }
  return `${prefix} (${response.status}): ${text}`
}

const endpointForInputCount = (inputCount: number): { endpoint: string, mode: Step5Metadata['requestMode'], detail: string } => {
  if (inputCount === 0) {
    return { endpoint: '/v1/image/create', mode: 'generation', detail: 'create' }
  }
  if (inputCount === 1) {
    return { endpoint: '/v1/image/edit', mode: 'edit', detail: 'edit' }
  }
  return { endpoint: '/v1/image/remix', mode: 'edit', detail: 'remix' }
}

const buildRequestBody = async (
  prompt: string,
  options: {
    model: ReveImageModel
    inputs: string[]
    aspectRatio?: string | undefined
    dimensions?: ReveDimensions | undefined
  }
): Promise<Record<string, unknown>> => {
  const baseBody: Record<string, unknown> = {
    ...(options.model !== 'latest' ? { version: options.model } : {}),
    ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
    ...(options.dimensions ? {
      postprocessing: [{
        process: 'fit_image',
        max_width: options.dimensions.width,
        max_height: options.dimensions.height
      }]
    } : {})
  }

  if (options.inputs.length === 0) {
    return {
      ...baseBody,
      prompt
    }
  }

  const references = await Promise.all(options.inputs.map(imageReferenceToBase64))
  if (references.length === 1) {
    return {
      ...baseBody,
      edit_instruction: prompt,
      reference_image: references[0]
    }
  }

  return {
    ...baseBody,
    prompt,
    reference_images: references
  }
}

export const runReveImageGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: ReveImageModel
    inputs?: string[] | undefined
    aspectRatio?: string | undefined
    imageSize?: string | undefined
    outputFormat?: string | undefined
  }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiKey = await ensureReveImageGenSetup()
  const inputs = options.inputs ?? []
  const { endpoint, mode, detail } = endpointForInputCount(inputs.length)
  const aspectRatio = normalizeReveImageAspectRatio(options.aspectRatio)
  const dimensions = normalizeReveImageSize(options.imageSize)
  const outputFormat = normalizeReveImageOutputFormat(options.outputFormat)
  const ext = outputFormat === 'jpeg' ? 'jpg' : outputFormat
  const fileName = `generated-image.${ext}`
  const outputPath = `${outputDir}/${fileName}`

  const estimate = estimateImageCosts({ reveImageModel: options.model })[0]
  if (estimate) {
    logImageEstimate(estimate)
  }

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'reve',
    model: options.model,
    status: 'started',
    detail
  })

  const startTime = Date.now()
  await mkdir(outputDir, { recursive: true })

  const body = await buildRequestBody(prompt, {
    model: options.model,
    inputs,
    aspectRatio,
    dimensions
  })

  const response = await fetch(`${getReveBaseUrl()}${endpoint}`, {
    method: 'POST',
    headers: {
      accept: `image/${outputFormat}`,
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  })

  const errorCode = response.headers.get('x-reve-error-code')
  const contentViolation = response.headers.get('x-reve-content-violation')?.toLowerCase() === 'true'
  if (errorCode || contentViolation) {
    throw new Error(`Reve image generation failed: ${contentViolation ? 'content violation' : `error code ${errorCode}`}`)
  }
  if (!response.ok) {
    throw new Error(await buildReveErrorMessage(response, 'Reve image generation failed'))
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength === 0) {
    throw new Error('Reve image generation returned an empty image')
  }
  await Bun.write(outputPath, bytes)

  const processingTime = Date.now() - startTime
  const providerVersion = response.headers.get('x-reve-version') ?? undefined
  const creditsUsedHeader = response.headers.get('x-reve-credits-used')
  const creditsUsed = creditsUsedHeader ? Number.parseFloat(creditsUsedHeader) : undefined
  const providerCostCents = typeof creditsUsed === 'number' && Number.isFinite(creditsUsed)
    ? creditsUsed * REVE_CENTS_PER_CREDIT
    : undefined

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'reve',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1,
    artifacts: [{ artifact: 'image', path: outputPath }]
  })

  return {
    imagePaths: [outputPath],
    metadata: {
      imageService: 'reve',
      imageModel: options.model,
      processingTime,
      imageCount: 1,
      imageFileNames: [fileName],
      imageFileSize: bytes.byteLength,
      imageWidth: undefined,
      imageHeight: undefined,
      ...(options.imageSize ? { imageSize: options.imageSize } : {}),
      imageFormat: outputFormat,
      requestMode: mode,
      ...(providerVersion && providerVersion !== options.model ? { providerReturnedModel: providerVersion } : {}),
      ...(providerCostCents !== undefined ? {
        usageCostRaw: creditsUsed,
        providerCostCents,
        providerCostSource: 'provider_usage' as const
      } : {})
    }
  }
}
