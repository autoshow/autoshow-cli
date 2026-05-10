import type { ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  SUPPORTED_MINIMAX_MUSIC_MODELS,
  SUPPORTED_DEAPI_MUSIC_MODELS,
  SUPPORTED_GEMINI_MUSIC_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { SUPPORTED_WHISPER_MODELS } from '~/cli/commands/setup-and-utilities/models/stt-models'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { priceFlag } from './shared-flags'

export const musicGenFlags = {
  'all-music': {
    description: 'Enable every supported music provider/model for this command',
    type: Boolean,
    default: false,
    negatable: false
  },
  'music-provider-concurrency': {
    description: 'Music: max hosted providers/models running in parallel for one item (default 2; --all-music defaults up to 8)',
    type: String,
    default: '2'
  },
  'music-local-concurrency': {
    description: 'Music: max local providers running in parallel for one item (default 1)',
    type: String,
    default: '1'
  },
  'elevenlabs-music': {
    description: buildModelDescription('ElevenLabs music model', SUPPORTED_ELEVENLABS_MUSIC_MODELS),
    type: [String] as [StringConstructor]
  },
  'minimax-music': {
    description: buildModelDescription('MiniMax music model', SUPPORTED_MINIMAX_MUSIC_MODELS),
    type: [String] as [StringConstructor]
  },
  'deapi-music': {
    description: buildModelDescription('deAPI music model', SUPPORTED_DEAPI_MUSIC_MODELS),
    type: [String] as [StringConstructor]
  },
  'gemini-music': {
    description: buildModelDescription('Gemini Lyria music model', SUPPORTED_GEMINI_MUSIC_MODELS),
    type: [String] as [StringConstructor]
  },
  'music-duration': {
    description: 'Music duration in seconds',
    type: String
  },
  'music-lyrics-file': {
    description: 'Lyrics file path (.md or .txt) for MiniMax, deAPI, and Gemini music generation',
    type: String
  },
  'music-instrumental': {
    description: 'Force instrumental generation for providers that support prompt/instrumental mode',
    type: Boolean,
    default: false,
    negatable: false
  },
  ...priceFlag
} as const satisfies ClercFlagsDefinition

const musicLyricVideoFlags = {
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
    description: buildModelDescription('Local whisper.cpp model for lyric-video captions', SUPPORTED_WHISPER_MODELS),
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
} as const satisfies ClercFlagsDefinition

export const musicCommandFlags = {
  ...musicGenFlags,
  ...musicLyricVideoFlags
} as const satisfies ClercFlagsDefinition
