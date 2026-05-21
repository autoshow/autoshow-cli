import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { ElevenlabsMusicModel, GeminiMusicModel, MinimaxMusicModel } from '~/types'

export const SUPPORTED_ELEVENLABS_MUSIC_MODELS = [
  'music_v1'
] as const satisfies readonly string[]

export const validateElevenlabsMusicModel = createModelValidator<ElevenlabsMusicModel>(SUPPORTED_ELEVENLABS_MUSIC_MODELS, 'elevenlabs-music')

export const SUPPORTED_MINIMAX_MUSIC_MODELS = [
  'music-2.6',
  'music-2.6-free'
] as const satisfies readonly string[]

export const validateMinimaxMusicModel = createModelValidator<MinimaxMusicModel>(SUPPORTED_MINIMAX_MUSIC_MODELS, 'minimax-music')

export const MINIMAX_INSTRUMENTAL_MUSIC_MODELS = [
  'music-2.6',
  'music-2.6-free'
] as const satisfies readonly string[]

export const isMinimaxInstrumentalMusicModel = (
  model: string
): model is typeof MINIMAX_INSTRUMENTAL_MUSIC_MODELS[number] =>
  (MINIMAX_INSTRUMENTAL_MUSIC_MODELS as readonly string[]).includes(model)

export const SUPPORTED_GEMINI_MUSIC_MODELS = [
  'lyria-3-clip-preview',
  'lyria-3-pro-preview'
] as const satisfies readonly string[]

export const validateGeminiMusicModel = createModelValidator<GeminiMusicModel>(SUPPORTED_GEMINI_MUSIC_MODELS, 'gemini-music')
