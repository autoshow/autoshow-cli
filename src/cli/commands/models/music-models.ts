import { createModelValidator } from '~/cli/commands/models/model-validation'
import type { ElevenlabsMusicModel, MinimaxMusicModel } from '~/types'
export type { ElevenlabsMusicModel, MinimaxMusicModel } from '~/types'

export const SUPPORTED_ELEVENLABS_MUSIC_MODELS = [
  'music_v1'
] as const satisfies readonly string[]

export const validateElevenlabsMusicModel = createModelValidator<ElevenlabsMusicModel>(SUPPORTED_ELEVENLABS_MUSIC_MODELS, 'elevenlabs-music')

export const SUPPORTED_MINIMAX_MUSIC_MODELS = [
  'music-2.5'
] as const satisfies readonly string[]

export const validateMinimaxMusicModel = createModelValidator<MinimaxMusicModel>(SUPPORTED_MINIMAX_MUSIC_MODELS, 'minimax-music')
