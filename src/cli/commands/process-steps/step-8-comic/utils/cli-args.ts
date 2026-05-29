import {
  IMAGE_GENERATION_QUALITIES,
} from '../image-services/image-types'
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_LLM_MODEL,
  IMAGE_MODELS,
  LLM_MODELS,
} from '../models/model-registry'
import {
  IMAGE_SIZE_HELP,
  validateImageSizeForModels,
} from './image-size'
import {
  IMAGE_PROMPT_VARIATIONS,
  parseImagePromptVariations,
} from '../commands/generate-images/prompt-variations'
import type {
  ParsedDraftCommandArgs,
  ParsedGenerateBaseArgs,
  ParsedImageModel,
  ParsedImageQuality,
  ParsedImageSize,
  ParsedLlmModel,
} from '../types/comic-types'
import type {
  ParsedCharacterSketchArgs,
  ParsedGenerateImagesArgs,
} from '../types/comic-command-types'
import {
  COMIC_GRID_PANEL_SIZE,
  DEFAULT_PANELS_PER_IMAGE,
  parseComicGridSpec,
  parsePanelSelector,
  validateComicGridOptions,
} from '../commands/generate-images/comic-page-utils'



export const CHARACTER_SKETCH_COMMAND = 'character-sketch'
export const DRAFT_SCENES_COMMAND = 'draft-scenes'
export const GENERATE_IMAGES_COMMAND = 'generate-images'
const DRAFT_SCENES_ONLY_VALUES = ['structure', 'prompt', 'scene', 'panel-prompts'] as const
const GENERATE_IMAGES_TARGET_VALUES = ['images', 'sketches', 'both'] as const
const PANEL_PROMPTS_TARGET_MIGRATION =
  'The generate-images "prompts" target was removed. Use: bun as comic draft-scenes <script-path> --only panel-prompts'

const IMAGE_QUALITY_OPTIONS = new Set<string>(IMAGE_GENERATION_QUALITIES)
const IMAGE_MODEL_OPTIONS = new Set<string>(IMAGE_MODELS)
const LLM_MODEL_OPTIONS = new Set<string>(LLM_MODELS)
const DRAFT_SCENES_ONLY_OPTIONS = new Set<string>(DRAFT_SCENES_ONLY_VALUES)
const GENERATE_IMAGES_TARGET_OPTIONS = new Set<string>(GENERATE_IMAGES_TARGET_VALUES)

export const HELP_TEXT = `USS Acampo

Usage:
  bun as comic ${DRAFT_SCENES_COMMAND} <script-path> [--only structure|prompt|scene|panel-prompts] [--price]
  bun as comic ${GENERATE_IMAGES_COMMAND} <script-path> [--target images|sketches|both] [--panels <all|range|list>] [--panels-per-image <n>] [--grid <columns>x<rows>] [--variation <name[,name...]>] [--force] [--price]
  bun as comic ${CHARACTER_SKETCH_COMMAND} --image <source-image|sketch-dir> [--force] [--revise --notes <text>] [--price]

Commands:
  ${DRAFT_SCENES_COMMAND.padEnd(18, ' ')}Run script markdown to structured script JSON to draft prompt bundles to scene JSON to panel prompt bundles
  ${GENERATE_IMAGES_COMMAND.padEnd(18, ' ')}Run panel prompt bundles to review sketches and/or final panel images
  ${CHARACTER_SKETCH_COMMAND.padEnd(18, ' ')}Generate 3 outline-only character sketch refs, or combine a sketch directory into one sheet

Arguments:
  <script-path>              Path to a script markdown file, or NN-SC shorthand (e.g. 05-01 or input/episode-scripts/05-script/01-paddy-goes-on-vacation.md)

Options:
  --only <stage>             (${DRAFT_SCENES_COMMAND}) Run one stage: structure, prompt, scene, or panel-prompts
  --target <target>          (${GENERATE_IMAGES_COMMAND}) images, sketches, or both (default: images)
  --panels <all|range|list>  (${GENERATE_IMAGES_COMMAND}) Panels to process: all, 1-8, 1,3,7, or 1-4,9; overlong ranges clamp (default: all)
  --image <path>             (${CHARACTER_SKETCH_COMMAND}) Character source image or sketch directory
  -f, --force                Rebuild and overwrite existing outputs
  -r, --revise               (${CHARACTER_SKETCH_COMMAND}) Revision mode with --notes
  --notes <text>             (${CHARACTER_SKETCH_COMMAND}, requires --revise) Revision instructions
  --price                    Dry run: estimate API cost without making any calls
  -h, --help                 Show this help text

Advanced:
  --llm-model <model>        Text model for scene drafting (default: ${DEFAULT_LLM_MODEL})
  --image-model <model[,model...]> Image model (default: ${DEFAULT_IMAGE_MODEL})
  --variation <name[,name...]> (${GENERATE_IMAGES_COMMAND}) Final-image prompt variations: ${IMAGE_PROMPT_VARIATIONS.join(', ')}
  --size <size>              Image size: ${IMAGE_SIZE_HELP}
  --quality <quality>        Image quality: ${IMAGE_GENERATION_QUALITIES.join(', ')}
  --panels-per-image <n>     (${GENERATE_IMAGES_COMMAND}) Panels per generated image (default: ${DEFAULT_PANELS_PER_IMAGE})
  --grid <columns>x<rows>    (${GENERATE_IMAGES_COMMAND}) Compose individual final panels into local page grids; requires --panels-per-image 1 and --size ${COMIC_GRID_PANEL_SIZE}
`

const readFlagValue = (args: string[], index: number, flag: string): string => {
  const value = args[index + 1]
  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${flag}`)
  }

  return value
}

const isPositiveInteger = (value: string): boolean => {
  return /^\d+$/.test(value) && Number(value) > 0
}

const parseImageModels = (value: string): ParsedImageModel[] => {
  const rawModels = value.split(',').map(model => model.trim())
  if (rawModels.some(model => model.length === 0)) {
    throw new Error(
      `Invalid image model list "${value}". Expected one or more comma-separated values from: ${IMAGE_MODELS.join(', ')}`
    )
  }

  const parsedModels: ParsedImageModel[] = []
  const seenModels = new Set<string>()

  for (const model of rawModels) {
    if (!IMAGE_MODEL_OPTIONS.has(model)) {
      throw new Error(
        `Invalid image model "${model}". Expected one or more comma-separated values from: ${IMAGE_MODELS.join(', ')}`
      )
    }

    if (seenModels.has(model)) {
      throw new Error(`Duplicate image model "${model}" is not allowed`)
    }

    seenModels.add(model)
    parsedModels.push(model as ParsedImageModel)
  }

  return parsedModels
}

export const parseDraftScenesArgs = (args: string[]): ParsedDraftCommandArgs => {
  const parsed: ParsedDraftCommandArgs = { showHelp: false }

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]

    switch (argument) {
      case '-h':
      case '--help':
        parsed.showHelp = true
        break
      case '--price':
        parsed.price = true
        break
      case '--llm-model': {
        if (parsed.llmModel) {
          throw new Error('LLM model can only be specified once')
        }

        const llmModel = readFlagValue(args, index, argument)
        if (!LLM_MODEL_OPTIONS.has(llmModel)) {
          throw new Error(
            `Invalid llm model "${llmModel}". Expected one of: ${LLM_MODELS.join(', ')}`
          )
        }

        parsed.llmModel = llmModel as ParsedLlmModel
        index++
        break
      }
      case '--only': {
        if (parsed.only) {
          throw new Error('Only can only be specified once')
        }

        const only = readFlagValue(args, index, argument)
        if (!DRAFT_SCENES_ONLY_OPTIONS.has(only)) {
          throw new Error(
            `Invalid only "${only}". Expected one of: ${DRAFT_SCENES_ONLY_VALUES.join(', ')}`
          )
        }

        parsed.only = only as NonNullable<ParsedDraftCommandArgs['only']>
        index++
        break
      }
      case '-e':
      case '--episode':
        throw new Error('--episode was removed. Pass a script file path or NN-SC shorthand: bun as comic draft-scenes 05-01')
      case '--script':
        throw new Error('--script was removed. Pass a script file path or NN-SC shorthand: bun as comic draft-scenes 05-01')
      case '--concurrency':
        throw new Error('--concurrency was removed. Commands now process a single script.')
      default: {
        if (argument && argument.startsWith('-')) {
          throw new Error(`Unknown argument: ${argument}`)
        }
        if (parsed.scriptPath) {
          throw new Error('Script path can only be specified once')
        }
        if (argument) {
          parsed.scriptPath = argument
        }
        break
      }
    }
  }

  return parsed
}

export const parseCharacterSketchArgs = (args: string[]): ParsedCharacterSketchArgs => {
  const parsed: ParsedCharacterSketchArgs = { showHelp: false }

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]

    switch (argument) {
      case '-h':
      case '--help':
        parsed.showHelp = true
        break
      case '--price':
        parsed.price = true
        break
      case '--image': {
        if (parsed.image) {
          throw new Error('Image can only be specified once')
        }

        parsed.image = readFlagValue(args, index, argument)
        index++
        break
      }
      case '--image-model': {
        if (parsed.imageModels) {
          throw new Error('Image model can only be specified once')
        }

        parsed.imageModels = parseImageModels(readFlagValue(args, index, argument))
        index++
        break
      }
      case '--size': {
        if (parsed.size) {
          throw new Error('Size can only be specified once')
        }

        const size = readFlagValue(args, index, argument)
        parsed.size = size as ParsedImageSize
        index++
        break
      }
      case '--quality': {
        if (parsed.quality) {
          throw new Error('Quality can only be specified once')
        }

        const quality = readFlagValue(args, index, argument)
        if (!IMAGE_QUALITY_OPTIONS.has(quality)) {
          throw new Error(`Invalid quality "${quality}". Expected one of: low, medium, high, auto`)
        }

        parsed.quality = quality as ParsedImageQuality
        index++
        break
      }
      case '-f':
      case '--force': {
        if (parsed.force) {
          throw new Error('Force can only be specified once')
        }

        parsed.force = true
        break
      }
      case '-r':
      case '--revise': {
        if (parsed.revise) {
          throw new Error('Revise can only be specified once')
        }

        parsed.revise = true
        break
      }
      case '--notes': {
        if (parsed.notes) {
          throw new Error('Notes can only be specified once')
        }

        parsed.notes = readFlagValue(args, index, argument)
        index++
        break
      }
      default:
        throw new Error(`Unknown argument: ${argument}`)
    }
  }

  if (!parsed.showHelp && !parsed.image) {
    throw new Error('--image is required')
  }

  validateImageSizeForModels(parsed.size, parsed.imageModels)

  if (parsed.revise && !parsed.notes) {
    throw new Error('--notes is required when using --revise')
  }

  if (parsed.notes && !parsed.revise) {
    throw new Error('--notes requires --revise')
  }

  return parsed
}

export const parseGenerateImagesArgs = (args: string[]): ParsedGenerateImagesArgs => {
  const parsed: ParsedGenerateBaseArgs = { showHelp: false }

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]

    switch (argument) {
      case '-h':
      case '--help':
        parsed.showHelp = true
        break
      case '--price':
        parsed.price = true
        break
      case '--target': {
        if (parsed.target) {
          throw new Error('Target can only be specified once')
        }

        const target = readFlagValue(args, index, argument)
        if (target === 'prompts') {
          throw new Error(PANEL_PROMPTS_TARGET_MIGRATION)
        }

        if (!GENERATE_IMAGES_TARGET_OPTIONS.has(target)) {
          throw new Error(
            `Invalid target "${target}". Expected one of: ${GENERATE_IMAGES_TARGET_VALUES.join(', ')}`
          )
        }

        parsed.target = target as NonNullable<ParsedGenerateBaseArgs['target']>
        index++
        break
      }
      case '--skip-panel-prompts':
        throw new Error('--skip-panel-prompts was removed. Panel prompts are now auto-detected and only rebuilt when missing. Use --force to rebuild during image generation, or run "bun as comic draft-scenes <script-path> --only panel-prompts" explicitly.')
      case '--draft-scenes':
        throw new Error('--draft-scenes was removed. Scene drafts are now auto-detected and only rebuilt when missing. Use --force to rebuild existing scene drafts.')
      case '--llm-model': {
        if (parsed.llmModel) {
          throw new Error('LLM model can only be specified once')
        }

        const llmModel = readFlagValue(args, index, argument)
        if (!LLM_MODEL_OPTIONS.has(llmModel)) {
          throw new Error(
            `Invalid llm model "${llmModel}". Expected one of: ${LLM_MODELS.join(', ')}`
          )
        }

        parsed.llmModel = llmModel as ParsedLlmModel
        index++
        break
      }
      case '-e':
      case '--episode':
        throw new Error('--episode was removed. Pass a script file path or NN-SC shorthand: bun as comic generate-images 05-01')
      case '-s':
      case '--scene':
        throw new Error('--scene was removed. Pass a script file path or NN-SC shorthand: bun as comic generate-images 05-01')
      case '--concurrency':
        throw new Error('--concurrency was removed. Commands now process a single script.')
      case '--panel':
        throw new Error('--panel was removed. Use --panels <n> to select a single panel.')
      case '--panels': {
        if (parsed.panels !== undefined) {
          throw new Error('Panels can only be specified once')
        }

        parsed.panels = parsePanelSelector(readFlagValue(args, index, argument))
        index++
        break
      }
      case '--panel-limit':
        throw new Error('--panel-limit was removed. Use --panels <range> to select an explicit range (e.g. --panels 1-4).')
      case '--panels-per-image': {
        if (parsed.panelsPerImage !== undefined) {
          throw new Error('Panels per image can only be specified once')
        }

        const panelsPerImage = readFlagValue(args, index, argument)
        if (!isPositiveInteger(panelsPerImage)) {
          throw new Error(`Invalid panels per image "${panelsPerImage}". Expected a positive integer like 1 or ${DEFAULT_PANELS_PER_IMAGE}`)
        }

        parsed.panelsPerImage = Number(panelsPerImage)
        index++
        break
      }
      case '--grid': {
        if (parsed.grid !== undefined) {
          throw new Error('Grid can only be specified once')
        }

        parsed.grid = parseComicGridSpec(readFlagValue(args, index, argument))
        index++
        break
      }
      case '--chunk':
        throw new Error('--chunk was removed. Use --panels <range> with --target sketches instead (e.g. --panels 5-8).')
      case '--sketch-group-size':
        throw new Error(`--sketch-group-size was removed. Sketches are grouped in chunks of ${DEFAULT_PANELS_PER_IMAGE} by default. Use --panels-per-image <n> to change the chunk size or --panels <range> to select specific panels.`)
      case '--sketch-panels':
        throw new Error('--sketch-panels was removed. Use --panels <range> instead (e.g. --panels 1-4).')
      case '--image-model': {
        if (parsed.imageModels) {
          throw new Error('Image model can only be specified once')
        }

        parsed.imageModels = parseImageModels(readFlagValue(args, index, argument))
        index++
        break
      }
      case '--variation': {
        if (parsed.variations) {
          throw new Error('Variation can only be specified once')
        }

        parsed.variations = parseImagePromptVariations(readFlagValue(args, index, argument))
        index++
        break
      }
      case '--size': {
        if (parsed.size) {
          throw new Error('Size can only be specified once')
        }

        const size = readFlagValue(args, index, argument)
        parsed.size = size as ParsedImageSize
        index++
        break
      }
      case '--quality': {
        if (parsed.quality) {
          throw new Error('Quality can only be specified once')
        }

        const quality = readFlagValue(args, index, argument)
        if (!IMAGE_QUALITY_OPTIONS.has(quality)) {
          throw new Error(`Invalid quality "${quality}". Expected one of: low, medium, high, auto`)
        }

        parsed.quality = quality as ParsedImageQuality
        index++
        break
      }
      case '-f':
      case '--force': {
        if (parsed.force) {
          throw new Error('Force can only be specified once')
        }

        parsed.force = true
        break
      }
      default: {
        if (argument && argument.startsWith('-')) {
          throw new Error(`Unknown argument: ${argument}`)
        }
        if (parsed.scriptPath) {
          throw new Error('Script path can only be specified once')
        }
        if (argument) {
          parsed.scriptPath = argument
        }
        break
      }
    }
  }

  const target = parsed.target ?? 'images'
  const targetRunsFinalImages = target === 'images' || target === 'both'

  if (parsed.variations !== undefined && !targetRunsFinalImages) {
    throw new Error('--variation only applies when --target is images or both')
  }

  validateImageSizeForModels(parsed.size, parsed.imageModels)
  validateComicGridOptions(parsed.grid, {
    target,
    size: parsed.size ?? COMIC_GRID_PANEL_SIZE,
    panelsPerImage: parsed.panelsPerImage ?? DEFAULT_PANELS_PER_IMAGE,
  })

  return parsed as ParsedGenerateImagesArgs
}
