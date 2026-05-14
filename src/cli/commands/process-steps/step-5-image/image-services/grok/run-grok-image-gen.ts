import * as l from '~/utils/logger'
import type { GrokImageModel, Step5Metadata } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { createOpenAIImage } from '~/utils/openai/client'

const XAI_BASE_URL = 'https://api.x.ai/v1'

const mimeToExtension = (mimeType: string | null | undefined): string => {
  const normalized = mimeType?.toLowerCase()
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg'
  if (normalized === 'image/webp') return 'webp'
  if (normalized === 'image/png') return 'png'
  return 'png'
}

export const normalizeGrokImageResolution = (size: string | undefined): string | undefined => {
  if (size === undefined || size.length === 0) return undefined
  const normalized = size.toLowerCase()
  if (normalized === '1k' || normalized === '2k') return normalized
  throw CLIUsageError(`Invalid --image-size value "${size}" for Grok. Expected 1K or 2K.`)
}

export const runGrokImageGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: GrokImageModel
    aspectRatio?: string | undefined
    imageSize?: string | undefined
    quality?: string | undefined
  }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required for Grok image generation')
  }

  const resolution = normalizeGrokImageResolution(options.imageSize)
  const startTime = Date.now()

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'grok',
    model: options.model,
    status: 'started'
  })

  const result = await createOpenAIImage({ apiKey, baseURL: XAI_BASE_URL }, {
    model: options.model,
    prompt,
    response_format: 'b64_json',
    ...(options.quality ? { quality: options.quality } : {}),
    ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
    ...(resolution ? { resolution } : {})
  }, { errorMessagePrefix: 'Grok image generation failed' })

  const imageBase64 = result.data?.[0]?.b64_json
  if (!imageBase64) {
    throw new Error('No image data in Grok response')
  }

  const mimeType = result.data?.[0]?.mime_type
  const ext = mimeToExtension(mimeType)
  const fileName = `generated-image.${ext}`
  const outputPath = `${outputDir}/${fileName}`
  await Bun.write(outputPath, Buffer.from(imageBase64, 'base64'))

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(outputPath)

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'grok',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1
  })

  return {
    imagePaths: [outputPath],
    metadata: {
      imageService: 'grok',
      imageModel: options.model,
      processingTime,
      imageCount: 1,
      imageFileNames: [fileName],
      imageFileSize: imageFile.size,
      imageWidth: undefined,
      imageHeight: undefined
    }
  }
}
