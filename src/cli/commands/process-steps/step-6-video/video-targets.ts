import type { DeapiVideoModel, GeminiVideoModel, GlmVideoModel, GrokVideoModel, MinimaxVideoModel, RunwayVideoModel, Step6VideoMetadata, VideoGenOptions, VideoTarget } from '~/types'
import { validateDeapiVideoModel, validateGeminiVideoModel, validateGlmVideoModel, validateGrokVideoModel, validateMinimaxVideoModel, validateRunwayVideoModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildSingleArtifactMap, getSingleFileArtifactName } from '~/cli/commands/process-steps/target-runner'
import { CLIUsageError } from '~/utils/error-handler'
import { ensureDeapiVideoGenSetup } from './video-services/deapi/deapi-video-gen'
import { runDeapiVideoGen } from './video-services/deapi/run-deapi-video-gen'
import { runGeminiVideoGen } from './video-services/gemini/run-gemini-video-gen'
import { runMinimaxVideoGen } from './video-services/minimax/run-minimax-video-gen'
import { runGlmVideoGen } from './video-services/glm/run-glm-video-gen'
import { runGrokVideoGen } from './video-services/grok/run-grok-video-gen'
import { runRunwayVideoGen } from './video-services/runway/run-runway-video-gen'
import { normalizeDeapiVideoSize, normalizeGeminiResolution } from './video-utils/video-normalization'

export const getVideoArtifactFileName = (
  target: Pick<VideoTarget, 'service' | 'model'>,
  singleTarget: boolean
): string =>
  getSingleFileArtifactName(target, singleTarget, {
    singleFileName: 'generated-video.mp4',
    multiFilePrefix: 'generated-video',
    extension: 'mp4'
  })

export const buildVideoArtifactMap = (metadata: Step6VideoMetadata[]): Record<string, string> =>
  buildSingleArtifactMap(metadata, {
    singleKey: 'video',
    multiKeyPrefix: 'video',
    getService: (entry) => entry.videoGenService,
    getModel: (entry) => entry.videoGenModel,
    getFileName: (entry) => entry.videoFileName
  });

export const collectVideoTargets = (options: VideoGenOptions): VideoTarget[] => {
  const targets: VideoTarget[] = []
  const geminiModels = options.geminiVideoModels ?? (options.geminiVideoModel ? [options.geminiVideoModel] : [])
  const minimaxModels = options.minimaxVideoModels ?? (options.minimaxVideoModel ? [options.minimaxVideoModel] : [])
  const glmModels = options.glmVideoModels ?? (options.glmVideoModel ? [options.glmVideoModel] : [])
  const grokModels = options.grokVideoModels ?? (options.grokVideoModel ? [options.grokVideoModel] : [])
  const runwayModels = options.runwayVideoModels ?? (options.runwayVideoModel ? [options.runwayVideoModel] : [])
  const deapiModels = options.deapiVideoModels ?? (options.deapiVideoModel ? [options.deapiVideoModel] : [])

  for (const rawModel of geminiModels) {
    const model: GeminiVideoModel = validateGeminiVideoModel(rawModel)
    normalizeGeminiResolution(options.videoResolution)

    targets.push({
      service: 'gemini',
      model,
      run: async (prompt, outputDir) => {
        return await runGeminiVideoGen(prompt, outputDir, {
          model,
          aspectRatio: options.videoAspectRatio,
          resolution: options.videoResolution,
          durationSeconds: options.videoDuration
        })
      }
    })
  }

  for (const rawModel of minimaxModels) {
    const model: MinimaxVideoModel = validateMinimaxVideoModel(rawModel)

    targets.push({
      service: 'minimax',
      model,
      run: async (prompt, outputDir) => {
        return await runMinimaxVideoGen(prompt, outputDir, {
          model,
          durationSeconds: options.videoDuration,
          resolution: options.videoResolution
        })
      }
    })
  }

  for (const rawModel of glmModels) {
    const model: GlmVideoModel = validateGlmVideoModel(rawModel)

    targets.push({
      service: 'glm',
      model,
      run: async (prompt, outputDir) => {
        return await runGlmVideoGen(prompt, outputDir, {
          model,
          durationSeconds: options.videoDuration,
          size: options.videoSize,
          aspectRatio: options.videoAspectRatio
        })
      }
    })
  }

  for (const rawModel of grokModels) {
    const model: GrokVideoModel = validateGrokVideoModel(rawModel)

    targets.push({
      service: 'grok',
      model,
      run: async (prompt, outputDir) => {
        return await runGrokVideoGen(prompt, outputDir, {
          model,
          durationSeconds: options.videoDuration,
          aspectRatio: options.videoAspectRatio,
          resolution: options.videoResolution
        })
      }
    })
  }

  for (const rawModel of runwayModels) {
    const model: RunwayVideoModel = validateRunwayVideoModel(rawModel)

    targets.push({
      service: 'runway',
      model,
      run: async (prompt, outputDir) => {
        return await runRunwayVideoGen(prompt, outputDir, {
          model,
          durationSeconds: options.videoDuration,
          aspectRatio: options.videoAspectRatio
        })
      }
    })
  }

  for (const rawModel of deapiModels) {
    const model: DeapiVideoModel = validateDeapiVideoModel(rawModel)
    const unsupported: string[] = []
    if (options.videoAspectRatio) unsupported.push('--video-aspect-ratio')
    if (options.videoResolution) unsupported.push('--video-resolution')
    if (unsupported.length > 0) {
      throw CLIUsageError(`${unsupported.join(', ')} ${unsupported.length === 1 ? 'is' : 'are'} not supported by deAPI video generation. Use --video-size WIDTHxHEIGHT for deAPI dimensions.`)
    }
    normalizeDeapiVideoSize(model, options.videoSize)

    targets.push({
      service: 'deapi',
      model,
      run: async (prompt, outputDir) => {
        await ensureDeapiVideoGenSetup()
        return await runDeapiVideoGen(prompt, outputDir, {
          model,
          durationSeconds: options.videoDuration,
          videoSize: options.videoSize
        })
      }
    })
  }

  return targets
}
