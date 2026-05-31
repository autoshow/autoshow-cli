import type { CliFlagsDefinition } from '~/cli/native'
import { booleanAllProvidersFlag, generationOutputFlags, priceFlag, sharedConcurrencyFlags } from './shared-flags'
import { pickFlags, renameFlags, withHelpGroup } from './flag-utils'

export const IMAGE_COMMAND_SELECTOR_FLAGS = {
  'gemini-image': 'gemini',
  'openai-image': 'openai',
  'grok-image': 'grok',
  'bfl-image': 'bfl',
  'reve-image': 'reve'
} as const satisfies Record<string, string>

export const imageGenFlags = {
  'image-aspect-ratio': {
    description: 'Image aspect ratio: 1:1|16:9|9:16|4:3|3:4|3:2|2:3|2:1|1:2|19.5:9|9:19.5|20:9|9:20|auto (provider-specific support)',
    type: String
  },
  'image-size': {
    description: 'Image size/resolution: 1K|2K|4K (Gemini), auto|1024x1024|1536x1024|1024x1536 or flexible WIDTHxHEIGHT for OpenAI gpt-image-2, 1K|2K (Grok), or WIDTHxHEIGHT for BFL/Reve fit-within resizing',
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
    description: 'Number of images to generate in one provider request where supported (OpenAI/Grok 1-10; default: 1)',
    type: String
  },
  'image-input': {
    description: 'Reference/source image path or URL for edit/reference workflows (repeatable; OpenAI, Grok, Gemini native, BFL, Reve)',
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
  'image-search-grounding': {
    description: 'Enable Gemini native image generation with Google Search grounding metadata',
    type: Boolean,
    default: false,
    negatable: false
  },
  'image-compression': {
    description: 'OpenAI output compression for jpeg/webp images, 0-100',
    type: String
  },
  'gemini-search-grounding': {
    description: 'Enable Gemini native image generation with Google Search grounding metadata',
    type: Boolean,
    default: false,
    negatable: false,
    help: { hidden: true }
  },
} as const satisfies CliFlagsDefinition

const imageCommandOptionNames = {
  'image-aspect-ratio': 'aspect-ratio',
  'image-size': 'size',
  'image-quality': 'quality',
  'image-format': 'format',
  'image-background': 'background',
  'image-count': 'count',
  'image-input': 'input',
  'image-mask': 'mask',
  'image-response-mode': 'response-mode',
  'image-search-grounding': 'search-grounding',
  'image-compression': 'compression'
} as const satisfies Record<string, string>

const imageProviderSelectionFlags = {
  provider: {
    description: 'Image provider[=model]: gemini|openai|grok|bfl|reve; repeatable',
    type: [String] as [StringConstructor]
  },
  ...booleanAllProvidersFlag,
  ...sharedConcurrencyFlags
} as const satisfies CliFlagsDefinition

const imageGenerationOptionNames = [
  'image-aspect-ratio',
  'image-size',
  'image-quality',
  'image-format',
  'image-background',
  'image-count'
] as const

const imageInputOptionNames = [
  'image-input',
  'image-mask'
] as const

const imageProviderSpecificOptionNames = [
  'image-response-mode',
  'image-search-grounding',
  'image-compression'
] as const

export const imageCommandFlags = {
  ...withHelpGroup(imageProviderSelectionFlags, 'provider-selection'),
  ...withHelpGroup(renameFlags(pickFlags(imageGenFlags, imageGenerationOptionNames), imageCommandOptionNames), 'image-options'),
  ...withHelpGroup(renameFlags(pickFlags(imageGenFlags, imageInputOptionNames), imageCommandOptionNames), 'image-inputs'),
  ...withHelpGroup(renameFlags(pickFlags(imageGenFlags, imageProviderSpecificOptionNames), imageCommandOptionNames), 'image-provider-options'),
  ...withHelpGroup(priceFlag, 'pricing'),
  ...withHelpGroup(generationOutputFlags, 'output')
} as const satisfies CliFlagsDefinition
