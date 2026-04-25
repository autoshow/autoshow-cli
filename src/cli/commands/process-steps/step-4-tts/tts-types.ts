import type {
  CostEstimateBase,
  ElevenlabsTtsModel,
  ProcessingOptions,
  ProviderTargetBase,
  RateEstimateBase,
  Step4Metadata,
  TtsProvider
} from '~/types'

export type TtsOptions = Pick<
  ProcessingOptions,
  | 'ttsSpeaker'
  | 'kittenTtsModels'
  | 'kittenTtsModel'
  | 'elevenlabsTtsModels'
  | 'elevenlabsTtsModel'
  | 'elevenlabsVoiceId'
  | 'deepgramTtsModels'
  | 'deepgramTtsModel'
  | 'deepgramVoiceId'
  | 'minimaxTtsModels'
  | 'minimaxTtsModel'
  | 'minimaxTtsVoice'
  | 'groqTtsModels'
  | 'groqTtsModel'
  | 'groqVoiceId'
  | 'openaiTtsModels'
  | 'openaiTtsModel'
  | 'openaiVoiceId'
  | 'geminiTtsModels'
  | 'geminiTtsModel'
  | 'geminiVoiceId'
  | 'geminiSpeaker1Name'
  | 'geminiSpeaker1Voice'
  | 'geminiSpeaker2Name'
  | 'geminiSpeaker2Voice'
>

export type TtsTarget = ProviderTargetBase<TtsProvider> & {
  voice?: string
  run: (text: string, outputDir: string, opts: TtsOptions) => Promise<{ audioPath: string, metadata: Step4Metadata }>
}

export type FinalizeTtsRunOptions = {
  service: TtsProvider
  model: string
  speaker?: string | undefined
  audioPath: string
  chunkCount: number
  startTime: number
}

export type TtsConfigField = {
  label: string
  value: string | number | undefined
}

export type GeminiInlineAudioInfo = {
  ext: string
  isRawPcm: boolean
  sampleRate: number
}

export type GeminiTtsSelectionOptions = {
  geminiTtsModels?: string[] | undefined
  geminiTtsModel?: string | undefined
  geminiVoiceId?: string | undefined
  geminiSpeaker1Name?: string | undefined
  geminiSpeaker1Voice?: string | undefined
  geminiSpeaker2Name?: string | undefined
  geminiSpeaker2Voice?: string | undefined
}

export type GeminiMultiSpeakerConfig = {
  speaker1Name: string
  speaker1Voice: string
  speaker2Name: string
  speaker2Voice: string
}

export type TtsRateEstimate = RateEstimateBase<TtsProvider> & {
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
}

export type TtsCostEstimate = CostEstimateBase<TtsProvider> & {
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
  characterCount: number
}

export type ElevenlabsTtsCostEstimate = CostEstimateBase<'elevenlabs', ElevenlabsTtsModel> & {
  characterCount: number
  costPer1kCharactersCents: number
}

export type ElevenlabsTtsRateEstimate = RateEstimateBase<'elevenlabs', ElevenlabsTtsModel> & {
  costPer1kCharactersCents: number
  sampleCostFor1kCharactersCents: number
}
