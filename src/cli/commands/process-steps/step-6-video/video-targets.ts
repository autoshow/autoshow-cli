import type { VideoProvider, ProcessingOptions, Step6VideoMetadata } from '~/types'
import { type GeminiVideoModel, type MinimaxVideoModel, validateGeminiVideoModel, validateMinimaxVideoModel } from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildSingleArtifactMap, getSingleFileArtifactName } from '~/cli/commands/process-steps/target-runner'
import { runGeminiVideoGen } from './video-services/gemini/run-gemini-video-gen'
import { runMinimaxVideoGen } from './video-services/minimax/run-minimax-video-gen'

export type VideoGenOptions = Pick<
  ProcessingOptions,
  'geminiVideoModel' | 'minimaxVideoModel' | 'videoDuration' | 'videoSize' | 'videoAspectRatio' | 'videoResolution'
>

export type VideoTarget = {
  service: VideoProvider
  model: string
  run: (prompt: string, outputDir: string) => Promise<{ videoPath: string, metadata: Step6VideoMetadata }>
}

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

  if (typeof options.geminiVideoModel === 'string' && options.geminiVideoModel.length > 0) {
    const model: GeminiVideoModel = validateGeminiVideoModel(options.geminiVideoModel)

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

  if (typeof options.minimaxVideoModel === 'string' && options.minimaxVideoModel.length > 0) {
    const model: MinimaxVideoModel = validateMinimaxVideoModel(options.minimaxVideoModel)

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
