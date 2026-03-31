import OpenAI from 'openai'
import { mkdir } from 'node:fs/promises'
import * as l from '~/logger'
import type { Step5Metadata } from '~/types'
import type { OpenAIImageModel } from '~/cli/commands/models/model-options'
import { getOpenAIClientConfig } from '~/utils/openai-utils'

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
  l.info(`Running OpenAI image model: ${options.model}`)

  const config = getOpenAIClientConfig()
  const client = new OpenAI({ apiKey: config.apiKey, ...(config.baseURL ? { baseURL: config.baseURL } : {}) })

  const startTime = Date.now()

  await mkdir(outputDir, { recursive: true })

  const ext = options.outputFormat === 'jpeg' ? 'jpg' : (options.outputFormat ?? 'png')
  const outputPath = `${outputDir}/generated-image.${ext}`

  const result = await client.images.generate({
    model: options.model,
    prompt,
    size: (options.size as OpenAI.ImageGenerateParams['size']) ?? 'auto',
    quality: (options.quality as OpenAI.ImageGenerateParams['quality']) ?? 'auto',
    output_format: (options.outputFormat as OpenAI.ImageGenerateParams['output_format']) ?? 'png',
    background: (options.background as OpenAI.ImageGenerateParams['background']) ?? 'auto',
  } as OpenAI.ImageGenerateParams)

  if (!('data' in result)) {
    throw new Error('Unexpected streaming response from OpenAI image generation')
  }

  const imageBase64 = result.data[0]?.b64_json
  if (!imageBase64) {
    throw new Error('No image data in OpenAI response')
  }

  await Bun.write(outputPath, Buffer.from(imageBase64, 'base64'))

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(outputPath)
  const imageFileSize = imageFile.size

  l.success(`OpenAI image generation completed in ${(processingTime / 1000).toFixed(1)}s`)

  const metadata: Step5Metadata = {
    imageService: 'openai',
    imageModel: options.model,
    processingTime,
    imageCount: 1,
    imageFileName: `generated-image.${ext}`,
    imageFileNames: [`generated-image.${ext}`],
    imageFileSize,
    imageWidth: undefined,
    imageHeight: undefined
  }

  return { imagePaths: [outputPath], metadata }
}
