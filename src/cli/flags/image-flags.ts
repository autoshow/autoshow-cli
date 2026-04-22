import type { ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_GEMINI_IMAGE_MODELS,
  SUPPORTED_MINIMAX_IMAGE_MODELS,
  SUPPORTED_OPENAI_IMAGE_MODELS
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
  'image-aspect-ratio': {
    description: 'Image aspect ratio: 1:1|16:9|9:16|4:3|3:4 (Gemini)',
    type: String
  },
  'image-size': {
    description: 'Image size: 1K|2K|4K (Gemini) or 1024x1024|1536x1024|1024x1536 (OpenAI)',
    type: String
  },
  'image-quality': {
    description: 'Image quality: low|medium|high|auto (OpenAI, default: auto)',
    type: String
  },
  'image-format': {
    description: 'Image output format: png|jpeg|webp (OpenAI, default: png)',
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
