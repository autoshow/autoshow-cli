import type { CliFlagsDefinition } from '~/cli/native'
import {
  SUPPORTED_GEMINI_IMAGE_MODELS,
  SUPPORTED_DEAPI_IMAGE_MODELS,
  SUPPORTED_GROK_IMAGE_MODELS,
  SUPPORTED_MINIMAX_IMAGE_MODELS,
  SUPPORTED_OPENAI_IMAGE_MODELS,
  SUPPORTED_RUNWAY_IMAGE_MODELS,
  SUPPORTED_BFL_IMAGE_MODELS,
  SUPPORTED_REVE_IMAGE_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { generationOutputFlags, priceFlag } from './shared-flags'
import { aliasFlags } from './flag-utils'

export const IMAGE_COMMAND_SELECTOR_FLAGS = {
  'gemini-image': 'gemini',
  'openai-image': 'openai',
  'minimax-image': 'minimax',
  'grok-image': 'grok',
  'runway-image': 'runway',
  'bfl-image': 'bfl',
  'deapi-image': 'deapi',
  'reve-image': 'reve'
} as const satisfies Record<string, string>

export const imageGenFlags = {
  'all-image': {
    description: 'Enable every supported image provider/model for this command',
    type: Boolean,
    default: false,
    negatable: false
  },
  'image-provider-concurrency': {
    description: 'Image: max hosted providers/models running in parallel for one item (default 2; --all-image defaults up to 8)',
    type: String,
    default: '2'
  },
  'image-local-concurrency': {
    description: 'Image: max local providers running in parallel for one item (default 1)',
    type: String,
    default: '1'
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
  'reve-image': {
    description: buildModelDescription('Reve image model', SUPPORTED_REVE_IMAGE_MODELS),
    type: [String] as [StringConstructor]
  },
  'image-aspect-ratio': {
    description: 'Image aspect ratio: 1:1|16:9|9:16|4:3|3:4|3:2|2:3|2:1|1:2|19.5:9|9:19.5|20:9|9:20|auto (provider-specific support)',
    type: String
  },
  'image-size': {
    description: 'Image size/resolution: 1K|2K|4K (Gemini), auto|1024x1024|1536x1024|1024x1536 or flexible WIDTHxHEIGHT for OpenAI gpt-image-2, WIDTHxHEIGHT multiples of 8 (MiniMax when no aspect ratio), 1K|2K (Grok), 720p|1080p (Runway), WIDTHxHEIGHT for BFL/Reve fit-within resizing, or WIDTHxHEIGHT within deAPI model limits',
    type: String
  },
  'image-quality': {
    description: 'Image quality: low|medium|high|auto (OpenAI, default: auto)',
    type: String
  },
  'image-format': {
    description: 'Image output format: png|jpeg|webp (OpenAI/Reve default: png; BFL default: jpeg)',
    type: String
  },
  'image-background': {
    description: 'Image background: transparent|opaque|auto (OpenAI, default: auto)',
    type: String
  },
  'image-count': {
    description: 'Number of images to generate in one provider request where supported (OpenAI/Grok 1-10, MiniMax 1-9, Gemini Imagen 1-4; default: 1)',
    type: String
  },
  'image-input': {
    description: 'Reference/source image path or URL for edit/reference workflows (repeatable; OpenAI, Grok, Gemini native, MiniMax, BFL, Reve)',
    type: [String] as [StringConstructor]
  },
  'image-mask': {
    description: 'Mask image path for inpainting/edit workflows (OpenAI only)',
    type: String
  },
  'image-response-mode': {
    description: 'Gemini native response mode: image|text-image (default: image)',
    type: String
  },
  'gemini-person-generation': {
    description: 'Gemini Imagen person generation: dont_allow|allow_adult|allow_all',
    type: String
  },
  'gemini-search-grounding': {
    description: 'Enable Gemini native image generation with Google Search grounding metadata',
    type: Boolean,
    default: false,
    negatable: false
  },
  'image-compression': {
    description: 'OpenAI output compression for jpeg/webp images, 0-100',
    type: String
  },
  ...priceFlag
} as const satisfies CliFlagsDefinition

export const imageCommandFlags = {
  ...aliasFlags(imageGenFlags, IMAGE_COMMAND_SELECTOR_FLAGS),
  ...generationOutputFlags
} as const satisfies CliFlagsDefinition
