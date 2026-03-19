import type { ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_SORA_VIDEO_MODELS,
  SUPPORTED_GEMINI_VIDEO_MODELS,
  SUPPORTED_MINIMAX_VIDEO_MODELS
} from '~/cli/commands/models/model-options'
import { priceFlag } from './shared-flags'

const SORA_VIDEO_MODELS_DESCRIPTION = `OpenAI Sora video model: ${SUPPORTED_SORA_VIDEO_MODELS.join('|')}`
const GEMINI_VIDEO_MODELS_DESCRIPTION = `Gemini Veo video model: ${SUPPORTED_GEMINI_VIDEO_MODELS.join('|')}`
const MINIMAX_VIDEO_MODELS_DESCRIPTION = `MiniMax video model: ${SUPPORTED_MINIMAX_VIDEO_MODELS.join('|')}`

export const videoGenFlags = {
  'sora-video': {
    description: SORA_VIDEO_MODELS_DESCRIPTION,
    type: String
  },
  'gemini-video': {
    description: GEMINI_VIDEO_MODELS_DESCRIPTION,
    type: String
  },
  'minimax-video': {
    description: MINIMAX_VIDEO_MODELS_DESCRIPTION,
    type: String
  },
  'video-duration': {
    description: 'Video duration in seconds',
    type: String
  },
  'video-size': {
    description: 'Video size: 720x1280|1280x720|1024x1792|1792x1024 (Sora)',
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
