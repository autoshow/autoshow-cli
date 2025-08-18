export interface ApiError {
  message: string
  stack?: string
  code?: string
  name?: string
  $metadata?: { httpStatusCode?: number }
}

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

export type RunwayModel = 'gen4_image' | 'gen4_image_turbo'

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