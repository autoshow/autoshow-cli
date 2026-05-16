import type { Dirent } from 'node:fs'
import type {
  Awaitable,
  CharacterName,
  ExpandedScenePromptData,
  GeneratedImageResponse,
  ImageGenerationModel,
  ImageGenerationQuality,
  ImageGenerationSize,
  LlmModel,
  PromptsConfig,
  StructuredScriptData,
} from './comic-types'

export type DefineCharacterSketchCommandDeps = {
  command?: (options: CharacterSketchCommandOptions) => Awaitable<void>
  estimatePrice?: (options: CharacterSketchCommandOptions) => Awaitable<void>
  printHelp?: (text: string) => void
}

export type CharacterSketchCommandOptions = {
  image?: string
  imageModels?: ImageGenerationModel[]
  size?: ImageGenerationSize
  quality?: ImageGenerationQuality
  force?: boolean
  revise?: boolean
  notes?: string
}

export type ParsedCharacterSketchArgs = CharacterSketchCommandOptions & { showHelp: boolean; price?: boolean }

export type DraftPromptsCommandOptions = {
  sceneSlug: string
}

export type DefineDraftScenesCommandDeps = {
  command?: (options: DraftScenesCommandOptions) => Awaitable<void>
  estimatePrice?: (options: DraftScenesCommandOptions) => Awaitable<void>
  printHelp?: (text: string) => void
}

export type DraftScenesStage = 'structure' | 'prompt' | 'scene' | 'panel-prompts'

export type DraftScenesCommandOptions = {
  scriptPath: string
  sceneSlug: string
  llmModel?: LlmModel
  only?: DraftScenesStage
}

export type DraftSceneResponseUsage = {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  input_tokens_details?: { cached_tokens?: number } | null
  output_tokens_details?: { reasoning_tokens?: number } | null
}

export type GenerateSceneJsonOptions = {
  model: LlmModel
}

export type NormalizedSceneResponse = {
  model: string
  text: string
  usage?: DraftSceneResponseUsage
  requestId?: string
  status?: string
}

export type SceneResponseResult = {
  response: NormalizedSceneResponse
  usesStructuredOutputs: boolean
}

export type DraftSceneRunStats = {
  filesProcessed: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCachedTokens: number
  totalCost: number
  totalDurationMs: number
}

export type DefineGenerateImagesCommandDeps = {
  command?: (options: GenerateImagesCommandOptions) => Awaitable<void>
  estimatePrice?: (options: GenerateImagesCommandOptions) => Awaitable<void>
  printHelp?: (text: string) => void
}

export type GenerateImagesTarget = 'images' | 'sketches' | 'both'

export type ImagePromptVariation = 'canonical' | 'animation-polish' | 'cinematic-depth'

export type SketchPanelRange =
  | 'all'
  | {
    startPanelNumber: number
    endPanelNumber: number
  }

export type GenerateImagesCommandOptions = {
  scriptPath: string
  sceneSlug: string
  imageModels?: ImageGenerationModel[]
  size?: ImageGenerationSize
  quality?: ImageGenerationQuality
  force?: boolean
  target?: GenerateImagesTarget
  llmModel?: LlmModel
  panels?: ComicPanelSelection
  panelsPerImage?: number
  variations?: ImagePromptVariation[]
}

export type GeneratePanelImagesOptions = {
  models: ImageGenerationModel[]
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  force: boolean
  panels?: ComicPanelSelection
  variations?: ImagePromptVariation[]
}

export type ParsedGenerateImagesArgs = GenerateImagesCommandOptions & { showHelp: boolean; price?: boolean }

export type ComicPanelSelection = 'all' | number[]

export type GenerateComicPagesOptions = {
  models: ImageGenerationModel[]
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  force: boolean
  panels: ComicPanelSelection
  panelsPerImage: number
  variations?: ImagePromptVariation[]
}

export type ComicPagePanelSource = {
  panelDirectory: string
  panelEntries: Dirent[]
  panelNumber: number
  bundleData: ExpandedScenePromptData
}

export type ComicPageChunk<T> = {
  pageNumber: number
  panelNumbers: number[]
  panels: T[]
}

export type GenerateComicPagesDependencies = {
  requestImage?: (input: {
    normalizedPrompt: string
    referenceImages: string[]
    model: ImageGenerationModel
    size: ImageGenerationSize
    quality: ImageGenerationQuality
  }) => Promise<GeneratedImageResponse>
  writeImage?: (outputPath: string, imageBase64: string, mimeType?: string) => Promise<void>
}

export type ScenePanelCount = { panels: number; skipped: number }

export type SketchPanelSource = {
  panelDirectory: string
  panelEntries: Dirent[]
  panelNumber: number
  bundleData: ExpandedScenePromptData
}

export type SketchPanelChunk<T> = {
  startPanelNumber: number
  endPanelNumber: number
  panels: T[]
}

export type GenerateSceneSketchesOptions = {
  models: ImageGenerationModel[]
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  force: boolean
  sketchPanels?: SketchPanelRange
}

export type GenerateSceneSketchesDependencies = {
  requestImage?: (input: {
    normalizedPrompt: string
    referenceImages: string[]
    model: ImageGenerationModel
    size: ImageGenerationSize
    quality: ImageGenerationQuality
  }) => Promise<GeneratedImageResponse>
  writeImage?: (outputPath: string, imageBase64: string, mimeType?: string) => Promise<void>
}

export type GenerateSketchesCommandOptions = {
  sceneSlug: string
  imageModels?: ImageGenerationModel[]
  size?: GenerateSceneSketchesOptions['size']
  quality?: GenerateSceneSketchesOptions['quality']
  force?: boolean
  sketchPanels?: GenerateSceneSketchesOptions['sketchPanels']
}

export type SceneSketchCount = { label: string; sketches: number; skipped: number }

export type PanelPromptsCommandOptions = {
  sceneSlug: string
  force?: boolean
}

export type CharacterSketchView = (typeof import('../commands/process-scenes/character-utils').CHARACTER_SKETCH_VIEWS)[number]

export type CharacterDetails = {
  name: string
  image: string
  description: string
  sketchImages?: string[]
}

export type ScenePrompts = PromptsConfig['Scene Prompts']

export type StructureScriptsCommandOptions = {
  scriptPath: string
  sceneSlug: string
  llmModel?: LlmModel
}

export type CharacterMention = StructuredScriptData['beats'][number]['rawMentions'][number]

export type StructuredScriptBeat = StructuredScriptData['beats'][number]

export type GenerateStructuredScriptsOptions = {
  llmModel?: LlmModel
}

export type StructuredScriptResponseUsage = {
  input_tokens: number
  output_tokens: number
  total_tokens: number
  input_tokens_details?: { cached_tokens?: number } | null
  output_tokens_details?: { reasoning_tokens?: number } | null
}

export type StructuredScriptReviewResponse = {
  model: string
  text: string
  usage?: StructuredScriptResponseUsage
  requestId?: string
  status?: string
}

export type StructuredScriptReviewResult = {
  response: StructuredScriptReviewResponse
  usesStructuredOutputs: boolean
}

export type StructuredScriptRunStats = {
  filesProcessed: number
  llmReviews: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCachedTokens: number
  totalCost: number
  totalDurationMs: number
}

export type CharacterAliasPattern = {
  pattern: string
  characters: CharacterName[]
}
