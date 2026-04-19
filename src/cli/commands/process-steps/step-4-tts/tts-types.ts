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
