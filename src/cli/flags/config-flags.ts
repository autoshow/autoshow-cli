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
  ['step-7-music', 'Step 7 - Music']
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
  },
  'max-usd': {
    description: 'Legacy budget limit in USD (converted to cents internally)',
    type: String
  }
} as const satisfies ClercFlagsDefinition

export const configCommandFlags = {
  ...withHelpGroup(configFlags, 'config'),
  ...withHelpGroup(pricingFlags, 'pricing'),
  ...withHelpGroup(batchFlags, 'step-1-download'),
  ...withHelpGroup(transcriptionFlags, 'step-2-stt'),
  ...withHelpGroup(extractFlags, 'step-2-ocr'),
  ...withHelpGroup(advancedExtractFlags, 'step-2-ocr'),
  ...withHelpGroup(llmProviderFlags, 'step-3-write'),
  ...withHelpGroup(promptFlag, 'step-3-write'),
  ...withHelpGroup(ttsFlags, 'step-4-tts'),
  ...withHelpGroup(imageGenFlags, 'step-5-image'),
  ...withHelpGroup(videoGenFlags, 'step-6-video'),
  ...withHelpGroup(musicGenFlags, 'step-7-music'),
  ...withHelpGroup(priceFlag, 'pricing')
} as const satisfies ClercFlagsDefinition
