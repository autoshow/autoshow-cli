import type { ProcessingOptions, Step4Metadata, TtsProvider } from '~/types'

export type TtsOptions = Pick<
  ProcessingOptions,
  | 'ttsSpeaker'
  | 'kittenTtsModel'
  | 'elevenlabsTtsModel'
  | 'elevenlabsVoiceId'
  | 'minimaxTtsModel'
  | 'minimaxTtsVoice'
  | 'groqTtsModel'
  | 'groqVoiceId'
  | 'openaiTtsModel'
  | 'openaiVoiceId'
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
