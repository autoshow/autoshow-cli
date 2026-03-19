import type { ProcessingOptions, Step5Metadata } from '~/types'
import type { ImageProvider } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { type GeminiImageModel, type MinimaxImageModel, type OpenAIImageModel, supportsGeminiImageSize, validateGeminiImageModel, validateMinimaxImageModel, validateOpenAIImageModel } from '~/cli/commands/models/model-options'
import { assertNever } from '~/utils/validate/assert-never'
import { ensureGeminiImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/gemini/gemini-image-gen'
import { ensureOpenAIImageGenSetup } from '~/cli/commands/process-steps/step-5-image/image-services/openai/openai-image-gen'
import { runGeminiImageGen } from './image-services/gemini/run-gemini-image-gen'
import { runMinimaxImageGen } from './image-services/minimax/run-minimax-image-gen'
import { runOpenAIImageGen } from './image-services/openai/run-openai-image-gen'

type ImageGenOptions = Pick<
  ProcessingOptions,
  | 'geminiImageModel'
  | 'openaiImageModel'
  | 'minimaxImageModel'
  | 'imageAspectRatio'
  | 'imageSize'
  | 'imageQuality'
  | 'imageFormat'
  | 'imageBackground'
  | 'imagenCount'
>

const resolveImageEngine = (options: ImageGenOptions): ImageProvider => {
  const hasGemini = typeof options.geminiImageModel === 'string' && options.geminiImageModel.length > 0
  const hasOpenAI = typeof options.openaiImageModel === 'string' && options.openaiImageModel.length > 0
  const hasMinimax = typeof options.minimaxImageModel === 'string' && options.minimaxImageModel.length > 0

  const providerCount = [hasGemini, hasOpenAI, hasMinimax].filter(Boolean).length
  if (providerCount > 1) {
    throw CLIUsageError('Cannot use more than one image provider at the same time (--gemini-image, --openai-image, --minimax-image)')
  }

  if (hasGemini) return 'gemini'
  if (hasOpenAI) return 'openai'
  if (hasMinimax) return 'minimax'
  throw CLIUsageError('No image provider specified. Use --gemini-image, --openai-image, or --minimax-image.')
}

export const runImageGen = async (
  prompt: string,
  outputDir: string,
  options: ImageGenOptions
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {

  const engine = resolveImageEngine(options)

  if (engine === 'gemini') {
    const model: GeminiImageModel = validateGeminiImageModel(options.geminiImageModel as string)
    if (typeof options.imageSize === 'string' && options.imageSize.length > 0 && !supportsGeminiImageSize(model)) {
      throw CLIUsageError(`--image-size is not supported by Gemini image model "${model}"`)
    }
    await ensureGeminiImageGenSetup()
    return await runGeminiImageGen(prompt, outputDir, {
      model,
      aspectRatio: options.imageAspectRatio,
      imageSize: options.imageSize,
      imagenCount: options.imagenCount
    })
  }

  if (engine === 'openai') {
    const model: OpenAIImageModel = validateOpenAIImageModel(options.openaiImageModel as string)
    await ensureOpenAIImageGenSetup()
    return await runOpenAIImageGen(prompt, outputDir, {
      model,
      size: options.imageSize,
      quality: options.imageQuality,
      outputFormat: options.imageFormat,
      background: options.imageBackground
    })
  }

  if (engine === 'minimax') {
    const model: MinimaxImageModel = validateMinimaxImageModel(options.minimaxImageModel as string)
    return await runMinimaxImageGen(prompt, outputDir, {
      model,
      aspectRatio: options.imageAspectRatio
    })
  }

  assertNever(engine)
}
