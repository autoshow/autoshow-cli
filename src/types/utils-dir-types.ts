export type {
  GroqModel,
  AnthropicModel,
  MinimaxModel,
  GlmModel,
  KimiModel,
  AwsSttModel,
  GcloudSttModel,
  DeepgramSttModel,
  DeepinfraSttModel,
  ElevenlabsSttModel,
  SonioxSttModel,
  SpeechmaticsSttModel,
  RevSttModel,
  GroqSttModel,
  GrokSttModel,
  MistralSttModel,
  AssemblyaiSttModel,
  GladiaSttModel,
  HappyscribeSttModel,
  SupadataSttModel,
  ScrapecreatorsSttModel,
  MistralOcrModel,
  GlmOcrModel,
  KimiOcrModel,
  OpenAIOcrModel,
  GrokOcrModel,
  AnthropicOcrModel,
  GeminiOcrModel,
  KittenTtsModel,
  ElevenlabsTtsModel,
  MinimaxTtsModel,
  GroqTtsModel,
  GrokTtsModel,
  MistralTtsModel,
  OpenAITtsModel,
  GeminiTtsModel,
  DeepgramTtsModel,
  ElevenlabsMusicModel,
  MinimaxMusicModel,
  GeminiMusicModel,
  GeminiImageModel,
  OpenAIImageModel,
  GrokImageModel,
  BflImageModel,
  ReveImageModel,
  GeminiVideoModel,
  MinimaxVideoModel,
  GlmVideoModel,
  GrokVideoModel,
  RunwayVideoModel,
} from '~/cli/commands/setup-and-utilities/setup-and-utilities-types'

export type ScanBlocksOptions = {
  max?: number
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
