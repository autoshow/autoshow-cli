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

export interface RunwayImageOptions {
  model?: string
  width?: number
  height?: number
  style?: string
}

export type ChatGPTImageModel = 'gpt-image-1' | 'gpt-image-1.5' | 'gpt-image-1-mini'