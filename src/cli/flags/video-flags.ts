import type { ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_GEMINI_VIDEO_MODELS,
  SUPPORTED_MINIMAX_VIDEO_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { priceFlag } from './shared-flags'

export const videoGenFlags = {
  'gemini-video': {
    description: buildModelDescription('Gemini Veo video model', SUPPORTED_GEMINI_VIDEO_MODELS),
    type: String
  },
  'minimax-video': {
    description: buildModelDescription('MiniMax video model', SUPPORTED_MINIMAX_VIDEO_MODELS),
    type: String
  },
  'video-duration': {
    description: 'Video duration in seconds',
    type: String
  },
  'video-size': {
    description: 'Video size',
    type: String
  },
  'video-aspect-ratio': {
    description: 'Video aspect ratio: 16:9|9:16 (Gemini)',
    type: String
  },
  'video-resolution': {
    description: 'Video resolution: 720p|1080p (Gemini)',
    type: String
  },
  ...priceFlag
} as const satisfies ClercFlagsDefinition
