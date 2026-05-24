import type { CliFlagsDefinition } from '~/cli/native'
import { SUPPORTED_WHISPER_MODELS } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { booleanAllProvidersFlag, generationOutputFlags, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { renameFlags, withHelpGroup } from './flag-utils'

export const MUSIC_COMMAND_SELECTOR_FLAGS = {
  'elevenlabs-music': 'elevenlabs',
  'minimax-music': 'minimax',
  'gemini-music': 'gemini'
} as const satisfies Record<string, string>

export const musicGenFlags = {
  'music-duration': {
    description: 'Music duration in seconds (ElevenLabs default: 180, MiniMax default: 120, Gemini default: 120)',
    type: String
  },
  'music-lyrics-file': {
    description: 'Lyrics file path (.md or .txt) for MiniMax and Gemini music generation',
    type: String
  },
  'music-instrumental': {
    description: 'Force instrumental generation for providers that support prompt/instrumental mode',
    type: Boolean,
    default: false,
    negatable: false
  },
} as const satisfies CliFlagsDefinition

const musicLyricVideoFlags = {
  'input-dir': {
    description: 'Input directory for lyric video audio files',
    type: String
  },
  batch: {
    description: 'Render lyric videos for all supported audio files under input recursively',
    type: Boolean,
    default: false,
    negatable: false
  },
  audio: {
    description: 'Single lyric-video audio file inside input',
    type: String
  },
  captions: {
    description: 'Optional VTT or SRT file inside ./output for rerendering without Whisper',
    type: String
  },
  model: {
    description: `Local whisper.cpp model for lyric-video captions: ${SUPPORTED_WHISPER_MODELS.join('|')} (default: large-v3-turbo)`,
    type: String,
    default: 'large-v3-turbo'
  },
  font: {
    description: 'Font family used for rendered lyric-video captions (default: DejaVu Sans)',
    type: String,
    default: 'DejaVu Sans'
  },
  'keep-tmp': {
    description: 'Keep the per-run .lyrics-tmp workspace in the output directory',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

const musicProviderSelectionFlags = {
  provider: {
    description: 'Music provider[=model]: elevenlabs|minimax|gemini; repeatable',
    type: [String] as [StringConstructor]
  },
  ...booleanAllProvidersFlag,
  ...sharedConcurrencyFlags
} as const satisfies CliFlagsDefinition

export const musicCommandFlags = {
  ...withHelpGroup(musicProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(renameFlags(musicGenFlags, {
    'music-duration': 'duration',
    'music-lyrics-file': 'lyrics-file',
    'music-instrumental': 'instrumental'
  }), 'hosted-music'),
  ...withHelpGroup(priceFlag, 'pricing'),
  ...withHelpGroup(generationOutputFlags, 'output'),
  ...withHelpGroup(musicLyricVideoFlags, 'lyric-video')
} as const satisfies CliFlagsDefinition
