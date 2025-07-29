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
  info?: boolean | string
  saveAudio?: boolean
  whisper?: boolean | string
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
  skip?: number
  order?: string
  last?: number
  date?: string[]
  lastDays?: number
  metaDir?: string
  metaSrcDir?: string
  metaDate?: string[]
  metaInfo?: boolean
  metaShownotes?: boolean
  keyMomentsCount?: number
  keyMomentDuration?: number
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
}

export interface ApiError {
  message: string
  stack?: string
  code?: string
  name?: string
  $metadata?: { httpStatusCode?: number }
}

export interface BlackForestLabsOptions {
  width?: number
  height?: number
  prompt_upsampling?: boolean
  seed?: number
  safety_tolerance?: number
  output_format?: string
}

export interface ImageGenerationResult {
  success: boolean
  path?: string
  error?: string
  details?: string
  taskId?: string
  imageUrl?: string
  seed?: number
  prompt_used?: string
}

export interface NovaCanvasPayload {
  taskType: string
  textToImageParams?: {
    text: string
    negativeText?: string
  }
  imageGenerationConfig?: {
    width: number
    height: number
    quality?: string
    cfgScale?: number
    seed?: number
    numberOfImages: number
  }
}