import { extname } from 'node:path'
import type { BflImageModel, DeapiImageModel, GeminiImageModel, GlmImageModel, GrokImageModel, ImageGenOptions, ImageTarget, MinimaxImageModel, OpenAIImageModel, RunwayImageModel, Step5Metadata } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import {
  isNativeGeminiImageModel,
  supportsGeminiImageSize,
  validateBflImageModel,
  validateGeminiImageModel,
  validateDeapiImageModel,
  validateGlmImageModel,
  validateGrokImageModel,
  validateMinimaxImageModel,
  validateOpenAIImageModel,
  validateRunwayImageModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureBflImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/bfl/bfl-image-gen'
import { ensureDeapiImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/deapi/deapi-image-gen'
import { ensureGeminiImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/gemini/gemini-image-gen'
import { ensureGrokImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/grok/grok-image-gen'
import { ensureOpenAIImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/openai/openai-image-gen'
import { ensureRunwayImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/runway/runway-image-gen'
import { sanitizeModelName } from '~/cli/commands/process-steps/target-runner'
import { getBflImageExtension, normalizeBflImageOutputFormat, normalizeBflImageSize, runBflImageGen } from './image-services/bfl/run-bfl-image-gen'
import { normalizeDeapiImageSize, runDeapiImageGen } from './image-services/deapi/run-deapi-image-gen'
import { runGeminiImageGen } from './image-services/gemini/run-gemini-image-gen'
import { normalizeGlmImageSize, runGlmImageGen } from './image-services/glm/run-glm-image-gen'
import { normalizeGrokImageResolution, runGrokImageGen } from './image-services/grok/run-grok-image-gen'
import { runMinimaxImageGen } from './image-services/minimax/run-minimax-image-gen'
import { runOpenAIImageGen } from './image-services/openai/run-openai-image-gen'
import { normalizeRunwayImageRatio, normalizeRunwayImageResolution, runRunwayImageGen } from './image-services/runway/run-runway-image-gen'

export const sanitizeImageModelName = sanitizeModelName

const normalizeOpenAIImageExtension = (format: string | undefined): string => {
  if (format === 'jpeg') {
    return 'jpg'
  }
  return format ?? 'png'
}

const OPENAI_LEGACY_IMAGE_SIZES = new Set(['auto', '1024x1024', '1536x1024', '1024x1536'])

const parseImageDimensions = (size: string): { width: number, height: number } | undefined => {
  const match = size.match(/^(\d+)x(\d+)$/i)
  if (!match) return undefined

  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height)) return undefined
  return { width, height }
}

const validateGptImage2Size = (size: string | undefined): void => {
  if (size === undefined || size.toLowerCase() === 'auto') {
    return
  }

  const dimensions = parseImageDimensions(size)
  if (!dimensions) {
    throw CLIUsageError(`Invalid --image-size value "${size}" for gpt-image-2. Expected auto or WIDTHxHEIGHT.`)
  }

  const { width, height } = dimensions
  const longEdge = Math.max(width, height)
  const shortEdge = Math.min(width, height)
  const totalPixels = width * height

  if (
    longEdge > 3840
    || width % 16 !== 0
    || height % 16 !== 0
    || longEdge / shortEdge > 3
    || totalPixels < 655_360
    || totalPixels > 8_294_400
  ) {
    throw CLIUsageError(
      `Invalid --image-size value "${size}" for gpt-image-2. Width and height must be multiples of 16, max edge <= 3840, aspect ratio <= 3:1, and total pixels between 655,360 and 8,294,400.`
    )
  }
}

const validateLegacyOpenAIImageSize = (model: OpenAIImageModel, size: string | undefined): void => {
  if (size === undefined || OPENAI_LEGACY_IMAGE_SIZES.has(size.toLowerCase())) {
    return
  }

  throw CLIUsageError(`Invalid --image-size value "${size}" for ${model}. Expected auto, 1024x1024, 1536x1024, or 1024x1536.`)
}

export const validateOpenAIImageOptions = (
  model: OpenAIImageModel,
  options: Pick<ImageGenOptions, 'imageSize' | 'imageBackground'>
): void => {
  if (model === 'gpt-image-2') {
    validateGptImage2Size(options.imageSize)
    if (options.imageBackground?.toLowerCase() === 'transparent') {
      throw CLIUsageError('--image-background transparent is not supported by gpt-image-2.')
    }
    return
  }

  validateLegacyOpenAIImageSize(model, options.imageSize)
}

export const getExpectedImageCount = (
  target: Pick<ImageTarget, 'service' | 'model'>,
  options: ImageGenOptions
): number => {
  if (target.service !== 'gemini') {
    return 1
  }

  const model = target.model as GeminiImageModel
  if (isNativeGeminiImageModel(model)) {
    return 1
  }

  return Math.max(1, options.imagenCount ?? 1)
}

const getExpectedImageExtension = (
  target: Pick<ImageTarget, 'service' | 'model'>,
  options: ImageGenOptions
): string => {
  if (target.service === 'openai') {
    return normalizeOpenAIImageExtension(options.imageFormat)
  }

  if (target.service === 'minimax') {
    return 'jpeg'
  }

  if (target.service === 'bfl') {
    return getBflImageExtension(options.imageFormat)
  }

  return 'png'
}

export const getImageArtifactFileName = (
  target: Pick<ImageTarget, 'service' | 'model'> | Pick<Step5Metadata, 'imageService' | 'imageModel'>,
  singleTarget: boolean,
  sourceFileName: string,
  index: number
): string => {
  const ext = extname(sourceFileName).replace(/^\./, '') || 'png'
  if (singleTarget) {
    return index === 0 ? `generated-image.${ext}` : `generated-image-${index + 1}.${ext}`
  }

  const service = 'service' in target ? target.service : target.imageService
  const model = 'model' in target ? target.model : target.imageModel
  const baseName = `generated-image-${service}-${sanitizeImageModelName(model)}`
  return index === 0 ? `${baseName}.${ext}` : `${baseName}-${index + 1}.${ext}`
}

export const getImageArtifactFileNames = (
  target: Pick<ImageTarget, 'service' | 'model'> | Pick<Step5Metadata, 'imageService' | 'imageModel'>,
  sourceFileNames: string[],
  singleTarget: boolean
): string[] => sourceFileNames.map((fileName, index) =>
  getImageArtifactFileName(target, singleTarget, fileName, index)
)

export const getExpectedImageArtifactFileNames = (
  target: Pick<ImageTarget, 'service' | 'model'>,
  options: ImageGenOptions,
  singleTarget: boolean
): string[] => {
  const imageCount = getExpectedImageCount(target, options)
  const extension = getExpectedImageExtension(target, options)

  return Array.from({ length: imageCount }, (_, index) =>
    getImageArtifactFileName(target, singleTarget, `placeholder.${extension}`, index)
  )
}

export const getStep5ImageFileNames = (
  metadata: Pick<Step5Metadata, 'imageFileNames'>
): string[] => metadata.imageFileNames

export const buildImageArtifactMap = (metadata: Step5Metadata[]): Record<string, string> => {
  if (metadata.length === 1) {
    return Object.fromEntries(
      getStep5ImageFileNames(metadata[0]!).map((fileName, index) => [
        index === 0 ? 'image' : `image-${index + 1}`,
        fileName
      ])
    )
  }

  return Object.fromEntries(
    metadata.flatMap((entry) =>
      getStep5ImageFileNames(entry).map((fileName, index) => {
        const baseKey = `image-${entry.imageService}-${sanitizeImageModelName(entry.imageModel)}`
        return [index === 0 ? baseKey : `${baseKey}-${index + 1}`, fileName] as const
      })
    )
  )
}

export const collectImageTargets = (options: ImageGenOptions): ImageTarget[] => {
  const targets: ImageTarget[] = []
  const geminiModels = options.geminiImageModels ?? (options.geminiImageModel ? [options.geminiImageModel] : [])
  const openaiModels = options.openaiImageModels ?? (options.openaiImageModel ? [options.openaiImageModel] : [])
  const minimaxModels = options.minimaxImageModels ?? (options.minimaxImageModel ? [options.minimaxImageModel] : [])
  const glmModels = options.glmImageModels ?? (options.glmImageModel ? [options.glmImageModel] : [])
  const grokModels = options.grokImageModels ?? (options.grokImageModel ? [options.grokImageModel] : [])
  const runwayModels = options.runwayImageModels ?? (options.runwayImageModel ? [options.runwayImageModel] : [])
  const bflModels = options.bflImageModels ?? (options.bflImageModel ? [options.bflImageModel] : [])
  const deapiModels = options.deapiImageModels ?? (options.deapiImageModel ? [options.deapiImageModel] : [])

  for (const rawModel of geminiModels) {
    const model: GeminiImageModel = validateGeminiImageModel(rawModel)
    if (typeof options.imageSize === 'string' && options.imageSize.length > 0 && !supportsGeminiImageSize(model)) {
      throw CLIUsageError(`--image-size is not supported by Gemini image model "${model}"`)
    }

    targets.push({
      service: 'gemini',
      model,
      run: async (prompt, outputDir) => {
        await ensureGeminiImageGenSetup()
        return await runGeminiImageGen(prompt, outputDir, {
          model,
          aspectRatio: options.imageAspectRatio,
          imageSize: options.imageSize,
          imagenCount: options.imagenCount
        })
      }
    })
  }

  for (const rawModel of openaiModels) {
    const model: OpenAIImageModel = validateOpenAIImageModel(rawModel)
    validateOpenAIImageOptions(model, {
      imageSize: options.imageSize,
      imageBackground: options.imageBackground
    })

    targets.push({
      service: 'openai',
      model,
      run: async (prompt, outputDir) => {
        await ensureOpenAIImageGenSetup()
        return await runOpenAIImageGen(prompt, outputDir, {
          model,
          size: options.imageSize,
          quality: options.imageQuality,
          outputFormat: options.imageFormat,
          background: options.imageBackground
        })
      }
    })
  }

  for (const rawModel of minimaxModels) {
    const model: MinimaxImageModel = validateMinimaxImageModel(rawModel)

    targets.push({
      service: 'minimax',
      model,
      run: async (prompt, outputDir) => {
        return await runMinimaxImageGen(prompt, outputDir, {
          model,
          aspectRatio: options.imageAspectRatio
        })
      }
    })
  }

  for (const rawModel of glmModels) {
    const model: GlmImageModel = validateGlmImageModel(rawModel)
    normalizeGlmImageSize(options.imageSize)

    targets.push({
      service: 'glm',
      model,
      run: async (prompt, outputDir) => {
        return await runGlmImageGen(prompt, outputDir, {
          model,
          size: options.imageSize
        })
      }
    })
  }

  for (const rawModel of grokModels) {
    const model: GrokImageModel = validateGrokImageModel(rawModel)
    normalizeGrokImageResolution(options.imageSize)

    targets.push({
      service: 'grok',
      model,
      run: async (prompt, outputDir) => {
        await ensureGrokImageGenSetup()
        return await runGrokImageGen(prompt, outputDir, {
          model,
          aspectRatio: options.imageAspectRatio,
          imageSize: options.imageSize,
          quality: options.imageQuality
        })
      }
    })
  }

  for (const rawModel of runwayModels) {
    const model: RunwayImageModel = validateRunwayImageModel(rawModel)
    const resolution = normalizeRunwayImageResolution(options.imageSize)
    normalizeRunwayImageRatio(options.imageAspectRatio, resolution)
    const unsupported: string[] = []
    if (options.imageFormat) unsupported.push('--image-format')
    if (options.imageBackground) unsupported.push('--image-background')
    if (options.imageQuality) unsupported.push('--image-quality')
    if (unsupported.length > 0) {
      throw CLIUsageError(`${unsupported.join(', ')} ${unsupported.length === 1 ? 'is' : 'are'} not supported by Runway image generation.`)
    }

    targets.push({
      service: 'runway',
      model,
      run: async (prompt, outputDir) => {
        await ensureRunwayImageGenSetup()
        return await runRunwayImageGen(prompt, outputDir, {
          model,
          aspectRatio: options.imageAspectRatio,
          imageSize: options.imageSize
        })
      }
    })
  }

  for (const rawModel of bflModels) {
    const model: BflImageModel = validateBflImageModel(rawModel)
    const unsupported: string[] = []
    if (options.imageAspectRatio) unsupported.push('--image-aspect-ratio')
    if (options.imageQuality) unsupported.push('--image-quality')
    if (options.imageBackground) unsupported.push('--image-background')
    if (options.imagenCount !== undefined) unsupported.push('--imagen-count')
    if (unsupported.length > 0) {
      throw CLIUsageError(`${unsupported.join(', ')} ${unsupported.length === 1 ? 'is' : 'are'} not supported by BFL image generation. Use --image-size WIDTHxHEIGHT for BFL dimensions and --image-format jpeg|png|webp for output format.`)
    }
    normalizeBflImageSize(options.imageSize)
    normalizeBflImageOutputFormat(options.imageFormat)

    targets.push({
      service: 'bfl',
      model,
      run: async (prompt, outputDir) => {
        await ensureBflImageGenSetup()
        return await runBflImageGen(prompt, outputDir, {
          model,
          imageSize: options.imageSize,
          outputFormat: options.imageFormat
        })
      }
    })
  }

  for (const rawModel of deapiModels) {
    const model: DeapiImageModel = validateDeapiImageModel(rawModel)
    const unsupported: string[] = []
    if (options.imageAspectRatio) unsupported.push('--image-aspect-ratio')
    if (options.imageQuality) unsupported.push('--image-quality')
    if (options.imageFormat) unsupported.push('--image-format')
    if (options.imageBackground) unsupported.push('--image-background')
    if (options.imagenCount !== undefined) unsupported.push('--imagen-count')
    if (unsupported.length > 0) {
      throw CLIUsageError(`${unsupported.join(', ')} ${unsupported.length === 1 ? 'is' : 'are'} not supported by deAPI image generation. Use --image-size WIDTHxHEIGHT for deAPI dimensions.`)
    }
    normalizeDeapiImageSize(model, options.imageSize)

    targets.push({
      service: 'deapi',
      model,
      run: async (prompt, outputDir) => {
        await ensureDeapiImageGenSetup()
        return await runDeapiImageGen(prompt, outputDir, {
          model,
          imageSize: options.imageSize
        })
      }
    })
  }

  return targets
}
