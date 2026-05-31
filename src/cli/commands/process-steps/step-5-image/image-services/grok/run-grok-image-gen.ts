import * as l from '~/utils/logger'
import type { GrokImageModel, Step5Metadata } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { logMediaGenerationStatus } from '~/cli/commands/process-steps/generation-command-utils'
import { readEnv } from '~/utils/validate/env-utils'
import { XAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { createOpenAIImage, openAIJsonRequest, type OpenAIImageResponse } from '~/utils/openai/client'
import { imageReferenceToDataUrl, isHttpUrl } from '../../image-utils/image-inputs'
import {
  getFirstRevisedPrompt,
  getImageFileNames,
  getProviderReturnedModel,
  writeOpenAIImageResponseData
} from '../../image-utils/image-output'

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
    mode?: 'generation' | 'edit' | undefined
    inputs?: string[] | undefined
    count?: number | undefined
    aspectRatio?: string | undefined
    imageSize?: string | undefined
  }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const apiKey = readEnv('XAI_API_KEY')
  if (!apiKey) {
    throw new Error('XAI_API_KEY environment variable is required for Grok image generation')
  }

  const resolution = normalizeGrokImageResolution(options.imageSize)
  const mode = options.mode ?? 'generation'
  const count = Math.max(1, options.count ?? 1)
  const startTime = Date.now()

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'grok',
    model: options.model,
    status: 'started',
    detail: mode
  })

  const configuredBaseURL = (readEnv('XAI_BASE_URL') ?? XAI_DEFAULT_BASE_URL).trim().replace(/\/+$/, '')
  const clientConfig = {
    apiKey,
    baseURL: configuredBaseURL.endsWith('/chat/completions')
      ? configuredBaseURL.slice(0, -'/chat/completions'.length)
      : configuredBaseURL
  }
  const result = mode === 'edit'
    ? await (async () => {
        const imageRefs = await Promise.all((options.inputs ?? []).map(async (input) => ({
          type: 'image_url',
          url: isHttpUrl(input) ? input : await imageReferenceToDataUrl(input)
        })))
        const body = {
          model: options.model,
          prompt,
          response_format: 'b64_json',
          n: count,
          ...(imageRefs.length === 1 ? { image: imageRefs[0] } : { images: imageRefs }),
          ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
          ...(resolution ? { resolution } : {})
        }
        return await openAIJsonRequest<OpenAIImageResponse>(clientConfig, '/images/edits', body, {
          errorMessagePrefix: 'Grok image edit failed'
        })
      })()
    : await createOpenAIImage(clientConfig, {
        model: options.model,
        prompt,
        response_format: 'b64_json',
        n: count,
        ...(options.aspectRatio ? { aspect_ratio: options.aspectRatio } : {}),
        ...(resolution ? { resolution } : {})
      }, { errorMessagePrefix: 'Grok image generation failed' })

  const imagePaths = await writeOpenAIImageResponseData(result, outputDir, 'jpg')
  if (imagePaths.length === 0) {
    throw new Error('No image data in Grok response')
  }

  const processingTime = Date.now() - startTime
  const imageFile = Bun.file(imagePaths[0] as string)
  const usageCostRaw = typeof result.usage?.['cost_in_usd_ticks'] === 'number'
    ? result.usage['cost_in_usd_ticks']
    : undefined
  const providerCostCents = usageCostRaw !== undefined ? usageCostRaw / 100_000_000 : undefined
  const moderation = result.data?.[0]?.['respect_moderation'] ?? result['respect_moderation']

  logMediaGenerationStatus(l, {
    mediaType: 'image',
    provider: 'grok',
    model: options.model,
    status: 'completed',
    processingTimeMs: processingTime,
    outputCount: imagePaths.length,
    artifacts: imagePaths.map((imagePath, index) => ({
      artifact: index === 0 ? 'image' : `image ${index + 1}`,
      path: imagePath
    }))
  })

  return {
    imagePaths,
    metadata: {
      imageService: 'grok',
      imageModel: options.model,
      processingTime,
      imageCount: imagePaths.length,
      imageFileNames: getImageFileNames(imagePaths),
      imageFileSize: imageFile.size,
      imageWidth: undefined,
      imageHeight: undefined,
      requestMode: mode,
      ...(getFirstRevisedPrompt(result) ? { revisedPrompt: getFirstRevisedPrompt(result) } : {}),
      ...(getProviderReturnedModel(options.model, result) ? { providerReturnedModel: getProviderReturnedModel(options.model, result) } : {}),
      ...(usageCostRaw !== undefined ? { usageCostRaw } : {}),
      ...(providerCostCents !== undefined ? { providerCostCents, providerCostSource: 'provider_usage' as const } : {}),
      ...(moderation !== undefined ? { providerModeration: moderation } : {})
    }
  }
}
