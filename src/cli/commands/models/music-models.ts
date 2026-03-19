import { CLIUsageError } from '~/utils/error-handler'
import type { ElevenlabsMusicModel, MinimaxMusicModel } from '~/types'
export type { ElevenlabsMusicModel, MinimaxMusicModel } from '~/types'

const formatAllowedValues = (values: readonly string[]): string => values.join(', ')

export const SUPPORTED_ELEVENLABS_MUSIC_MODELS = [
  'music_v1'
] as const satisfies readonly string[]

export const validateElevenlabsMusicModel = (model: string): ElevenlabsMusicModel => {
  if (!SUPPORTED_ELEVENLABS_MUSIC_MODELS.includes(model as ElevenlabsMusicModel)) {
    throw CLIUsageError(
      `Invalid --elevenlabs-music model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_ELEVENLABS_MUSIC_MODELS)}`
    )
  }
  return model as ElevenlabsMusicModel
}

export const SUPPORTED_MINIMAX_MUSIC_MODELS = [
  'music-2.5'
] as const satisfies readonly string[]

export const validateMinimaxMusicModel = (model: string): MinimaxMusicModel => {
  if (!SUPPORTED_MINIMAX_MUSIC_MODELS.includes(model as MinimaxMusicModel)) {
    throw CLIUsageError(
      `Invalid --minimax-music model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_MINIMAX_MUSIC_MODELS)}`
    )
  }
  return model as MinimaxMusicModel
}
