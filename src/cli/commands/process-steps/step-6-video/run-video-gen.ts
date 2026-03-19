import type { ProcessingOptions, Step6VideoMetadata } from '~/types'
import type { VideoProvider } from '~/types'
import { type GeminiVideoModel, type MinimaxVideoModel, type SoraVideoModel, validateGeminiVideoModel, validateMinimaxVideoModel, validateSoraVideoModel } from '~/cli/commands/models/model-options'
import { assertNever } from '~/utils/validate/assert-never'
import { runSoraVideoGen } from './video-services/sora/run-sora-video-gen'
import { runGeminiVideoGen } from './video-services/gemini/run-gemini-video-gen'
import { runMinimaxVideoGen } from './video-services/minimax/run-minimax-video-gen'

type VideoGenOptions = Pick<
  ProcessingOptions,
  'soraVideoModel' | 'geminiVideoModel' | 'minimaxVideoModel' | 'videoDuration' | 'videoSize' | 'videoAspectRatio' | 'videoResolution'
>

const resolveVideoEngine = (options: VideoGenOptions): VideoProvider => {
  const hasSora = typeof options.soraVideoModel === 'string' && options.soraVideoModel.length > 0
  const hasGemini = typeof options.geminiVideoModel === 'string' && options.geminiVideoModel.length > 0
  const hasMinimax = typeof options.minimaxVideoModel === 'string' && options.minimaxVideoModel.length > 0

  const providerCount = [hasSora, hasGemini, hasMinimax].filter(Boolean).length
  if (providerCount > 1) {
    throw new Error('Cannot use more than one video provider at the same time (--sora-video, --gemini-video, --minimax-video)')
  }

  if (hasSora) return 'sora'
  if (hasGemini) return 'gemini'
  if (hasMinimax) return 'minimax'
  throw new Error('Specify a video generation provider: --sora-video <model>, --gemini-video <model>, or --minimax-video <model>')
}

export const runVideoGen = async (
  prompt: string,
  outputDir: string,
  options: VideoGenOptions
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {

  const engine = resolveVideoEngine(options)

  if (engine === 'sora') {
    const modelRaw = options.soraVideoModel
    if (!modelRaw) {
      throw new Error('Missing Sora model')
    }
    const model: SoraVideoModel = validateSoraVideoModel(modelRaw)
    return await runSoraVideoGen(prompt, outputDir, {
      model,
      seconds: options.videoDuration,
      size: options.videoSize
    })
  }

  if (engine === 'gemini') {
    const modelRaw = options.geminiVideoModel
    if (!modelRaw) {
      throw new Error('Missing Gemini model')
    }
    const model: GeminiVideoModel = validateGeminiVideoModel(modelRaw)
    return await runGeminiVideoGen(prompt, outputDir, {
      model,
      aspectRatio: options.videoAspectRatio,
      resolution: options.videoResolution,
      durationSeconds: options.videoDuration
    })
  }

  if (engine === 'minimax') {
    const modelRaw = options.minimaxVideoModel
    if (!modelRaw) {
      throw new Error('Missing MiniMax model')
    }
    const model: MinimaxVideoModel = validateMinimaxVideoModel(modelRaw)
    return await runMinimaxVideoGen(prompt, outputDir, {
      model,
      durationSeconds: options.videoDuration,
      resolution: options.videoResolution
    })
  }

  assertNever(engine)
}
