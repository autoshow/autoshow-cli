import type { CliFlagsDefinition } from '~/cli/native'
import { booleanAllProvidersFlag, generationOutputFlags, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { pickFlags, renameFlags, withHelpGroup } from './flag-utils'

export const VIDEO_COMMAND_SELECTOR_FLAGS = {
  'gemini-video': 'gemini',
  'minimax-video': 'minimax',
  'glm-video': 'glm',
  'grok-video': 'grok',
  'runway-video': 'runway'
} as const satisfies Record<string, string>

export const videoGenFlags = {
  'video-mode': {
    description: 'Video generation mode: text|image-to-video|reference-to-video|interpolate|extend|edit (default: text)',
    type: String
  },
  'video-duration': {
    description: 'Video duration in seconds: 4|6|8 (Gemini Veo), 6|10 (MiniMax Hailuo), 5|10 (GLM), 1-15 (Grok), 2-10 (Runway)',
    type: String
  },
  'video-size': {
    description: 'Video size: 1280x720|720x1280|1024x1024|1920x1080|1080x1920|2048x1080 (GLM CogVideoX), 720x480|1280x720 (GLM Vidu2); other providers use --video-resolution or --video-aspect-ratio',
    type: String
  },
  'video-aspect-ratio': {
    description: 'Video aspect ratio: 16:9|9:16|1:1|4:3|3:4 (GLM/MiniMax), 1:1|16:9|9:16|4:3|3:4|3:2|2:3 (Grok), 1280:720|720:1280 (Runway); Gemini uses --video-resolution',
    type: String
  },
  'video-resolution': {
    description: 'Video resolution: 720p|1080p|4k (Gemini; 4k requires Veo 3.1 standard/Fast), 720p|1080p (MiniMax Hailuo), 480p|720p (Grok)',
    type: String
  },
  'video-input-image': {
    description: 'Video input image path, URL, or data URL for image-to-video and interpolation first frame',
    type: String
  },
  'video-last-frame': {
    description: 'Video last-frame image path, URL, or data URL for interpolation',
    type: String
  },
  'video-reference-image': {
    description: 'Reference image path, URL, or data URL for reference-to-video; repeat up to 3 times',
    type: [String] as [StringConstructor]
  },
  'video-input-video': {
    description: 'Input MP4 path, URL, or data URL for video extension or editing',
    type: String
  },
  'grok-video-storage-filename': {
    description: 'Grok video storage filename for generated file output',
    type: String
  },
  'grok-video-storage-expires-after': {
    description: 'Grok video storage expiration in seconds (max 2592000)',
    type: String
  },
} as const satisfies CliFlagsDefinition

const videoCommandOptionNames = {
  'video-mode': 'mode',
  'video-duration': 'duration',
  'video-size': 'size',
  'video-aspect-ratio': 'aspect-ratio',
  'video-resolution': 'resolution',
  'video-input-image': 'input-image',
  'video-last-frame': 'last-frame',
  'video-reference-image': 'reference-image',
  'video-input-video': 'input-video'
} as const satisfies Record<string, string>

const videoProviderSelectionFlags = {
  provider: {
    description: 'Video provider[=model]: gemini|minimax|glm|grok|runway; repeatable',
    type: [String] as [StringConstructor]
  },
  ...booleanAllProvidersFlag,
  ...sharedConcurrencyFlags
} as const satisfies CliFlagsDefinition

const videoGenerationOptionNames = [
  'video-mode',
  'video-duration',
  'video-size',
  'video-aspect-ratio',
  'video-resolution'
] as const

const videoInputOptionNames = [
  'video-input-image',
  'video-last-frame',
  'video-reference-image',
  'video-input-video'
] as const

const grokStorageOptionNames = [
  'grok-video-storage-filename',
  'grok-video-storage-expires-after'
] as const

export const videoCommandFlags = {
  ...withHelpGroup(videoProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(renameFlags(pickFlags(videoGenFlags, videoGenerationOptionNames), videoCommandOptionNames), 'video-options'),
  ...withHelpGroup(renameFlags(pickFlags(videoGenFlags, videoInputOptionNames), videoCommandOptionNames), 'video-inputs'),
  ...withHelpGroup(renameFlags(pickFlags(videoGenFlags, grokStorageOptionNames), videoCommandOptionNames), 'grok-storage'),
  ...withHelpGroup(priceFlag, 'pricing'),
  ...withHelpGroup(generationOutputFlags, 'output')
} as const satisfies CliFlagsDefinition
