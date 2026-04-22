import type { ClercFlagsDefinition } from 'clerc'
import { withHelpGroup } from './flag-utils'
import {
  transcriptionFlags,
  llmProviderFlags,
  extractFlags,
  advancedExtractFlags,
  batchFlags,
  promptFlag,
  priceFlag
} from './shared-flags'
import { ttsFlags } from './tts-flags'
import { imageGenFlags } from './image-flags'
import { musicGenFlags } from './music-flags'
import { videoGenFlags } from './video-flags'

export const CONFIG_COMMAND_HELP_FLAG_GROUPS = [
  ['config', 'Config'],
  ['pricing', 'Pricing'],
  ['step-1-download', 'Step 1 - Download'],
  ['step-2-stt', 'Step 2 - Transcribe'],
  ['step-2-ocr', 'Step 2 - OCR'],
  ['step-3-write', 'Step 3 - Write'],
  ['step-4-tts', 'Step 4 - Text to Speech'],
  ['step-5-image', 'Step 5 - Image'],
  ['step-6-video', 'Step 6 - Video'],
  ['step-7-music', 'Step 7 - Music'],
  ['step-8-lyrics', 'Step 8 - Lyrics']
] as const


const configFlags = {
  show: {
    description: 'Print the effective config and resolved path',
    type: Boolean,
    default: false,
    negatable: false
  },
  reset: {
    description: 'Clear the config file back to empty defaults',
    type: Boolean,
    default: false,
    negatable: false
  }
} as const satisfies ClercFlagsDefinition

const pricingFlags = {
  'max-cents': {
    description: 'Budget limit in cents — commands exceeding this fail unless --allow-over-budget is set',
    type: String
  }
} as const satisfies ClercFlagsDefinition

const omitFlags = (
  flags: ClercFlagsDefinition,
  omittedKeys: string[]
): ClercFlagsDefinition => Object.fromEntries(
  Object.entries(flags).filter(([name]) => !omittedKeys.includes(name))
)

const configTtsFlags = omitFlags(ttsFlags, ['all-tts'])
const configImageFlags = omitFlags(imageGenFlags, ['all-image'])
const configVideoFlags = omitFlags(videoGenFlags, ['all-video'])
const configMusicFlags = omitFlags(musicGenFlags, ['all-music'])

export const configCommandFlags = {
  ...withHelpGroup(configFlags, 'config'),
  ...withHelpGroup(pricingFlags, 'pricing'),
  ...withHelpGroup(batchFlags, 'step-1-download'),
  ...withHelpGroup(transcriptionFlags, 'step-2-stt'),
  ...withHelpGroup(extractFlags, 'step-2-ocr'),
  ...withHelpGroup(advancedExtractFlags, 'step-2-ocr'),
  ...withHelpGroup(llmProviderFlags, 'step-3-write'),
  ...withHelpGroup(promptFlag, 'step-3-write'),
  ...withHelpGroup(configTtsFlags, 'step-4-tts'),
  ...withHelpGroup(configImageFlags, 'step-5-image'),
  ...withHelpGroup(configVideoFlags, 'step-6-video'),
  ...withHelpGroup(configMusicFlags, 'step-7-music'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies ClercFlagsDefinition
