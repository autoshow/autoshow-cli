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

export type RunwayModel = 'gen4_image' | 'gen4_image_turbo'

export interface RunwayGenerateOptions {
  model?: RunwayModel
  image?: string
  outputPath?: string
  aspectRatio?: '16:9' | '9:16'
  duration?: 5 | 10
}

export type HunyuanModel = 'hunyuan-720p' | 'hunyuan-540p' | 'hunyuan-fp8'

export interface HunyuanGenerateOptions {
  model?: HunyuanModel
  outputPath?: string
  resolution?: { width: number; height: number }
  aspectRatio?: '16:9' | '9:16' | '4:3' | '3:4' | '1:1'
  numFrames?: number
  guidanceScale?: number
  flowShift?: number
  negativePrompt?: string
  numInferenceSteps?: number
  seed?: number
  useFp8?: boolean
  useCpuOffload?: boolean
  image?: string
}

export interface HunyuanConfig {
  python: string
  venv: string
  models_dir: string
  default_model: string
  available_models: Record<string, string>
  resolutions: {
    '720p': Record<string, [number, number]>
    '540p': Record<string, [number, number]>
  }
}

export type CogVideoModel = 'cogvideo-2b' | 'cogvideo-5b' | 'cogvideo-5b-i2v'

export interface CogVideoGenerateOptions {
  model?: CogVideoModel
  outputPath?: string
  numFrames?: number
  guidanceScale?: number
  negativePrompt?: string
  numInferenceSteps?: number
  seed?: number
  image?: string
}

export interface CogVideoConfig {
  python: string
  venv: string
  models_dir: string
  default_model: string
  available_models: Record<string, string>
}

export interface VideoGenerationResult {
  success: boolean
  path?: string
  error?: string
  details?: string
  operationName?: string
  duration?: number
}