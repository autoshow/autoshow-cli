export interface ApiError {
  message: string
  stack?: string
  code?: string
  name?: string
  $metadata?: { httpStatusCode?: number }
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