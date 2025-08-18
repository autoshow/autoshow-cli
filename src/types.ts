import { LLM_SERVICES_CONFIG } from './text/llms/llm-models'

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
  whisperCoreml?: boolean | string
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
  save?: 's3' | 'r2'
  s3BucketPrefix?: string
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
export interface VectorizeVector {
  id: string
  values: number[]
  metadata?: Record<string, any>
}
export interface VectorizeMatch {
  id: string
  score: number
  metadata?: Record<string, any>
}
export interface EmbeddingOptions {
  create?: boolean | string
  query?: string
}
export interface UploadMetadata {
  metadata: ShowNoteMetadata
  transcriptionService?: string
  transcriptionModel?: string
  transcriptionCostCents: number
  audioDuration: number
  llmService?: string
  llmModel?: string
  llmCostCents: number
  promptSections: string[]
  transcript: string
  llmOutput: string
}
export interface ConfigureOptions {
  service?: 's3' | 'r2' | 'all'
  reset?: boolean
  test?: boolean
  [key: string]: any
}
export interface ServiceConfigurationStatus {
  configured: boolean
  tested: boolean
  working: boolean
  settings: Record<string, string>
  issues: string[]
}
export interface CredentialValidationResult {
  valid: boolean
  error?: string
  details?: Record<string, any>
}
export interface EnvVariable {
  key: string
  value: string
  description?: string
}
export interface R2Token {
  accessKeyId: string
  secretAccessKey: string
  expiresAt: number
}

export interface FileData {
  path: string
  content: string
}

export interface ConfigStatus {
  service: string
  configured: boolean
  tested: boolean
  issues: string[]
  details: Record<string, string>
}

export interface S3ConfigResult {
  configured: boolean
  tested: boolean
  issues: string[]
  details: Record<string, string>
}

export interface CloudflareApiToken {
  value: string
  id: string
  name: string
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

export interface VectorizeIndexConfig {
  name: string
  description: string
  config: {
    dimensions: number
    metric: string
  }
}

export interface VectorizeIndexInfo {
  name: string
  description: string
  config: {
    dimensions: number
    metric: string
  }
  created_on: string
  modified_on: string
}

export interface VoiceSettings {
  stability: number
  similarity_boost: number
  style: number
  use_speaker_boost: boolean
}

export interface MediaFileOptions {
  input: string
  output?: string
  verbose?: boolean
}

export interface MediaDownloadOptions {
  urls: string
  verbose?: boolean
}

export interface MediaConvertOptions {
  files: string
  output?: string
  verbose?: boolean
}

export type ChatGPTModelValue = (typeof LLM_SERVICES_CONFIG.chatgpt.models)[number]['modelId']
export type ClaudeModelValue = (typeof LLM_SERVICES_CONFIG.claude.models)[number]['modelId']
export type GeminiModelValue = (typeof LLM_SERVICES_CONFIG.gemini.models)[number]['modelId']

export type TtsEngine = 'elevenlabs' | 'coqui' | 'polly' | 'kitten'