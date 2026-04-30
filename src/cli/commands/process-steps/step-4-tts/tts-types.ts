import type {
  CostEstimateBase,
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
  | 'elevenlabsTtsPvcVoice'
  | 'elevenlabsTtsRefAudio'
  | 'elevenlabsTtsVoiceName'
  | 'elevenlabsTtsCloneRemoveBackgroundNoise'
  | 'elevenlabsTtsPvcSamples'
  | 'elevenlabsTtsPvcSampleDir'
  | 'elevenlabsTtsPvcLanguage'
  | 'elevenlabsTtsPvcDescription'
  | 'elevenlabsTtsPvcCaptchaOut'
  | 'elevenlabsTtsPvcVerifyAudio'
  | 'elevenlabsTtsPvcWait'
  | 'deepgramTtsModels'
  | 'deepgramTtsModel'
  | 'deepgramVoiceId'
  | 'runwayTtsModels'
  | 'runwayTtsModel'
  | 'runwayTtsVoice'
  | 'minimaxTtsModels'
  | 'minimaxTtsModel'
  | 'minimaxTtsVoice'
  | 'minimaxTtsRefAudio'
  | 'minimaxTtsPromptAudio'
  | 'minimaxTtsPromptText'
  | 'minimaxTtsCloneNoiseReduction'
  | 'minimaxTtsCloneVolumeNormalization'
  | 'groqTtsModels'
  | 'groqTtsModel'
  | 'groqVoiceId'
  | 'grokTtsModels'
  | 'grokTtsModel'
  | 'grokTtsVoice'
  | 'mistralTtsModels'
  | 'mistralTtsModel'
  | 'mistralTtsVoice'
  | 'mistralTtsRefAudio'
  | 'openaiTtsModels'
  | 'openaiTtsModel'
  | 'openaiVoiceId'
  | 'openaiTtsRefAudio'
  | 'openaiTtsConsentId'
  | 'openaiTtsConsentAudio'
  | 'openaiTtsConsentLanguage'
  | 'openaiTtsConsentName'
  | 'openaiTtsVoiceName'
  | 'geminiTtsModels'
  | 'geminiTtsModel'
  | 'geminiVoiceId'
  | 'geminiSpeaker1Name'
  | 'geminiSpeaker1Voice'
  | 'geminiSpeaker2Name'
  | 'geminiSpeaker2Voice'
  | 'deapiTtsModels'
  | 'deapiTtsModel'
  | 'deapiTtsVoice'
  | 'deapiTtsRefAudio'
  | 'deapiTtsRefText'
>

export type TtsTarget = ProviderTargetBase<TtsProvider> & {
  voice?: string
  setupCostCents?: number | undefined
  setupTimeMs?: number | undefined
  setupNote?: string | undefined
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
  setupCostCents?: number | undefined
  setupTimeMs?: number | undefined
  setupNote?: string | undefined
}
