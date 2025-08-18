export interface MusicGenerationOptions {
  model?: string
  duration?: number
  temperature?: number
  topK?: number
  topP?: number
  cfgCoef?: number
  useSampling?: boolean
  twoStepCfg?: boolean
  extendStride?: number
  melodyPath?: string
  continuationPath?: string
  steps?: number
  cfgScale?: number
  sigmaMin?: number
  sigmaMax?: number
  samplerType?: string
  seed?: number
  batchSize?: number
}

export interface MusicGenerationResult {
  success: boolean
  path?: string
  error?: string
}

export type MusicService = 'audiocraft' | 'stable-audio'

export type MusicModel = 
  | 'facebook/musicgen-small'
  | 'facebook/musicgen-medium'
  | 'facebook/musicgen-large'
  | 'facebook/musicgen-melody'
  | 'facebook/musicgen-melody-large'
  | 'facebook/musicgen-stereo-small'
  | 'facebook/musicgen-stereo-medium'
  | 'facebook/musicgen-stereo-large'
  | 'facebook/musicgen-stereo-melody'
  | 'facebook/musicgen-stereo-melody-large'
  | 'stabilityai/stable-audio-open-1.0'