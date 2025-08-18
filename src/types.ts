import { LLM_SERVICES_CONFIG } from './text/process-steps/04-run-llm/llm-models'

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
export interface StableDiffusionCppOptions {
  model?: 'sd1.5' | 'sd3.5' | 'flux-kontext' | 'sd3-medium'
  width?: number
  height?: number
  steps?: number
  seed?: number
  cfgScale?: number
  negativePrompt?: string
  samplingMethod?: string
  lora?: boolean
  referenceImage?: string
  flashAttention?: boolean
  quantization?: 'f32' | 'f16' | 'q8_0' | 'q5_0' | 'q5_1' | 'q4_0' | 'q4_1'
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

export type ModelKey = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'gemini-2.0-flash' | 'gemini-2.0-flash-lite'

export type ExtractService = 'zerox' | 'unpdf' | 'textract'

export interface ExtractOptions {
  output?: string
  pageBreaks?: boolean
  model?: string
  service?: ExtractService
}

export interface SinglePageExtractResult {
  text: string
  pageNumber: number
  cost?: number
}

export interface ExtractResult {
  success: boolean
  outputPath?: string
  totalCost?: number
  error?: string
  details?: string
}

export interface BatchExtractResult {
  success: boolean
  filesProcessed?: number
  totalCost?: number
  error?: string
  failedFiles?: string[]
}

export type ChatGPTModelValue = (typeof LLM_SERVICES_CONFIG.chatgpt.models)[number]['modelId']
export type ClaudeModelValue = (typeof LLM_SERVICES_CONFIG.claude.models)[number]['modelId']
export type GeminiModelValue = (typeof LLM_SERVICES_CONFIG.gemini.models)[number]['modelId']

export type TtsEngine = 'elevenlabs' | 'coqui' | 'polly' | 'kitten'

export type VeoModel = 'veo-3.0-generate-preview' | 'veo-3.0-fast-generate-preview' | 'veo-2.0-generate-001'

export interface VeoGenerateConfig {
  aspectRatio?: '16:9' | '9:16'
  negativePrompt?: string
  personGeneration?: 'allow_all' | 'allow_adult' | 'dont_allow'
}

export interface VeoGenerateOptions extends VeoGenerateConfig {
  model?: VeoModel
  image?: string
  outputPath?: string
}

export interface VideoGenerationResult {
  success: boolean
  path?: string
  error?: string
  details?: string
  operationName?: string
  duration?: number
}

export enum MusicScale {
  C_MAJOR_A_MINOR = 'C_MAJOR_A_MINOR',
  D_FLAT_MAJOR_B_FLAT_MINOR = 'D_FLAT_MAJOR_B_FLAT_MINOR',
  D_MAJOR_B_MINOR = 'D_MAJOR_B_MINOR',
  E_FLAT_MAJOR_C_MINOR = 'E_FLAT_MAJOR_C_MINOR',
  E_MAJOR_D_FLAT_MINOR = 'E_MAJOR_D_FLAT_MINOR',
  F_MAJOR_D_MINOR = 'F_MAJOR_D_MINOR',
  G_FLAT_MAJOR_E_FLAT_MINOR = 'G_FLAT_MAJOR_E_FLAT_MINOR',
  G_MAJOR_E_MINOR = 'G_MAJOR_E_MINOR',
  A_FLAT_MAJOR_F_MINOR = 'A_FLAT_MAJOR_F_MINOR',
  A_MAJOR_G_FLAT_MINOR = 'A_MAJOR_G_FLAT_MINOR',
  B_FLAT_MAJOR_G_MINOR = 'B_FLAT_MAJOR_G_MINOR',
  B_MAJOR_A_FLAT_MINOR = 'B_MAJOR_A_FLAT_MINOR',
  SCALE_UNSPECIFIED = 'SCALE_UNSPECIFIED'
}

export enum MusicGenerationMode {
  QUALITY = 'QUALITY',
  DIVERSITY = 'DIVERSITY',
  VOCALIZATION = 'VOCALIZATION'
}

export interface WeightedPrompt {
  text: string
  weight: number
}

export interface MusicGenerationConfig {
  guidance?: number
  bpm?: number
  density?: number
  brightness?: number
  scale?: MusicScale
  muteBass?: boolean
  muteDrums?: boolean
  onlyBassAndDrums?: boolean
  musicGenerationMode?: MusicGenerationMode
  temperature?: number
  topK?: number
  seed?: number
}

export interface MusicGenerationOptions {
  prompts?: WeightedPrompt[]
  config?: MusicGenerationConfig
  outputPath?: string
  duration?: number
}

export interface MusicGenerationResult {
  success: boolean
  path?: string
  error?: string
  details?: string
  sessionId?: string
  duration?: number
}

export type MusicService = 'lyria' | 'sagemaker'

export type SageMakerMusicGenModel = 'musicgen-small' | 'musicgen-medium' | 'musicgen-large'

export interface SageMakerMusicConfig {
  endpointName?: string
  model?: SageMakerMusicGenModel
  s3BucketName?: string
  guidance?: number
  maxNewTokens?: number
  doSample?: boolean
  temperature?: number
}

export interface SageMakerAsyncInferenceResult {
  OutputLocation: string
  ResponseMetadata?: {
    RequestId: string
    HTTPStatusCode: number
  }
}