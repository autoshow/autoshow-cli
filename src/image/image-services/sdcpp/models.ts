import type { ModelConfig } from '@/image/image-types'

export const MODELS_DIR = 'build/models/sd'
export const BIN_PATH = 'build/bin/sd'

export const MODEL_HASHES: Record<string, ModelConfig> = {
  'v1-5-pruned-emaonly.safetensors': { 
    minSizeMB: 1600, 
    maxSizeMB: 2000 
  },
  'sd3_medium_incl_clips_t5xxlfp16.safetensors': { 
    minSizeMB: 5400, 
    maxSizeMB: 5600 
  },
  'sd3.5_large.safetensors': { 
    minSizeMB: 6500, 
    maxSizeMB: 7000 
  },
  'clip_l.safetensors': { 
    minSizeMB: 230, 
    maxSizeMB: 250 
  },
  'clip_g.safetensors': { 
    minSizeMB: 690, 
    maxSizeMB: 710 
  },
  't5xxl_fp16.safetensors': { 
    minSizeMB: 9000, 
    maxSizeMB: 9400 
  }
}

export function getDownloadUrl(filename: string): string {
  const urls: Record<string, string> = {
    'sd3_medium_incl_clips_t5xxlfp16.safetensors': 'https://huggingface.co/stabilityai/stable-diffusion-3-medium (requires access approval)',
    'sd3.5_large.safetensors': 'https://huggingface.co/stabilityai/stable-diffusion-3.5-large (requires access approval)',
    'clip_l.safetensors': 'https://huggingface.co/comfyanonymous/flux_text_encoders',
    'clip_g.safetensors': 'https://huggingface.co/Comfy-Org/stable-diffusion-3.5-fp8',
    't5xxl_fp16.safetensors': 'https://huggingface.co/comfyanonymous/flux_text_encoders',
    'v1-5-pruned-emaonly.safetensors': 'https://huggingface.co/runwayml/stable-diffusion-v1-5'
  }
  return urls[filename] || 'Unknown source'
}

export const ModelTypes = {
  SD15: 'sd1.5',
  SD3_MEDIUM: 'sd3-medium',
  SD35: 'sd3.5'
} as const

export type ModelType = typeof ModelTypes[keyof typeof ModelTypes]

export function getModelRequirements(modelType: ModelType): string[] {
  switch (modelType) {
    case ModelTypes.SD3_MEDIUM:
    case ModelTypes.SD35:
      return ['sd3_medium_incl_clips_t5xxlfp16.safetensors']
    case ModelTypes.SD15:
    default:
      return ['v1-5-pruned-emaonly.safetensors']
  }
}

export function getModelDescription(modelType: ModelType): string {
  switch (modelType) {
    case ModelTypes.SD3_MEDIUM:
      return 'Stable Diffusion 3 Medium'
    case ModelTypes.SD35:
      return 'Stable Diffusion 3.5'
    case ModelTypes.SD15:
    default:
      return 'Stable Diffusion 1.5'
  }
}