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
