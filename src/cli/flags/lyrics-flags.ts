import type { ClercFlagsDefinition } from 'clerc'
import { withHelpGroup } from './flag-utils'
import { llmProviderFlags, priceFlag, promptFlag } from './shared-flags'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { SUPPORTED_WHISPER_MODELS } from '~/cli/commands/setup-and-utilities/models/stt-models'

const lyricsRenderFlags = {
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

const lyricsGenerationFlags = {
  'prompt-file': {
    description: 'Generation mode: prepend prompt instructions from a local text file instead of the album prompt.md',
    type: String
  },
  'track-list': {
    description: 'Generation mode: optional tracks.md file used to prepend track-number headers on saved lyric drafts',
    type: String
  }
} as const satisfies ClercFlagsDefinition

export const lyricsFlags = {
  ...withHelpGroup(lyricsRenderFlags, 'step-8-lyrics'),
  ...withHelpGroup(llmProviderFlags, 'step-3-write'),
  ...withHelpGroup(promptFlag, 'step-3-write'),
  ...withHelpGroup(lyricsGenerationFlags, 'step-3-write'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies ClercFlagsDefinition
