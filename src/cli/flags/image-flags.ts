import type { ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_GEMINI_IMAGE_MODELS,
  SUPPORTED_DEAPI_IMAGE_MODELS,
  SUPPORTED_GLM_IMAGE_MODELS,
  SUPPORTED_GROK_IMAGE_MODELS,
  SUPPORTED_MINIMAX_IMAGE_MODELS,
  SUPPORTED_OPENAI_IMAGE_MODELS,
  SUPPORTED_RUNWAY_IMAGE_MODELS,
  SUPPORTED_BFL_IMAGE_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { priceFlag } from './shared-flags'

export const imageGenFlags = {
  'all-image': {
    description: 'Enable every supported image provider/model for this command',
    type: Boolean,
    default: false,
    negatable: false
  },
  'gemini-image': {
    description: buildModelDescription('Gemini image model', SUPPORTED_GEMINI_IMAGE_MODELS),
    type: [String] as [StringConstructor]
  },
  'openai-image': {
    description: buildModelDescription('OpenAI image model', SUPPORTED_OPENAI_IMAGE_MODELS),
    type: [String] as [StringConstructor]
  },
  'minimax-image': {
    description: buildModelDescription('MiniMax image model', SUPPORTED_MINIMAX_IMAGE_MODELS),
    type: [String] as [StringConstructor]
  },
  'glm-image': {
    description: buildModelDescription('Z.AI GLM image model', SUPPORTED_GLM_IMAGE_MODELS),
    type: [String] as [StringConstructor]
  },
  'grok-image': {
    description: buildModelDescription('xAI Grok image model', SUPPORTED_GROK_IMAGE_MODELS),
    type: [String] as [StringConstructor]
  },
  'runway-image': {
    description: buildModelDescription('Runway image model', SUPPORTED_RUNWAY_IMAGE_MODELS),
    type: [String] as [StringConstructor]
  },
  'bfl-image': {
    description: buildModelDescription('BFL image model', SUPPORTED_BFL_IMAGE_MODELS),
    type: [String] as [StringConstructor]
  },
  'deapi-image': {
    description: buildModelDescription('deAPI image model', SUPPORTED_DEAPI_IMAGE_MODELS),
    type: [String] as [StringConstructor]
  },
  'image-aspect-ratio': {
    description: 'Image aspect ratio: 1:1|16:9|9:16|4:3|3:4|3:2|2:3|2:1|1:2|19.5:9|9:19.5|20:9|9:20|auto (provider-specific support)',
    type: String
  },
  'image-size': {
    description: 'Image size/resolution: 1K|2K|4K (Gemini), 1024x1024|1536x1024|1024x1536 (OpenAI), 512x512 through 2048x2048 multiples of 32 (GLM), 1K|2K (Grok), 720p|1080p (Runway), WIDTHxHEIGHT for BFL, or WIDTHxHEIGHT within deAPI model limits',
    type: String
  },
  'image-quality': {
    description: 'Image quality: low|medium|high|auto (OpenAI, default: auto)',
    type: String
  },
  'image-format': {
    description: 'Image output format: png|jpeg|webp (OpenAI default: png; BFL default: jpeg)',
    type: String
  },
  'image-background': {
    description: 'Image background: transparent|opaque|auto (OpenAI, default: auto)',
    type: String
  },
  'imagen-count': {
    description: 'Number of images to generate 1-4 (Imagen 4, default: 1)',
    type: String
  },
  ...priceFlag
} as const satisfies ClercFlagsDefinition
