import { LLM_SERVICES_CONFIG } from './process-steps/04-run-llm/llm-models'

export type ShowNoteMetadata = {
  showLink?: string
  channel?: string
  channelURL?: string
  title: string
  description?: string
  publishDate: string
  coverImage?: string
  walletAddress?: string
  mnemonic?: string
}
export type ProcessingOptions = {
  video?: string
  playlist?: string
  channel?: string
  urls?: string
  file?: string
  rss?: string | string[]
  item?: string[]
  info?: boolean | string
  saveAudio?: boolean
  whisper?: boolean | string
  whisperCoreml?: boolean | string
  whisperDiarization?: boolean | string
  deepgram?: boolean | string
  assembly?: boolean | string
  groqWhisper?: boolean | string
  speakerLabels?: boolean
  transcriptCost?: string
  llmCost?: string
  chatgpt?: string
  claude?: string
  gemini?: string
  prompt?: string[]
  printPrompt?: string[]
  customPrompt?: string
  llmServices?: string
  transcriptServices?: string
  order?: string
  last?: number
  date?: string[]
  days?: number
  feed?: string
  metaDate?: string[]
  metaInfo?: boolean
  keyMomentsCount?: number
  keyMomentDuration?: number
  inputDir?: string
  outputDir?: string
  [key: string]: any
}
export interface VideoInfo {
  uploadDate: string
  url: string
  date: Date
  timestamp: number
  isLive: boolean
}
export interface TranscriptionResult {
  transcript: string
  modelId: string
  costPerMinuteCents: number
  audioDuration?: number
}

export interface DeepgramWord {
  word: string
  start: number
  end: number
  confidence: number
  speaker?: number
  speaker_confidence?: number
}

export interface WhisperTranscriptItem {
  text: string
  timestamps: {
    from: string
    to: string
  }
}

export interface WhisperJsonData {
  transcription: WhisperTranscriptItem[]
}

export interface TranscriptChunk {
  timestamp: string
  text: string
}

export type ChatGPTModelValue = (typeof LLM_SERVICES_CONFIG.chatgpt.models)[number]['modelId']
export type ClaudeModelValue = (typeof LLM_SERVICES_CONFIG.claude.models)[number]['modelId']
export type GeminiModelValue = (typeof LLM_SERVICES_CONFIG.gemini.models)[number]['modelId']