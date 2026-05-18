import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { GlmImageModel, Step5Metadata } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { ensureGlmApiKey, resolveGlmBaseUrl } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-services/glm-ocr/glm'
import { validateData } from '~/utils/validate/validation'

const DEFAULT_GLM_IMAGE_SIZE = '1280x1280'
const GLM_IMAGE_QUALITIES = ['hd', 'standard'] as const
type GlmImageQuality = typeof GLM_IMAGE_QUALITIES[number]

const GlmImageResponseSchema = v.object({
  data: v.pipe(v.array(v.object({ url: v.string() })), v.minLength(1))
})

export const normalizeGlmImageSize = (size: string | undefined): string => {
  const value = size ?? DEFAULT_GLM_IMAGE_SIZE
  const match = /^(\d{3,4})x(\d{3,4})$/.exec(value)
  if (!match) {
    throw CLIUsageError(`Invalid --image-size value "${value}" for GLM. Expected WIDTHxHEIGHT, e.g. 1280x1280.`)
  }

  const width = Number.parseInt(match[1]!, 10)
  const height = Number.parseInt(match[2]!, 10)
  const valid = [width, height].every((dimension) =>
    Number.isInteger(dimension) && dimension >= 512 && dimension <= 2048 && dimension % 32 === 0
  )
  if (!valid) {
    throw CLIUsageError(`Invalid --image-size value "${value}" for GLM. Width and height must be 512-2048 and divisible by 32.`)
  }

  return value
}

export const normalizeGlmImageQuality = (quality: string | undefined): GlmImageQuality | undefined => {
  if (quality === undefined || quality.length === 0) {
    return undefined
  }

  if ((GLM_IMAGE_QUALITIES as readonly string[]).includes(quality)) {
    return quality as GlmImageQuality
  }

  throw CLIUsageError(`Invalid --image-quality value "${quality}" for GLM. Supported values: hd, standard.`)
}

export const runGlmImageGen = async (
  prompt: string,
  outputDir: string,
  options: { model: GlmImageModel, size?: string | undefined, quality?: string | undefined }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiKey = ensureGlmApiKey('GLM Image')
  const baseURL = resolveGlmBaseUrl()
  const size = normalizeGlmImageSize(options.size)
  const quality = normalizeGlmImageQuality(options.quality)
  const startTime = Date.now()
  const outputPath = `${outputDir}/generated-image.png`

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'glm',
    model: options.model,
    status: 'started'
  })

  const response = await fetch(`${baseURL}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: options.model,
      prompt,
      size,
      ...(quality ? { quality } : {})
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`GLM image generation failed (${response.status}): ${body || 'No response body'}`)
  }

  const parsed = validateData(
    GlmImageResponseSchema,
    await response.json() as unknown,
    'GLM image generation response'
  )

  const imageUrl = parsed.data[0]!.url
  let download!: Response
  for (let attempt = 0; attempt < 5; attempt++) {
    download = await fetch(imageUrl)
    if (download.ok) break
    if (download.status === 404 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      continue
    }
    throw new Error(`GLM image download failed (${download.status})`)
  }

  await Bun.write(outputPath, new Uint8Array(await download!.arrayBuffer()))

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(outputPath)

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'glm',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1
  })

  return {
    imagePaths: [outputPath],
    metadata: {
      imageService: 'glm',
      imageModel: options.model,
      processingTime,
      imageCount: 1,
      imageFileNames: ['generated-image.png'],
      imageFileSize: imageFile.size,
      imageWidth: undefined,
      imageHeight: undefined,
      ...(quality ? { imageQuality: quality } : {}),
      requestMode: 'generation'
    }
  }
}
