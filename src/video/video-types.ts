export interface ApiError {
  message: string
  stack?: string
  code?: string
  name?: string
  $metadata?: { httpStatusCode?: number }
}

export type VeoModel = 'veo-3.1-generate-preview' | 'veo-3.1-fast-generate-preview'

export type VeoResolution = '720p' | '1080p' | '4k'

export interface VeoGenerateConfig {
  aspectRatio?: '16:9' | '9:16'
  resolution?: VeoResolution
  negativePrompt?: string
  personGeneration?: 'allow_all' | 'allow_adult' | 'dont_allow'
}

export interface VeoGenerateOptions extends VeoGenerateConfig {
  model?: VeoModel
  image?: string
  referenceImages?: string[]
  outputPath?: string
}

export interface VeoApiOperation {
  name: string
  done: boolean
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{
        video?: {
          uri?: string
        }
      }>
    }
  }
  error?: {
    message: string
    code: number
  }
}

export type RunwayModel = 'gen4_turbo' | 'gen3a_turbo'

export interface RunwayGenerateOptions {
  model?: RunwayModel
  image?: string
  outputPath?: string
  aspectRatio?: '16:9' | '9:16'
  duration?: 5 | 10
}

export interface VideoGenerationResult {
  success: boolean
  path?: string
  error?: string
  details?: string
  operationName?: string
  duration?: number
}