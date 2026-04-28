import type { ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_GEMINI_VIDEO_MODELS,
  SUPPORTED_DEAPI_VIDEO_MODELS,
  SUPPORTED_GLM_VIDEO_MODELS,
  SUPPORTED_GROK_VIDEO_MODELS,
  SUPPORTED_MINIMAX_VIDEO_MODELS,
  SUPPORTED_RUNWAY_VIDEO_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { priceFlag } from './shared-flags'

export const videoGenFlags = {
  'all-video': {
    description: 'Enable every supported video provider/model for this command',
    type: Boolean,
    default: false,
    negatable: false
  },
  'gemini-video': {
    description: buildModelDescription('Gemini Veo video model', SUPPORTED_GEMINI_VIDEO_MODELS),
    type: [String] as [StringConstructor]
  },
  'minimax-video': {
    description: buildModelDescription('MiniMax video model', SUPPORTED_MINIMAX_VIDEO_MODELS),
    type: [String] as [StringConstructor]
  },
  'glm-video': {
    description: buildModelDescription('GLM video model', SUPPORTED_GLM_VIDEO_MODELS),
    type: [String] as [StringConstructor]
  },
  'grok-video': {
    description: buildModelDescription('Grok video model', SUPPORTED_GROK_VIDEO_MODELS),
    type: [String] as [StringConstructor]
  },
  'runway-video': {
    description: buildModelDescription('Runway video model', SUPPORTED_RUNWAY_VIDEO_MODELS),
    type: [String] as [StringConstructor]
  },
  'deapi-video': {
    description: buildModelDescription('deAPI video model', SUPPORTED_DEAPI_VIDEO_MODELS),
    type: [String] as [StringConstructor]
  },
  'video-duration': {
    description: 'Video duration in seconds',
    type: String
  },
  'video-size': {
    description: 'Video size, provider dependent; deAPI expects WIDTHxHEIGHT within model limits',
    type: String
  },
  'video-aspect-ratio': {
    description: 'Video aspect ratio, provider dependent',
    type: String
  },
  'video-resolution': {
    description: 'Video resolution: 720p|1080p (Gemini)',
    type: String
  },
  ...priceFlag
} as const satisfies ClercFlagsDefinition
