import type { Dirent } from 'node:fs'
import type * as v from 'valibot'
import type {
  CharacterSketchCommandOptions,
  ComicPanelSelection,
  DraftScenesCommandOptions,
  GenerateImagesCommandOptions,
} from './comic-command-types'

export type Awaitable<T> = T | Promise<T>

export type CommandContextRecord = Record<string, unknown>

export type RawArgsCommandDefinition = {
  name: string
  description: string
  flags: Record<string, never>
  parameters: readonly ['[args...]']
  ignore: () => boolean
  run: (rawArgs: string[]) => Promise<void>
  handler: (context: unknown) => Promise<void>
}

export type ImageProvider = 'openai' | 'gemini'

export type OpenAiImageRequestTarget = {
  provider: 'openai'
  model: OpenAiImageGenerationModel
}

export type GeminiImageRequestTarget = {
  provider: 'gemini'
  model: GeminiImageGenerationModel
}

export type ImageRequestTarget = OpenAiImageRequestTarget | GeminiImageRequestTarget

export type ImageServiceRunners = {
  openAi: (
    normalizedPrompt: string,
    referenceImages: string[],
    model: OpenAiImageGenerationModel,
    size: ImageGenerationSize,
    quality: ImageGenerationQuality
  ) => Promise<GeneratedImageResponse>
  gemini: (
    normalizedPrompt: string,
    referenceImages: string[],
    model: GeminiImageGenerationModel,
    size: ImageGenerationSize
  ) => Promise<GeneratedImageResponse>
}

export type ImageGenerationSize =
  | (typeof import('../image-services/image-types').IMAGE_GENERATION_SIZES)[number]
  | `${number}x${number}`

export type ImageGenerationQuality = (typeof import('../image-services/image-types').IMAGE_GENERATION_QUALITIES)[number]

export type ConcreteImageSize = Exclude<ImageGenerationSize, 'auto'>

export type ConcreteImageQuality = Exclude<ImageGenerationQuality, 'auto'>

export type ImageUsage = {
  input_tokens: number
  input_tokens_details?: {
    text_tokens?: number
    image_tokens?: number
  } | null
  output_tokens: number
  output_tokens_details?: {
    text_tokens?: number
    image_tokens?: number
  } | null
  total_tokens: number
}

export type NormalizedImageResult = {
  imageBase64: string
  mimeType?: string
  usage?: ImageUsage
  providerSizeLabel?: string
  providerQualityLabel?: string
}

export type TokenBreakdown = {
  textTokens: number
  imageTokens: number
  unattributedTokens: number
}

export type GeneratedImageResponse = {
  mode: 'edit' | 'generate'
  inputFidelity?: 'high' | 'low'
  result: NormalizedImageResult
}

export type ImageRunStats = {
  imagesGenerated: number
  imagesSkipped: number
  totalInputTokens: number
  totalInputTextTokens: number
  totalInputImageTokens: number
  totalInputUnattributedTokens: number
  totalOutputTokens: number
  totalOutputTextTokens: number
  totalOutputImageTokens: number
  totalOutputUnattributedTokens: number
  totalCost: number
  totalDurationMs: number
}

export type GeminiLlmModel = (typeof import('../models/gemini-models').GEMINI_LLM_MODELS)[number]

export type GeminiImageGenerationModel = (typeof import('../models/gemini-models').GEMINI_IMAGE_MODELS)[number]

export type GeminiTokenPricing = {
  input: number
  cachedInput: number
  output: number
}

export type GeminiTieredTokenPricing = {
  standard: GeminiTokenPricing
  largePrompt?: GeminiTokenPricing
}

export type GeminiImagePricing = {
  input: number
  textOutput: number
  imageOutput: number
  estimated1KImage: number
}

export type GeminiLlmUsageLike = {
  input_tokens: number
  input_tokens_details?: { cached_tokens?: number } | null
  output_tokens: number
}

export type GeminiImageUsageLike = {
  input_tokens: number
  output_tokens: number
  output_tokens_details?: { text_tokens?: number; image_tokens?: number } | null
}

export type GeminiImageConfig = {
  aspectRatio: '3:2' | '1:1' | '2:3'
  imageSize: '1K'
}

export type CliImageSize = '1536x1024' | '1024x1024' | '1024x1536' | 'auto'

export type LlmModel = OpenAiLlmModel | GeminiLlmModel

export type ImageGenerationModel = OpenAiImageGenerationModel | GeminiImageGenerationModel

export type OpenAiImageGenerationModel = (typeof import('../models/openai-models').OPENAI_IMAGE_MODELS)[number]

export type OpenAiLlmModel = (typeof import('../models/openai-models').OPENAI_LLM_MODELS)[number]

export type ImageEditInputFidelity = 'high' | 'low'

export type TokenPricing = {
  input: number
  cachedInput: number
  output: number
}

export type PerImageOutputPricing = {
  low: Record<'1024x1024' | '1024x1536' | '1536x1024', number>
  medium: Record<'1024x1024' | '1024x1536' | '1536x1024', number>
  high: Record<'1024x1024' | '1024x1536' | '1536x1024', number>
}

export type ImageModelPricing = {
  textTokens: TokenPricing
  imageTokens: TokenPricing
  perImageOutput: PerImageOutputPricing
}

export type CliCommandHandlers = {
  characterSketch: (options: CharacterSketchCommandOptions) => Awaitable<void>
  draftScenes: (options: DraftScenesCommandOptions) => Awaitable<void>
  generateImages: (options: GenerateImagesCommandOptions) => Awaitable<void>
}

export type CliPriceHandlers = {
  characterSketch: (options: CharacterSketchCommandOptions) => Awaitable<void>
  draftScenes: (options: DraftScenesCommandOptions) => Awaitable<void>
  generateImages: (options: GenerateImagesCommandOptions) => Awaitable<void>
}

export type CreateCliDeps = {
  commandHandlers?: Partial<CliCommandHandlers>
  priceHandlers?: Partial<CliPriceHandlers>
  printHelp?: (text: string) => void
}

export type CreatedCli = {
  commandDefinitions: RawArgsCommandDefinition[]
  clerc: unknown | null
  run: (argv?: string[]) => Promise<void>
}

export type ChainableClerc = Record<string, unknown>

export type ChainMethod = (...args: unknown[]) => unknown

export type CliFlagName =
  | 'image'
  | 'llm-model'
  | 'only'
  | 'target'
  | 'panel'
  | 'chunk'
  | 'sketch-group-size'
  | 'sketch-panels'
  | 'panels'
  | 'panel-limit'
  | 'panels-per-image'
  | 'image-model'
  | 'size'
  | 'quality'
  | 'force'
  | 'revise'
  | 'notes'
  | 'price'
  | 'help'

export type CliFlagMetadata = {
  name: CliFlagName
  aliases?: readonly string[]
  valueName?: string
  commands: readonly string[]
}

export type CharacterFileNumber = keyof typeof import('../schemas/schemas').CHARACTER_FILES

export type CharacterFilePath = (typeof import('../schemas/schemas').CHARACTER_FILES)[CharacterFileNumber]

export type CharacterName = (typeof import('../schemas/schemas').CHARACTER_NAMES)[number]

export type StructuredScriptBeatType = (typeof import('../schemas/schemas').STRUCTURED_SCRIPT_BEAT_TYPES)[number]

export type PromptsConfig = v.InferOutput<typeof import('../schemas/schemas').PromptsConfigSchema>

export type StructuredScriptData = v.InferOutput<typeof import('../schemas/schemas').StructuredScriptDataSchema>

export type StructuredScriptSourceSegment = StructuredScriptData['sourceSegments'][number]

export type ScenePromptData = v.InferOutput<typeof import('../schemas/schemas').ScenePromptDataSchema>

export type ParsedGenerateBaseArgs = {
  showHelp: boolean
  price?: boolean
  scriptPath?: string
  panel?: number
  panels?: ComicPanelSelection
  panelLimit?: number
  panelsPerImage?: number
  chunk?: number
  target?: NonNullable<GenerateImagesCommandOptions['target']>
  llmModel?: ParsedLlmModel
  sketchGroupSize?: NonNullable<GenerateImagesCommandOptions['sketchGroupSize']>
  sketchPanels?: NonNullable<GenerateImagesCommandOptions['sketchPanels']>
  imageModels?: ParsedImageModel[]
  size?: ParsedImageSize
  quality?: ParsedImageQuality
  force?: boolean
}

export type ParsedImageSize = NonNullable<GenerateImagesCommandOptions['size']>

export type ParsedImageQuality = NonNullable<GenerateImagesCommandOptions['quality']>

export type ParsedImageModel = NonNullable<GenerateImagesCommandOptions['imageModels']>[number]

export type ParsedLlmModel = NonNullable<DraftScenesCommandOptions['llmModel']>

export type ParsedDraftCommandArgs = {
  scriptPath?: string
  llmModel?: ParsedLlmModel
  only?: NonNullable<DraftScenesCommandOptions['only']>
  showHelp: boolean
  price?: boolean
}

export type ExpandedScenePromptData = v.InferOutput<typeof import('../schemas/schemas').ExpandedScenePromptDataSchema>

export type ResolvedReferenceImages = {
  all: string[]
  primaryCharacterRefs: string[]
  sketchCharacterRefs: string[]
  canonicalCharacterRefs: string[]
  priorPanelRefs: string[]
  secondaryRefs: string[]
  missingPrimaryCharacterRefs: string[]
}

export type PrimaryCharacterReferenceState = Pick<
  ResolvedReferenceImages,
  'primaryCharacterRefs' | 'sketchCharacterRefs' | 'canonicalCharacterRefs' | 'missingPrimaryCharacterRefs'
>

export type CharacterReferenceState = {
  key: string
  sketchRefs: string[]
  canonicalRef?: string
  missingPrimaryCharacterRefs: string[]
}

export type PriorPanelReference = {
  model?: string
  panelNumber: number
  path: string
}

export type ResolveReferenceImagesOptions = {
  includePriorPanelRefs?: boolean
  includeSecondaryRefs?: boolean
}

export type PanelPrimaryReferenceInput = {
  panelDirectory: string
  entries: Dirent[]
  bundleData: ExpandedScenePromptData
}

export type ModelRow = { modelLabel: string; pricePerImage: number | null; subtotal: number | null }
