export type {
  GroqModel,
  AnthropicModel,
  MinimaxModel,
  GlmModel,
  AwsSttModel,
  DeapiSttModel,
  DeapiTtsModel,
  DeapiOcrModel,
  DeapiMusicModel,
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
  MistralOcrModel,
  GlmOcrModel,
  OpenAIOcrModel,
  AnthropicOcrModel,
  GeminiOcrModel,
  KittenTtsModel,
  ElevenlabsTtsModel,
  MinimaxTtsModel,
  GroqTtsModel,
  GrokTtsModel,
  OpenAITtsModel,
  GeminiTtsModel,
  DeepgramTtsModel,
  ElevenlabsMusicModel,
  MinimaxMusicModel,
  GeminiImageModel,
  OpenAIImageModel,
  MinimaxImageModel,
  GlmImageModel,
  GrokImageModel,
  RunwayImageModel,
  BflImageModel,
  DeapiImageModel,
  GeminiVideoModel,
  MinimaxVideoModel,
  GlmVideoModel,
  GrokVideoModel,
  RunwayVideoModel,
  DeapiVideoModel
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
