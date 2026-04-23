import type { MusicProvider, TtsProvider, VideoProvider } from '~/types/provider-types'
import type {
  ElevenlabsSttModel,
  ElevenlabsTtsModel
} from '~/cli/commands/setup-and-utilities/setup-and-utilities-types'

export type {
  GroqModel,
  AnthropicModel,
  MinimaxModel,
  AwsSttModel,
  DeapiSttModel,
  GcloudSttModel,
  DeepgramSttModel,
  DeepinfraSttModel,
  ElevenlabsSttModel,
  SonioxSttModel,
  SpeechmaticsSttModel,
  RevSttModel,
  GroqSttModel,
  MistralSttModel,
  AssemblyaiSttModel,
  GladiaSttModel,
  HappyscribeSttModel,
  SupadataSttModel,
  MistralOcrModel,
  GlmOcrModel,
  OpenAIOcrModel,
  AnthropicOcrModel,
  GeminiOcrModel,
  KittenTtsModel,
  ElevenlabsTtsModel,
  MinimaxTtsModel,
  GroqTtsModel,
  OpenAITtsModel,
  GeminiTtsModel,
  ElevenlabsMusicModel,
  MinimaxMusicModel,
  GeminiImageModel,
  OpenAIImageModel,
  MinimaxImageModel,
  GeminiVideoModel,
  MinimaxVideoModel
} from '~/cli/commands/setup-and-utilities/setup-and-utilities-types'

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
  geminiImageModels?: string[] | undefined
  geminiImageModel?: string | undefined
  openaiImageModels?: string[] | undefined
  openaiImageModel?: string | undefined
  minimaxImageModels?: string[] | undefined
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
  elevenlabsMusicModels?: string[] | undefined
  elevenlabsMusicModel?: string | undefined
  minimaxMusicModels?: string[] | undefined
  minimaxMusicModel?: string | undefined
  musicDuration?: number | undefined
  musicLyricsFile?: string | undefined
  musicInstrumental?: boolean | undefined
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

export type SttStepEstimate = CostEstimateBase & {
  step: 'stt'
  durationSeconds: number
  estimateType?: 'heuristic' | 'exact'
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

export type ExtractStepEstimate = ProviderModelBase<'tesseract' | 'ocrmypdf' | 'paddle-ocr' | 'mistral' | 'glm' | 'openai' | 'anthropic' | 'gemini' | 'firecrawl'> & {
  step: 'extract'
  costPer1kPagesCents?: number
  inputCostPer1MCents?: number
  outputCostPer1MCents?: number
  pageCount?: number
  promptTokens?: number
  completionTokens?: number
  totalCost: number
  costMultiplier?: number
  estimateType?: 'heuristic' | 'exact'
  note?: string
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
