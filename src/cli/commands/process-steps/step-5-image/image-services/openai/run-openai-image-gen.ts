import { mkdir } from 'node:fs/promises'
import * as l from '~/utils/logger'
import type { OpenAIImageModel, Step5Metadata } from '~/types'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/openai/openai-utils'
import { createOpenAIImage } from '~/utils/openai/client'

export const runOpenAIImageGen = async (
  prompt: string,
  outputDir: string,
  options: {
    model: OpenAIImageModel
    size?: string | undefined
    quality?: string | undefined
    outputFormat?: string | undefined
    background?: string | undefined
  }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'openai',
    model: options.model,
    status: 'started'
  })

  const config = getOpenAIClientConfig()

  const startTime = Date.now()

  await mkdir(outputDir, { recursive: true })

  const ext = options.outputFormat === 'jpeg' ? 'jpg' : (options.outputFormat ?? 'png')
  const outputPath = `${outputDir}/generated-image.${ext}`

  const result = await createOpenAIImage(config, {
    model: options.model,
    prompt,
    size: options.size ?? 'auto',
    quality: options.quality ?? 'auto',
    output_format: options.outputFormat ?? 'png',
    background: options.background ?? 'auto',
  })

  const imageBase64 = result.data?.[0]?.b64_json
  if (!imageBase64) {
    throw new Error('No image data in OpenAI response')
  }

  await Bun.write(outputPath, Buffer.from(imageBase64, 'base64'))

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(outputPath)
  const imageFileSize = imageFile.size

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'openai',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: 1
  })

  const metadata: Step5Metadata = {
    imageService: 'openai',
    imageModel: options.model,
    processingTime,
    imageCount: 1,
    imageFileNames: [`generated-image.${ext}`],
    imageFileSize,
    imageWidth: undefined,
    imageHeight: undefined,
    imageSize: options.size ?? 'auto',
    imageQuality: options.quality ?? 'auto',
    imageFormat: options.outputFormat ?? 'png'
  }

  return { imagePaths: [outputPath], metadata }
}
