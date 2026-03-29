import {
  SUPPORTED_ANTHROPIC_MODELS,
  SUPPORTED_ELEVENLABS_STT_MODELS,
  SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_GEMINI_IMAGE_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_GEMINI_VIDEO_MODELS,
  SUPPORTED_GROQ_MODELS,
  SUPPORTED_GROQ_STT_MODELS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_KITTEN_TTS_MODELS,
  SUPPORTED_MISTRAL_OCR_MODELS,
  SUPPORTED_ASSEMBLYAI_STT_MODELS,
  SUPPORTED_MISTRAL_STT_MODELS,
  SUPPORTED_MINIMAX_IMAGE_MODELS,
  SUPPORTED_MINIMAX_MUSIC_MODELS,
  SUPPORTED_MINIMAX_MODELS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_MINIMAX_VIDEO_MODELS,
  SUPPORTED_OPENAI_IMAGE_MODELS,
  SUPPORTED_OPENAI_STT_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS
} from '~/cli/commands/models/model-options'
import type { MusicProvider, TtsProvider, VideoProvider } from '~/types/provider-types'

export type GroqModel = typeof SUPPORTED_GROQ_MODELS[number]
export type AnthropicModel = typeof SUPPORTED_ANTHROPIC_MODELS[number]
export type MinimaxModel = typeof SUPPORTED_MINIMAX_MODELS[number]
export type ElevenlabsSttModel = typeof SUPPORTED_ELEVENLABS_STT_MODELS[number]
export type GroqSttModel = typeof SUPPORTED_GROQ_STT_MODELS[number]
export type OpenAISttModel = typeof SUPPORTED_OPENAI_STT_MODELS[number]
export type MistralSttModel = typeof SUPPORTED_MISTRAL_STT_MODELS[number]
export type AssemblyaiSttModel = typeof SUPPORTED_ASSEMBLYAI_STT_MODELS[number]
export type MistralOcrModel = typeof SUPPORTED_MISTRAL_OCR_MODELS[number]
export type KittenTtsModel = typeof SUPPORTED_KITTEN_TTS_MODELS[number]
export type ElevenlabsTtsModel = typeof SUPPORTED_ELEVENLABS_TTS_MODELS[number]
export type MinimaxTtsModel = typeof SUPPORTED_MINIMAX_TTS_MODELS[number]
export type GroqTtsModel = typeof SUPPORTED_GROQ_TTS_MODELS[number]
export type OpenAITtsModel = typeof SUPPORTED_OPENAI_TTS_MODELS[number]
export type GeminiTtsModel = typeof SUPPORTED_GEMINI_TTS_MODELS[number]
export type ElevenlabsMusicModel = typeof SUPPORTED_ELEVENLABS_MUSIC_MODELS[number]
export type MinimaxMusicModel = typeof SUPPORTED_MINIMAX_MUSIC_MODELS[number]
export type GeminiImageModel = typeof SUPPORTED_GEMINI_IMAGE_MODELS[number]
export type OpenAIImageModel = typeof SUPPORTED_OPENAI_IMAGE_MODELS[number]
export type MinimaxImageModel = typeof SUPPORTED_MINIMAX_IMAGE_MODELS[number]
export type GeminiVideoModel = typeof SUPPORTED_GEMINI_VIDEO_MODELS[number]
export type MinimaxVideoModel = typeof SUPPORTED_MINIMAX_VIDEO_MODELS[number]

export type GeminiDurationSeconds = 4 | 6 | 8
export type GeminiResolution = '720p' | '1080p'
export type MinimaxResolution = '720p' | '1080p'
export type MinimaxApiResolution = '720P' | '768P' | '1080P'
export type MinimaxDurationSeconds = 6 | 10

export type ScanBlocksOptions = {
  max?: number
}

export type ParsedEpisode = {
  id: string | undefined
  enclosureUrl: string
  title: string | undefined
  pubDate: string | undefined
  duration: string | undefined
}

export type ParsedFeed = {
  title: string | undefined
  link: string | undefined
  author: string | undefined
  image: string | undefined
  episodes: ParsedEpisode[]
}

export type ProviderModelBase<P extends string = string, M extends string = string> = {
  provider: P
  model: M
}

export type RateEstimateBase<P extends string = string, M extends string = string> =
  ProviderModelBase<P, M> & {
    note?: string
  }

export type CostEstimateBase<P extends string = string, M extends string = string> =
  ProviderModelBase<P, M> & {
    totalCost: number
    costMultiplier?: number
    note?: string
  }

export type LlmRateEstimate = RateEstimateBase & {
  inputCostPer1MCents: number
  outputCostPer1MCents: number
}

export type TtsPricingEstimateBase = {
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
}

export type TtsRateEstimate = RateEstimateBase<TtsProvider> & TtsPricingEstimateBase

export type TtsCostEstimate = CostEstimateBase<TtsProvider> & TtsPricingEstimateBase & {
  characterCount: number
}

export type ImageCostEstimate = CostEstimateBase<'gemini' | 'openai' | 'minimax'> & {
  imageCount: number
  costPerImageCents: number
}

export type EstimateImageCostOptions = {
  geminiImageModel?: string | undefined
  openaiImageModel?: string | undefined
  minimaxImageModel?: string | undefined
  imagenCount?: number | undefined
}

export type ElevenlabsTtsCostEstimate = CostEstimateBase<'elevenlabs', ElevenlabsTtsModel> & {
  characterCount: number
  costPer1kCharactersCents: number
}

export type ElevenlabsTtsRateEstimate = RateEstimateBase<'elevenlabs', ElevenlabsTtsModel> & {
  costPer1kCharactersCents: number
  sampleCostFor1kCharactersCents: number
}

export type ElevenlabsSttRateEstimate = RateEstimateBase<'elevenlabs', ElevenlabsSttModel> & {
  costPerHourCents: number
  costPerMinuteCents: number
}

export type VideoCostEstimate = CostEstimateBase<VideoProvider> & {
  durationSeconds: number
  billedDurationSeconds: number
  costPerSecond: number
}

export type MusicCostEstimate = ProviderModelBase<MusicProvider> & {
  totalCost: number
  lyricsSource: 'provided' | 'generated' | 'none'
  note?: string
}

export type EstimateMusicCostOptions = {
  elevenlabsMusicModel?: string | undefined
  minimaxMusicModel?: string | undefined
  musicDuration?: number | undefined
  musicLyricsFile?: string | undefined
  musicInstrumental?: boolean | undefined
}

export type EstimateVideoCostOptions = {
  geminiVideoModel?: string | undefined
  minimaxVideoModel?: string | undefined
  videoDuration?: number | undefined
  videoSize?: string | undefined
  videoResolution?: string | undefined
}

export type SttStepEstimate = CostEstimateBase & {
  step: 'stt'
  durationSeconds: number
}

export type LlmStepEstimate = ProviderModelBase & {
  step: 'llm'
  inputCostPer1MCents: number
  outputCostPer1MCents: number
  estimatedInputTokens?: number
  estimatedOutputTokens?: number
  totalCost: number
  costMultiplier?: number
}

export type TtsStepEstimate = ProviderModelBase & {
  step: 'tts'
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
  characterCount?: number
  totalCost: number
  costMultiplier?: number
}

export type ImageStepEstimate = CostEstimateBase<'gemini' | 'openai' | 'minimax'> & {
  step: 'image'
}

export type VideoStepEstimate = CostEstimateBase<VideoProvider> & {
  step: 'video'
}

export type MusicStepEstimate = ProviderModelBase<MusicProvider> & {
  step: 'music'
  totalCost: number
  costMultiplier?: number
  lyricsSource: 'provided' | 'generated' | 'none'
  note?: string
}

export type ExtractStepEstimate = ProviderModelBase<'mistral'> & {
  step: 'extract'
  costPer1kPagesCents: number
  pageCount?: number
  totalCost: number
  costMultiplier?: number
}

export type StepEstimate =
  | SttStepEstimate
  | ExtractStepEstimate
  | LlmStepEstimate
  | TtsStepEstimate
  | ImageStepEstimate
  | VideoStepEstimate
  | MusicStepEstimate

export type AggregatedPriceEstimate = {
  steps: StepEstimate[]
  totalEstimatedCost: number
  notes?: string[]
}
