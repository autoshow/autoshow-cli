import { mkdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { err, comicLog, formatCompactCost, formatDuration } from '../../utils/logger'
import {
  CHARACTER_SKETCH_VIEWS,
  getCharacterByImagePath,
  getCharacterSketchImagePath,
  getCharacterSketchesDirectory,
  getUnsupportedCharacterSketchDirectoryFlags,
  resolveCharacterSketchesDirectoryPath,
  resolveCharacterSourceImagePath,
} from '../process-scenes/character-utils'
import {
  combineCharacterSketchSheet,
  selectCharacterSketchSheetSources,
} from './character-sketch-sheet'
import {
  createImage,
  createImageRunStats,
  updateImageRunStatsWithCostFallback,
  writeGeneratedImage,
} from '../../image-services'
import { DEFAULT_IMAGE_MODEL } from '../../models/model-registry'
import { validateImageSizeForModels } from '../../utils/image-size'
import { loadPromptsConfig } from '../../utils/scene-utils'
import type {
  CharacterDetails,
  CharacterSketchCommandOptions,
  CharacterSketchView,
  ImageGenerationQuality,
  ImageGenerationSize,
} from '../../types'



const DEFAULT_IMAGE_SIZE: ImageGenerationSize = '1024x1536'
const DEFAULT_CHARACTER_SKETCH_QUALITY: ImageGenerationQuality = 'medium'
const VIEW_PROMPT_KEYS: Record<CharacterSketchView, 'Front' | 'Three-Quarter' | 'Profile'> = {
  front: 'Front',
  'three-quarter': 'Three-Quarter',
  profile: 'Profile',
}
const VIEW_LABELS: Record<CharacterSketchView, string> = {
  front: 'front',
  'three-quarter': 'three-quarter',
  profile: 'profile',
}

const buildCharacterSketchPrompt = (
  imagePath: string,
  character: CharacterDetails | null,
  view: CharacterSketchView,
  prompts: Awaited<ReturnType<typeof loadPromptsConfig>>['Character Sketch Prompts'],
  revisionNotes?: string,
): string => {
  const requirements = [
    'Requirements:',
    '- Output black-and-white outline art only.',
    '- Use a plain white background with no props, scenery, shadows, gradients, or texture.',
    '- Do not add color, gray shading, halftone, lighting effects, painterly rendering, or style-specific surface detail.',
    '- Preserve the same face, body proportions, clothing silhouette, hairline, facial hair, and distinctive features from the reference image.',
    '- Keep the pose readable as a clean construction sketch for downstream character consistency.',
    '- Show the full character clearly in frame.',
  ]

  if (revisionNotes) {
    requirements.push('- Revise the provided sketch according to the revision notes above. Preserve all features not mentioned in the revision notes.')
  }

  const sections = [
    prompts.Prefix?.trim(),
    prompts.Character.trim(),
    character
      ? `Character: ${character.name}\nNotes: ${character.description}`
      : `Reference image: ${basename(imagePath)}`,
    revisionNotes ? `Revision notes: ${revisionNotes}` : undefined,
    prompts[VIEW_PROMPT_KEYS[view]].trim(),
    requirements.join('\n'),
  ]

  return sections.filter(section => section && section.length > 0).join('\n\n')
}

const describeTargetImage = (imagePath: string): string => {
  return basename(imagePath)
}

const combineCharacterSketchDirectory = async (
  sketchesDirectory: string,
  options: Pick<CharacterSketchCommandOptions, 'force'>
): Promise<void> => {
  const force = options.force ?? false
  const selection = selectCharacterSketchSheetSources(sketchesDirectory)
  const startTime = Date.now()

  comicLog.header('comic character-sketch', [
    'mode=combine',
    `source=${basename(sketchesDirectory)}`,
  ])
  comicLog.line('config', [
    `variant=${selection.variant}`,
    `refs=${selection.sources.length}`,
    force ? 'force=true' : undefined,
  ])

  const outputExists = await Bun.file(selection.outputPath).exists()
  if (!force && outputExists) {
    comicLog.output('skipped', 'sheet', [
      `variant=${selection.variant}`,
      `path=${selection.outputPath}`,
    ])
    comicLog.summary([
      'generated=0',
      'skipped=1',
      `duration=${formatDuration(Date.now() - startTime)}`,
    ])
    comicLog.outputDirectory(sketchesDirectory)
    return
  }

  const sheetSize = await combineCharacterSketchSheet(selection)
  const durationMs = Date.now() - startTime

  comicLog.output('combined', 'sheet', [
    `variant=${selection.variant}`,
    `refs=${selection.sources.length}`,
    `size=${sheetSize.width}x${sheetSize.height}`,
    `duration=${formatDuration(durationMs)}`,
    `path=${selection.outputPath}`,
  ])
  comicLog.summary([
    'generated=1',
    'skipped=0',
    `duration=${formatDuration(durationMs)}`,
  ])
  comicLog.outputDirectory(sketchesDirectory)
}

export const characterSketchCommand = async (
  options: CharacterSketchCommandOptions = {}
): Promise<void> => {
  if (!options.image) {
    throw new Error('--image is required')
  }

  const resolvedSketchesDirectory = resolveCharacterSketchesDirectoryPath(options.image)
  if (resolvedSketchesDirectory) {
    const unsupportedFlags = getUnsupportedCharacterSketchDirectoryFlags(options)
    if (unsupportedFlags.length > 0) {
      throw new Error(
        `${unsupportedFlags.join(', ')} cannot be used when --image points to a character sketch directory`
      )
    }

    await combineCharacterSketchDirectory(resolvedSketchesDirectory, options)
    return
  }

  const resolvedImagePath = resolveCharacterSourceImagePath(options.image)
  if (resolvedImagePath.includes('/sketches/')) {
    throw new Error('Character sketch input must be a source character image, not an existing generated sketch')
  }

  const generationOptions = {
    models: options.imageModels ?? [DEFAULT_IMAGE_MODEL],
    size: options.size ?? DEFAULT_IMAGE_SIZE,
    quality: options.quality ?? DEFAULT_CHARACTER_SKETCH_QUALITY,
    force: options.force ?? false,
    revise: options.revise ?? false,
    notes: options.notes,
  }
  validateImageSizeForModels(generationOptions.size, generationOptions.models)

  const startTime = Date.now()
  comicLog.header('comic character-sketch', [
    `image=${describeTargetImage(resolvedImagePath)}`,
  ])
  comicLog.line('config', [
    `models=${generationOptions.models.join(',')}`,
    `size=${generationOptions.size}`,
    `quality=${generationOptions.quality}`,
    `views=${CHARACTER_SKETCH_VIEWS.join(',')}`,
    generationOptions.revise ? 'revise=true' : undefined,
    generationOptions.force ? 'force=true' : undefined,
  ])

  try {
    await mkdir(getCharacterSketchesDirectory(resolvedImagePath), { recursive: true })
  } catch (error) {
    err('Initialization failed:', error instanceof Error ? error.message : String(error))
    throw new Error('Failed at initialization step')
  }

  try {
    const prompts = await loadPromptsConfig()
    const characterSketchPrompts = prompts['Character Sketch Prompts']
    const character = await getCharacterByImagePath(resolvedImagePath)
    const imageRunStats = createImageRunStats()
    const useModelSpecificFilenames = generationOptions.models.length > 1

    for (const view of CHARACTER_SKETCH_VIEWS) {
      const sketchesDir = getCharacterSketchesDirectory(resolvedImagePath)
      const stem = basename(sketchesDir)

      let referenceImages: string[]
      let isRevising = false

      if (generationOptions.revise) {
        const canonicalPath = getCharacterSketchImagePath(resolvedImagePath, view)
        if (await Bun.file(canonicalPath).exists()) {
          referenceImages = [resolvedImagePath, canonicalPath]
          isRevising = true
        } else {
          referenceImages = [resolvedImagePath]
        }
      } else {
        referenceImages = [resolvedImagePath]
      }

      const prompt = buildCharacterSketchPrompt(
        resolvedImagePath,
        character,
        view,
        characterSketchPrompts,
        isRevising ? generationOptions.notes : undefined,
      )

      for (const model of generationOptions.models) {
        let outputPath: string
        if (isRevising) {
          outputPath = join(sketchesDir, `${stem}--outline-${view}--revised.png`)
        } else {
          outputPath = getCharacterSketchImagePath(
            resolvedImagePath,
            view,
            useModelSpecificFilenames ? model : undefined
          )
        }

        if (!generationOptions.force && await Bun.file(outputPath).exists()) {
          imageRunStats.imagesSkipped++
          comicLog.output('skipped', 'character-sketch', [
            `view=${VIEW_LABELS[view]}`,
            `model=${model}`,
            `refs=${referenceImages.length}`,
            `path=${outputPath}`,
          ])
          continue
        }

        const requestStart = Date.now()
        const imageResponse = await createImage(
          prompt,
          referenceImages,
          model,
          generationOptions.size,
          generationOptions.quality,
        )
        const requestDurationMs = Date.now() - requestStart
        imageRunStats.totalDurationMs += requestDurationMs

        await writeGeneratedImage(
          outputPath,
          imageResponse.result.imageBase64,
          imageResponse.result.mimeType,
        )

        const { costLabel } = updateImageRunStatsWithCostFallback(
          model,
          imageResponse.result.usage,
          imageRunStats,
          generationOptions.quality,
          generationOptions.size,
        )

        comicLog.output('generated', 'character-sketch', [
          `view=${VIEW_LABELS[view]}`,
          isRevising ? 'revise=true' : undefined,
          `model=${model}`,
          `mode=${imageResponse.mode}`,
          imageResponse.inputFidelity ? `fidelity=${imageResponse.inputFidelity}` : undefined,
          `refs=${referenceImages.length}`,
          `cost=${costLabel}`,
          `duration=${formatDuration(requestDurationMs)}`,
          `path=${outputPath}`,
        ])

        imageRunStats.imagesGenerated++
      }
    }

    comicLog.summary([
      `generated=${imageRunStats.imagesGenerated}`,
      `skipped=${imageRunStats.imagesSkipped}`,
      `tokens=${(imageRunStats.totalInputTokens + imageRunStats.totalOutputTokens).toLocaleString()}`,
      `cost=${formatCompactCost(imageRunStats.totalCost)}`,
      `api=${formatDuration(imageRunStats.totalDurationMs)}`,
      `duration=${formatDuration(Date.now() - startTime)}`,
    ])
    comicLog.outputDirectory(getCharacterSketchesDirectory(resolvedImagePath))
  } catch (error) {
    err('Character sketch generation failed:', error instanceof Error ? error.message : String(error))
    throw new Error('Failed at character sketch generation step')
  }
}
