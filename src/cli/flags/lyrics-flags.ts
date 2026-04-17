import type { ClercFlagsDefinition } from 'clerc'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { SUPPORTED_WHISPER_MODELS } from '~/cli/commands/setup-and-utilities/models/stt-models'

export const lyricsFlags = {
  batch: {
    description: 'Process all supported audio files under ./input recursively',
    type: Boolean,
    default: false,
    negatable: false
  },
  audio: {
    description: 'Single-run audio file inside ./input',
    type: String
  },
  captions: {
    description: 'Optional VTT or SRT file inside ./output for rerendering without Whisper',
    type: String
  },
  model: {
    description: buildModelDescription('Local whisper.cpp model', SUPPORTED_WHISPER_MODELS),
    type: String,
    default: 'large-v3-turbo'
  },
  font: {
    description: 'Font family used for the rendered lyric captions (default: DejaVu Sans)',
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
