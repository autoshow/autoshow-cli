import type { ProcessingOptions, Step6VideoMetadata } from '~/types'
import type { VideoProvider } from '~/types'
import { type GeminiVideoModel, type MinimaxVideoModel, validateGeminiVideoModel, validateMinimaxVideoModel } from '~/cli/commands/models/model-options'
import { assertNever } from '~/utils/validate/assert-never'
import { runGeminiVideoGen } from './video-services/gemini/run-gemini-video-gen'
import { runMinimaxVideoGen } from './video-services/minimax/run-minimax-video-gen'

type VideoGenOptions = Pick<
  ProcessingOptions,
  'geminiVideoModel' | 'minimaxVideoModel' | 'videoDuration' | 'videoSize' | 'videoAspectRatio' | 'videoResolution'
>

const resolveVideoEngine = (options: VideoGenOptions): VideoProvider => {
  const hasGemini = typeof options.geminiVideoModel === 'string' && options.geminiVideoModel.length > 0
  const hasMinimax = typeof options.minimaxVideoModel === 'string' && options.minimaxVideoModel.length > 0

  const providerCount = [hasGemini, hasMinimax].filter(Boolean).length
  if (providerCount > 1) {
    throw new Error('Cannot use more than one video provider at the same time (--gemini-video, --minimax-video)')
  }

  if (hasGemini) return 'gemini'
  if (hasMinimax) return 'minimax'
  throw new Error('Specify a video generation provider: --gemini-video <model>, or --minimax-video <model>')
}

export const runVideoGen = async (
  prompt: string,
  outputDir: string,
  options: VideoGenOptions
): Promise<{ videoPath: string, metadata: Step6VideoMetadata }> => {

  const engine = resolveVideoEngine(options)

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
