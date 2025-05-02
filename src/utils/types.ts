// shared/types.ts

export interface ShowNote {
  id?: number
  showLink?: string
  channel?: string
  channelURL?: string
  title: string
  description?: string
  publishDate: string
  coverImage?: string
  frontmatter?: string
  prompt?: string
  transcript?: string
  llmOutput?: string
  walletAddress?: string
  mnemonic?: string
  llmService?: string
  llmModel?: string
  llmCost?: number
  transcriptionService?: string
  transcriptionModel?: string
  transcriptionCost?: number
  finalCost?: number
  content?: string
}

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
  info?: boolean
  saveAudio?: boolean
  whisper?: boolean | string
  deepgram?: boolean | string
  assembly?: boolean | string
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
  skip?: number
  order?: string
  last?: number
  date?: string[]
  lastDays?: number
  openaiApiKey?: string
  anthropicApiKey?: string
  geminiApiKey?: string
  deepgramApiKey?: string
  assemblyApiKey?: string
  [key: string]: any
}

export type WhisperOutput = {
  systeminfo: string
  model: {
    type: string
    multilingual: boolean
    vocab: number
    audio: {
      ctx: number
      state: number
      head: number
      layer: number
    }
    text: {
      ctx: number
      state: number
      head: number
      layer: number
    }
    mels: number
    ftype: number
  }
  params: {
    model: string
    language: string
    translate: boolean
  }
  result: {
    language: string
  }
  transcription: Array<{
    timestamps: {
      from: string
      to: string
    }
    offsets: {
      from: number
      to: number
    }
    text: string
  }>
}

export type HandlerFunction = (options: ProcessingOptions, input: string, llmServices?: string, transcriptServices?: string) => Promise<void>

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
}

export type LLMUsage = {
  stopReason: string
  input?: number
  output?: number
  total?: number
}

export type LLMResult = {
  content: string
  usage?: LLMUsage
}