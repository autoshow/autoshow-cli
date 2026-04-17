import { extname } from 'node:path'
import type { ImageGenOptions, ImageTarget, Step5Metadata } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import {
  type GeminiImageModel,
  type MinimaxImageModel,
  type OpenAIImageModel,
  isNativeGeminiImageModel,
  supportsGeminiImageSize,
  validateGeminiImageModel,
  validateMinimaxImageModel,
  validateOpenAIImageModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { ensureGeminiImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/gemini/gemini-image-gen'
import { ensureOpenAIImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/openai/openai-image-gen'
import { sanitizeModelName } from '~/cli/commands/process-steps/target-runner'
import { runGeminiImageGen } from './image-services/gemini/run-gemini-image-gen'
import { runMinimaxImageGen } from './image-services/minimax/run-minimax-image-gen'
import { runOpenAIImageGen } from './image-services/openai/run-openai-image-gen'

export const sanitizeImageModelName = sanitizeModelName

const normalizeOpenAIImageExtension = (format: string | undefined): string => {
  if (format === 'jpeg') {
    return 'jpg'
  }
  return format ?? 'png'
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
  metadata: Pick<Step5Metadata, 'imageFileName' | 'imageFileNames'>
): string[] => metadata.imageFileNames.length > 0 ? metadata.imageFileNames : [metadata.imageFileName]

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

  if (typeof options.geminiImageModel === 'string' && options.geminiImageModel.length > 0) {
    const model: GeminiImageModel = validateGeminiImageModel(options.geminiImageModel)
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

  if (typeof options.openaiImageModel === 'string' && options.openaiImageModel.length > 0) {
    const model: OpenAIImageModel = validateOpenAIImageModel(options.openaiImageModel)

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

  if (typeof options.minimaxImageModel === 'string' && options.minimaxImageModel.length > 0) {
    const model: MinimaxImageModel = validateMinimaxImageModel(options.minimaxImageModel)

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

  return targets
}
