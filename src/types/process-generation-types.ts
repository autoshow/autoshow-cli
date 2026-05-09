import * as v from 'valibot'
import type { ImageProvider, MusicProvider, TtsProvider, VideoProvider } from './provider-types'

export type Step4Metadata = {
  ttsService: TtsProvider
  ttsModel: string
  speaker?: string
  language?: string
  processingTime: number
  audioFileName: string
  audioFileSize: number
  chunkCount: number
  clonedVoiceId?: string | undefined
  cloneCostCents?: number | undefined
}

export const TtsScriptOutputSchema = v.object({
  sampleRate: v.number(),
  chunkCount: v.number(),
  durationSeconds: v.number()
})

export type Step5Metadata = {
  imageService: ImageProvider
  imageModel: string
  processingTime: number
  imageFileNames: string[]
  imageCount: number
  imageFileSize: number
  imageWidth: number | undefined
  imageHeight: number | undefined
  imageSize?: string | undefined
  imageQuality?: string | undefined
  imageFormat?: string | undefined
  providerCostCents?: number | undefined
  providerCostSource?: 'provider_quote' | 'registry_fallback' | undefined
}

export type Step6VideoMetadata = {
  videoGenService: VideoProvider
  videoGenModel: string
  processingTime: number
  videoFileName: string
  videoFileSize: number
  videoDuration: number | undefined
}

export type Step7MusicMetadata = {
  musicService: MusicProvider
  musicModel: string
  processingTime: number
  musicFileName: string
  musicFileSize: number
  musicDurationMs: number | undefined
  lyricsSource: 'provided' | 'generated' | 'none'
  providerCostCents?: number | undefined
  providerCostSource?: 'provider_quote' | 'registry_fallback' | undefined
}

export type TimingStepEntry = {
  step: 'stt' | 'extract' | 'llm' | 'tts' | 'image' | 'video' | 'music'
  provider: string
  model: string
  processingTimeMs: number
  inputMetric?: string
  inputValue?: number
}
