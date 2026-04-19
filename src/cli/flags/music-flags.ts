import type { ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  SUPPORTED_MINIMAX_MUSIC_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { priceFlag } from './shared-flags'

export const musicGenFlags = {
  'elevenlabs-music': {
    description: buildModelDescription('ElevenLabs music model', SUPPORTED_ELEVENLABS_MUSIC_MODELS),
    type: [String] as [StringConstructor]
  },
  'minimax-music': {
    description: buildModelDescription('MiniMax music model', SUPPORTED_MINIMAX_MUSIC_MODELS),
    type: [String] as [StringConstructor]
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
