import type { ProcessingOptions, Step4Metadata, TtsProvider } from '~/types'

export type TtsOptions = Pick<
  ProcessingOptions,
  | 'ttsSpeaker'
  | 'kittenTtsModels'
  | 'kittenTtsModel'
  | 'elevenlabsTtsModels'
  | 'elevenlabsTtsModel'
  | 'elevenlabsVoiceId'
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

export type TtsTarget = {
  service: TtsProvider
  model: string
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
