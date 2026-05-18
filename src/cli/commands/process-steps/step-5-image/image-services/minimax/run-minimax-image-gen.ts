import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { MinimaxImageModel, Step5Metadata } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { MinimaxBaseRespSchema } from '~/cli/commands/process-steps/step-4-tts/tts-services/minimax/minimax-utils'
import { getImageFileNames } from '../../image-utils/image-output'
import { imageReferenceToUrlOrDataUrl } from '../../image-utils/image-inputs'

const MINIMAX_DEFAULT_BASE_URL = 'https://api.minimax.io'

const MinimaxImageDataSchema = v.object({
  image_base64: v.optional(v.array(v.string()), undefined),
  image_urls: v.optional(v.array(v.string()), undefined)
})

const MinimaxImageResponseSchema = v.object({
  data: v.nullable(MinimaxImageDataSchema),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

export const normalizeMinimaxImageSize = (
  size: string | undefined
): { width: number, height: number } | undefined => {
  if (size === undefined || size.length === 0) {
    return undefined
  }

  const match = /^(\d{3,4})x(\d{3,4})$/i.exec(size.trim())
  if (!match) {
    throw CLIUsageError(`Invalid --image-size value "${size}" for MiniMax. Expected WIDTHxHEIGHT, e.g. 1024x1024.`)
  }

  const width = Number.parseInt(match[1]!, 10)
  const height = Number.parseInt(match[2]!, 10)
  const valid = [width, height].every((dimension) =>
    Number.isInteger(dimension) && dimension >= 512 && dimension <= 2048 && dimension % 8 === 0
  )
  if (!valid) {
    throw CLIUsageError(`Invalid --image-size value "${size}" for MiniMax. Width and height must be 512-2048 and divisible by 8.`)
  }

  return { width, height }
}

const outputPathForIndex = (outputDir: string, index: number): string =>
  `${outputDir}/${index === 0 ? 'generated-image.jpeg' : `generated-image-${index + 1}.jpeg`}`

export const runMinimaxImageGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: MinimaxImageModel
    aspectRatio?: string | undefined
    count?: number | undefined
    imageSize?: string | undefined
    inputs?: string[] | undefined
  }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiKey = readEnv('MINIMAX_API_KEY')
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY environment variable is required')
  }

  const baseURL = readEnv('MINIMAX_BASE_URL') ?? MINIMAX_DEFAULT_BASE_URL
  const startTime = Date.now()
  const count = Math.max(1, options.count ?? 1)
  const dimensions = options.aspectRatio ? undefined : normalizeMinimaxImageSize(options.imageSize)
  const inputs = options.inputs ?? []
  const mode = inputs.length > 0 ? 'edit' : 'generation'

  const MINIMAX_MAX_PROMPT_LENGTH = 1500
  const truncatedPrompt = prompt.length > MINIMAX_MAX_PROMPT_LENGTH
    ? prompt.slice(0, MINIMAX_MAX_PROMPT_LENGTH)
    : prompt

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'minimax',
    model: options.model,
    status: 'started',
    detail: mode
  })

  const subjectReference = await Promise.all(inputs.map(async (input) => ({
    type: 'character',
    image_file: await imageReferenceToUrlOrDataUrl(input)
  })))

  const response = await fetch(`${baseURL}/v1/image_generation`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: options.model,
      prompt: truncatedPrompt,
      response_format: 'base64',
      n: count,
      ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
      ...(dimensions ? { width: dimensions.width, height: dimensions.height } : {}),
      ...(subjectReference.length > 0 ? { subject_reference: subjectReference } : {})
    })
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`MiniMax image generation failed (${response.status}): ${errText || 'No response body'}`)
  }

  const parsed = validateData(
    MinimaxImageResponseSchema,
    await response.json() as unknown,
    'MiniMax image generation response'
  )

  if (parsed.base_resp?.status_code !== undefined && parsed.base_resp.status_code !== 0) {
    throw new Error(`MiniMax image generation failed (${parsed.base_resp.status_code}): ${parsed.base_resp.status_msg ?? 'Unknown error'}`)
  }

  const imageData = parsed.data
  const base64Images = imageData?.image_base64
  const urlImages = imageData?.image_urls
  const imagePaths: string[] = []

  if (base64Images && base64Images.length > 0) {
    for (const [index, image] of base64Images.entries()) {
      const outputPath = outputPathForIndex(outputDir, index)
      await Bun.write(outputPath, Buffer.from(image, 'base64'))
      imagePaths.push(outputPath)
    }
  } else if (urlImages && urlImages.length > 0) {
    for (const [index, url] of urlImages.entries()) {
      const imgResponse = await fetch(url)
      if (!imgResponse.ok) {
        throw new Error(`MiniMax image download failed (${imgResponse.status})`)
      }
      const outputPath = outputPathForIndex(outputDir, index)
      await Bun.write(outputPath, new Uint8Array(await imgResponse.arrayBuffer()))
      imagePaths.push(outputPath)
    }
  } else {
    throw new Error('MiniMax image generation completed but no image payload was returned')
  }

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(imagePaths[0] as string)

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'minimax',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: imagePaths.length
  })

  const metadata: Step5Metadata = {
    imageService: 'minimax',
    imageModel: options.model,
    processingTime,
    imageCount: imagePaths.length,
    imageFileNames: getImageFileNames(imagePaths),
    imageFileSize: imageFile.size,
    imageWidth: dimensions?.width,
    imageHeight: dimensions?.height,
    ...(dimensions ? { imageSize: `${dimensions.width}x${dimensions.height}` } : {}),
    requestMode: mode
  }

  return { imagePaths, metadata }
}
