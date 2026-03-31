import type { ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  SUPPORTED_MINIMAX_MUSIC_MODELS
} from '~/cli/commands/models/model-options'
import { buildModelDescription } from '~/cli/commands/models/model-validation'
import { priceFlag } from './shared-flags'

export const musicGenFlags = {
  'elevenlabs-music': {
    description: buildModelDescription('ElevenLabs music model', SUPPORTED_ELEVENLABS_MUSIC_MODELS),
    type: String
  },
  'minimax-music': {
    description: buildModelDescription('MiniMax music model', SUPPORTED_MINIMAX_MUSIC_MODELS),
    type: String
  },
  'music-duration': {
    description: 'Music duration in seconds',
    type: String
  },
  'music-lyrics-file': {
    description: 'Lyrics file path (.md or .txt) for MiniMax music generation',
    type: String
  },
  'music-instrumental': {
    description: 'Force instrumental generation (ElevenLabs prompt mode)',
    type: Boolean,
    default: false,
    negatable: false
  },
  ...priceFlag
} as const satisfies ClercFlagsDefinition
