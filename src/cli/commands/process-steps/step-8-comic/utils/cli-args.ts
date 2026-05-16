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
import type {
  ParsedCharacterSketchArgs,
  ParsedDraftCommandArgs,
  ParsedGenerateBaseArgs,
  ParsedGenerateImagesArgs,
  ParsedImageModel,
  ParsedImageQuality,
  ParsedImageSize,
  ParsedLlmModel,
} from '../types'
import { parsePanelSelector } from '../commands/generate-images/comic-page-utils'



export const CHARACTER_SKETCH_COMMAND = 'character-sketch'
export const DRAFT_SCENES_COMMAND = 'draft-scenes'
export const GENERATE_IMAGES_COMMAND = 'generate-images'
export const DRAFT_SCENES_ONLY_VALUES = ['structure', 'prompt', 'scene'] as const
export const GENERATE_IMAGES_TARGET_VALUES = ['prompts', 'images', 'sketches', 'both'] as const

const IMAGE_QUALITY_OPTIONS = new Set<string>(IMAGE_GENERATION_QUALITIES)
const IMAGE_MODEL_OPTIONS = new Set<string>(IMAGE_MODELS)
const LLM_MODEL_OPTIONS = new Set<string>(LLM_MODELS)
const DRAFT_SCENES_ONLY_OPTIONS = new Set<string>(DRAFT_SCENES_ONLY_VALUES)
const GENERATE_IMAGES_TARGET_OPTIONS = new Set<string>(GENERATE_IMAGES_TARGET_VALUES)

export const HELP_TEXT = `USS Acampo

Usage:
  bun as comic ${DRAFT_SCENES_COMMAND} <script-path> [--only structure|prompt|scene] [--llm-model <model>] [--price]
  bun as comic ${GENERATE_IMAGES_COMMAND} <script-path> [--target prompts|images|sketches|both] [--llm-model <model>] [--panels <all|list>] [--panel-limit <n>] [--panels-per-image <n>] [--chunk <number>] [--sketch-group-size <number|all>] [--sketch-panels <range>] [--image-model <model[,model...]>] [--size <size>] [--quality <quality>] [--force] [--price]
  bun as comic ${CHARACTER_SKETCH_COMMAND} --image <source-image|sketch-dir> [--image-model <model[,model...]>] [--size <size>] [--quality <quality>] [--force] [--revise --notes <text>] [--price]

Commands:
  ${DRAFT_SCENES_COMMAND.padEnd(18, ' ')}Run script markdown to structured script JSON to draft prompt bundles to scene JSON
  ${GENERATE_IMAGES_COMMAND.padEnd(18, ' ')}Run scene JSON to panel prompt bundles to review sketches and/or final panel images
  ${CHARACTER_SKETCH_COMMAND.padEnd(18, ' ')}Generate 3 outline-only character sketch refs, or combine a sketch directory into one sheet

Arguments:
  <script-path>              Path to a script markdown file (e.g. input/episode-scripts/ep05-scripts/01-paddy-goes-on-vacation.md)

Options:
  --only <stage>             (${DRAFT_SCENES_COMMAND} command) Run one stage: structure, prompt, or scene
  --llm-model <model>        (${DRAFT_SCENES_COMMAND}/${GENERATE_IMAGES_COMMAND} commands) One of ${LLM_MODELS.join(', ')}${DEFAULT_LLM_MODEL ? ` (default for scene drafting: ${DEFAULT_LLM_MODEL})` : ''}
  --target <target>          (${GENERATE_IMAGES_COMMAND} command) prompts, images, sketches, or both (default: images)
  --panels <all|list>        (${GENERATE_IMAGES_COMMAND} command) Page panels to generate: all, 1-8, 1,3,7, or 1-4,9 (default: all)
  --panel-limit <n>          (${GENERATE_IMAGES_COMMAND} command) Cap selected panels after --panels resolution
  --panels-per-image <n>     (${GENERATE_IMAGES_COMMAND} command) Render this many ordered panels per final page image (default: 4)
  --chunk <number>           (${GENERATE_IMAGES_COMMAND} command) Run only one 1-based sketch chunk within a scene
  --sketch-group-size <n|all> (${GENERATE_IMAGES_COMMAND} command) Group sketches by this many panels, or all panels in each scene
  --sketch-panels <range>    (${GENERATE_IMAGES_COMMAND} command) Generate one explicit scene sketch range such as 1-4 or all
  --image <path>             (${CHARACTER_SKETCH_COMMAND} command) Character source image path, or sketch directory such as output/characters/sketches/03-duco
  --image-model <model[,model...]> (${CHARACTER_SKETCH_COMMAND}/${GENERATE_IMAGES_COMMAND} commands) One or more comma-separated values from ${IMAGE_MODELS.join(', ')} (default: ${DEFAULT_IMAGE_MODEL})
  --size <size>              (${CHARACTER_SKETCH_COMMAND}/${GENERATE_IMAGES_COMMAND} commands) One of ${IMAGE_SIZE_HELP}
  --quality <quality>        (${CHARACTER_SKETCH_COMMAND}/${GENERATE_IMAGES_COMMAND} commands) One of ${IMAGE_GENERATION_QUALITIES.join(', ')}. Gemini image models accept this flag for CLI compatibility but ignore it
  -f, --force                (${CHARACTER_SKETCH_COMMAND}/${GENERATE_IMAGES_COMMAND} commands) Rebuild panel prompts and overwrite existing generated PNGs
  -r, --revise               (${CHARACTER_SKETCH_COMMAND} command) Revision mode: pass existing sketches as additional references alongside the source image
  --notes <text>             (${CHARACTER_SKETCH_COMMAND} command, requires --revise) Revision instructions describing what to change
  --price                    Dry run: estimate API cost without making any calls
  -h, --help                 Show this help text
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
        throw new Error('--episode was removed. Pass a script file path directly: bun as comic draft-scenes path/to/script.md')
      case '--script':
        throw new Error('--script was removed. Pass a script file path directly: bun as comic draft-scenes path/to/script.md')
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
        throw new Error('--skip-panel-prompts was removed. Panel prompts are now auto-detected and only rebuilt when missing. Use --force to rebuild existing prompts, or --target prompts to explicitly rebuild.')
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
        throw new Error('--episode was removed. Pass a script file path directly: bun as comic generate-images path/to/script.md')
      case '-s':
      case '--scene':
        throw new Error('--scene was removed. Pass a script file path directly: bun as comic generate-images path/to/script.md')
      case '--concurrency':
        throw new Error('--concurrency was removed. Commands now process a single script.')
      case '--panel': {
        if (parsed.panel !== undefined) {
          throw new Error('Panel can only be specified once')
        }

        const panel = readFlagValue(args, index, argument)
        if (!isPositiveInteger(panel)) {
          throw new Error(`Invalid panel "${panel}". Expected a positive integer like 1 or 2`)
        }

        parsed.panel = Number(panel)
        index++
        break
      }
      case '--panels': {
        if (parsed.panels !== undefined) {
          throw new Error('Panels can only be specified once')
        }

        parsed.panels = parsePanelSelector(readFlagValue(args, index, argument))
        index++
        break
      }
      case '--panel-limit': {
        if (parsed.panelLimit !== undefined) {
          throw new Error('Panel limit can only be specified once')
        }

        const panelLimit = readFlagValue(args, index, argument)
        if (!isPositiveInteger(panelLimit)) {
          throw new Error(`Invalid panel limit "${panelLimit}". Expected a positive integer like 4 or 16`)
        }

        parsed.panelLimit = Number(panelLimit)
        index++
        break
      }
      case '--panels-per-image': {
        if (parsed.panelsPerImage !== undefined) {
          throw new Error('Panels per image can only be specified once')
        }

        const panelsPerImage = readFlagValue(args, index, argument)
        if (!isPositiveInteger(panelsPerImage)) {
          throw new Error(`Invalid panels per image "${panelsPerImage}". Expected a positive integer like 1 or 4`)
        }

        parsed.panelsPerImage = Number(panelsPerImage)
        index++
        break
      }
      case '--chunk': {
        if (parsed.chunk !== undefined) {
          throw new Error('Chunk can only be specified once')
        }

        const chunk = readFlagValue(args, index, argument)
        if (!isPositiveInteger(chunk)) {
          throw new Error(`Invalid chunk "${chunk}". Expected a positive integer like 1 or 2`)
        }

        parsed.chunk = Number(chunk)
        index++
        break
      }
      case '--sketch-group-size': {
        if (parsed.sketchGroupSize !== undefined) {
          throw new Error('Sketch group size can only be specified once')
        }

        const sketchGroupSize = readFlagValue(args, index, argument)
        if (sketchGroupSize === 'all') {
          parsed.sketchGroupSize = 'all'
        } else if (isPositiveInteger(sketchGroupSize)) {
          parsed.sketchGroupSize = Number(sketchGroupSize)
        } else {
          throw new Error(
            `Invalid sketch group size "${sketchGroupSize}". Expected a positive integer or all`
          )
        }

        index++
        break
      }
      case '--sketch-panels': {
        if (parsed.sketchPanels !== undefined) {
          throw new Error('Sketch panels can only be specified once')
        }

        const sketchPanels = readFlagValue(args, index, argument)
        if (sketchPanels === 'all') {
          parsed.sketchPanels = 'all'
        } else {
          const match = sketchPanels.match(/^(\d+)-(\d+)$/)
          const startPanelNumber = match?.[1] ? Number(match[1]) : 0
          const endPanelNumber = match?.[2] ? Number(match[2]) : 0

          if (!match || startPanelNumber < 1 || endPanelNumber < 1 || startPanelNumber > endPanelNumber) {
            throw new Error(
              `Invalid sketch panels "${sketchPanels}". Expected a range like 1-4 or all`
            )
          }

          parsed.sketchPanels = { startPanelNumber, endPanelNumber }
        }

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

  if (parsed.chunk !== undefined && parsed.sketchPanels !== undefined) {
    throw new Error('--chunk cannot be combined with --sketch-panels')
  }

  if (parsed.sketchGroupSize !== undefined && parsed.sketchPanels !== undefined) {
    throw new Error('--sketch-group-size cannot be combined with --sketch-panels')
  }

  if (parsed.panels !== undefined && parsed.panel !== undefined) {
    throw new Error('--panels cannot be combined with --panel')
  }

  const target = parsed.target ?? 'images'
  const targetRunsFinalImages = target === 'images' || target === 'both'
  const targetRunsSketches = target === 'sketches' || target === 'both'
  const hasSketchOptions = parsed.chunk !== undefined
    || parsed.sketchGroupSize !== undefined
    || parsed.sketchPanels !== undefined
  const hasPageOptions = parsed.panels !== undefined
    || parsed.panelLimit !== undefined
    || parsed.panelsPerImage !== undefined

  if (parsed.panel !== undefined && !targetRunsFinalImages) {
    throw new Error('--panel only applies when --target is images or both')
  }

  if (hasPageOptions && !targetRunsFinalImages) {
    throw new Error('--panels, --panel-limit, and --panels-per-image only apply when --target is images or both')
  }

  if (hasSketchOptions && !targetRunsSketches) {
    throw new Error('Sketch options require --target sketches or --target both')
  }

  validateImageSizeForModels(parsed.size, parsed.imageModels)

  return parsed as ParsedGenerateImagesArgs
}
