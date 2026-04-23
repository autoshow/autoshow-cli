import type { CostEstimateBase, ProcessingOptions, ProviderTargetBase, Step6VideoMetadata } from '~/types'
import type { VideoProvider } from '~/types'

export type VideoGenOptions = Pick<
  ProcessingOptions,
  'geminiVideoModels' | 'geminiVideoModel' | 'minimaxVideoModels' | 'minimaxVideoModel' | 'videoDuration' | 'videoSize' | 'videoAspectRatio' | 'videoResolution'
>

export type GeminiDurationSeconds = 4 | 6 | 8
export type GeminiResolution = '720p' | '1080p'
export type MinimaxResolution = '720p' | '1080p'
export type MinimaxApiResolution = '720P' | '768P' | '1080P'
export type MinimaxDurationSeconds = 6 | 10

export type VideoTarget = ProviderTargetBase<VideoProvider> & {
  run: (prompt: string, outputDir: string) => Promise<{ videoPath: string, metadata: Step6VideoMetadata }>
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
  videoDuration?: number | undefined
  videoSize?: string | undefined
  videoResolution?: string | undefined
}
