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
  model?: 'sd1.5' | 'sd3.5' | 'sd3-medium'
  width?: number
  height?: number
  steps?: number
  seed?: number
  cfgScale?: number
  negativePrompt?: string
  samplingMethod?: string
  lora?: boolean
  flashAttention?: boolean
  quantization?: 'f32' | 'f16' | 'q8_0' | 'q5_0' | 'q5_1' | 'q4_0' | 'q4_1'
  cpuOnly?: boolean
}

export interface RunwayImageOptions {
  model?: string
  width?: number
  height?: number
  style?: string
}