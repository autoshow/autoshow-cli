import type { ProcessingOptions, Step6VideoMetadata } from '~/types/process-types'
import type { VideoProvider } from '~/types/provider-types'

export type VideoGenOptions = Pick<
  ProcessingOptions,
  'geminiVideoModels' | 'geminiVideoModel' | 'minimaxVideoModels' | 'minimaxVideoModel' | 'videoDuration' | 'videoSize' | 'videoAspectRatio' | 'videoResolution'
>

export type VideoTarget = {
  service: VideoProvider
  model: string
  run: (prompt: string, outputDir: string) => Promise<{ videoPath: string, metadata: Step6VideoMetadata }>
}
