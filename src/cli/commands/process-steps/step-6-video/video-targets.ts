import type { GeminiVideoModel, MinimaxVideoModel, Step6VideoMetadata, VideoGenOptions, VideoTarget } from '~/types'
import { validateGeminiVideoModel, validateMinimaxVideoModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildSingleArtifactMap, getSingleFileArtifactName } from '~/cli/commands/process-steps/target-runner'
import { runGeminiVideoGen } from './video-services/gemini/run-gemini-video-gen'
import { runMinimaxVideoGen } from './video-services/minimax/run-minimax-video-gen'

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

  for (const rawModel of geminiModels) {
    const model: GeminiVideoModel = validateGeminiVideoModel(rawModel)

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

  return targets
}
