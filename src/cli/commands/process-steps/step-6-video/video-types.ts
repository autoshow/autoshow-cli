import type { CostEstimateBase, ProcessingOptions, ProviderTargetBase, Step6VideoMetadata } from '~/types'
import type { VideoProvider } from '~/types'

export type VideoGenOptions = Pick<
  ProcessingOptions,
  | 'geminiVideoModels' | 'geminiVideoModel'
  | 'minimaxVideoModels' | 'minimaxVideoModel'
  | 'glmVideoModels' | 'glmVideoModel'
  | 'grokVideoModels' | 'grokVideoModel'
  | 'runwayVideoModels' | 'runwayVideoModel'
  | 'allVideo'
  | 'videoDuration' | 'videoSize' | 'videoAspectRatio' | 'videoResolution'
  | 'videoMode' | 'videoInputImage' | 'videoLastFrame' | 'videoReferenceImages' | 'videoInputVideo'
  | 'grokVideoStorageFilename' | 'grokVideoStorageExpiresAfter'
  | 'videoProviderConcurrency' | 'videoLocalConcurrency'
>

export type VideoMode = 'text' | 'image-to-video' | 'reference-to-video' | 'interpolate' | 'extend' | 'edit'
export type GeminiDurationSeconds = 4 | 6 | 8
export type GeminiResolution = '720p' | '1080p' | '4k'
export type MinimaxResolution = '720p' | '1080p'
export type MinimaxApiResolution = '720P' | '768P' | '1080P'
export type MinimaxDurationSeconds = 6 | 10
export type GlmVideoDurationSeconds = 4 | 5 | 10
export type GlmVideoQuality = 'speed' | 'quality'
export type GlmVideoFps = 30 | 60
export type GrokVideoDurationSeconds = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15
export type GrokVideoResolution = '480p' | '720p' | '1080p'
export type RunwayDurationSeconds = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export type RunwayRatio = '1280:720' | '720:1280'

export type VideoTarget = ProviderTargetBase<VideoProvider> & {
  run: (prompt: string | undefined, outputDir: string) => Promise<{ videoPath: string, metadata: Step6VideoMetadata }>
}

export type VideoCostEstimate = CostEstimateBase<VideoProvider> & {
  durationSeconds: number
  billedDurationSeconds: number
  costPerSecond: number
}

export type EstimateVideoCostOptions = {
  geminiVideoModels?: string[] | undefined
  geminiVideoModel?: string | undefined
  minimaxVideoModels?: string[] | undefined
  minimaxVideoModel?: string | undefined
  glmVideoModels?: string[] | undefined
  glmVideoModel?: string | undefined
  grokVideoModels?: string[] | undefined
  grokVideoModel?: string | undefined
  runwayVideoModels?: string[] | undefined
  runwayVideoModel?: string | undefined
  videoDuration?: number | undefined
  videoSize?: string | undefined
  videoAspectRatio?: string | undefined
  videoResolution?: string | undefined
  videoMode?: string | undefined
}
