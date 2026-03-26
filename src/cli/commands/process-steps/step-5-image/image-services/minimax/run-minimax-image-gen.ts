import * as v from 'valibot'
import * as l from '~/logger'
import type { Step5Metadata } from '~/types'
import type { MinimaxImageModel } from '~/cli/commands/models/model-options'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const MINIMAX_DEFAULT_BASE_URL = 'https://api.minimax.io'

const MinimaxBaseRespSchema = v.object({
  status_code: v.optional(v.number(), undefined),
  status_msg: v.optional(v.string(), undefined)
})

const MinimaxImageDataSchema = v.object({
  image_base64: v.optional(v.array(v.string()), undefined),
  image_urls: v.optional(v.array(v.string()), undefined)
})

const MinimaxImageResponseSchema = v.object({
  data: v.nullable(MinimaxImageDataSchema),
  base_resp: v.optional(MinimaxBaseRespSchema, undefined)
})

export const runMinimaxImageGen = async (
  prompt: string,
  outputDir: string,
  options: { model: MinimaxImageModel, aspectRatio?: string | undefined }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiKey = readEnv('MINIMAX_API_KEY')
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY environment variable is required')
  }

  const baseURL = readEnv('MINIMAX_BASE_URL') ?? MINIMAX_DEFAULT_BASE_URL
  const startTime = Date.now()
  const outputPath = `${outputDir}/generated-image.jpeg`

  const MINIMAX_MAX_PROMPT_LENGTH = 1500
  const truncatedPrompt = prompt.length > MINIMAX_MAX_PROMPT_LENGTH
    ? prompt.slice(0, MINIMAX_MAX_PROMPT_LENGTH)
    : prompt

  l.info(`Running MiniMax image model: ${options.model}`)

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
      ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {})
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

  if (base64Images && base64Images.length > 0) {
    const firstImage = base64Images[0] as string
    await Bun.write(outputPath, Buffer.from(firstImage, 'base64'))
  } else if (urlImages && urlImages.length > 0) {
    const firstUrl = urlImages[0] as string
    const imgResponse = await fetch(firstUrl)
    if (!imgResponse.ok) {
      throw new Error(`MiniMax image download failed (${imgResponse.status})`)
    }
    await Bun.write(outputPath, new Uint8Array(await imgResponse.arrayBuffer()))
  } else {
    throw new Error('MiniMax image generation completed but no image payload was returned')
  }

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(outputPath)

  l.success(`MiniMax image generation completed in ${(processingTime / 1000).toFixed(1)}s`)

  const metadata: Step5Metadata = {
    imageService: 'minimax',
    imageModel: options.model,
    processingTime,
    imageCount: 1,
    imageFileName: 'generated-image.jpeg',
    imageFileNames: ['generated-image.jpeg'],
    imageFileSize: imageFile.size,
    imageWidth: undefined,
    imageHeight: undefined
  }

  return { imagePaths: [outputPath], metadata }
}
