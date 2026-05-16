import { mkdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { l, err, bold, cyan, green, red } from '../../utils/logger'
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
  describeCharacterSketchSheetSources,
  selectCharacterSketchSheetSources,
} from './character-sketch-sheet'
import {
  createImage,
  createImageRunStats,
  estimateImageOutputCost,
  formatCost,
  logUsageAndUpdateStats,
  writeGeneratedImage,
} from '../../image-services'
import { DEFAULT_IMAGE_MODEL, isGeminiImageModel } from '../../models/model-registry'
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

  l(`${bold('USS Acampo')} - Combining character sketch sheet for ${basename(sketchesDirectory)}`)
  l(`${cyan('═'.repeat(50))}\n`)
  l(`${cyan('Step 1/1:')} Combining local sketch refs`)
  l(`${cyan('━'.repeat(50))}\n`)
  l.dim(`Sketch directory: ${sketchesDirectory}`)
  l.dim(`Selected variant: ${selection.variant}`)
  l.dim(`Source sketches:  ${describeCharacterSketchSheetSources(selection)}`)

  const outputExists = await Bun.file(selection.outputPath).exists()
  if (!force && outputExists) {
    l.dim(`Skipping existing output: ${selection.outputPath}`)
    l.success('Character sketch sheet already exists')
    return
  }

  if (force && outputExists) {
    l.dim('Existing character sketch sheet will be overwritten')
  }

  const startTime = Date.now()
  const sheetSize = await combineCharacterSketchSheet(selection)
  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  l.dim(`Sheet size:      ${sheetSize.width}x${sheetSize.height}`)
  l.dim(`Wrote:           ${selection.outputPath}`)
  l.success(`Character sketch sheet combined in ${duration}s`)
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

  l(`${bold('USS Acampo')} - Generating character sketches for ${describeTargetImage(resolvedImagePath)}`)
  l(`${cyan('═'.repeat(50))}\n`)

  const startTime = Date.now()
  const stats = {
    init: { success: false, error: '' },
    generateSketches: { success: false, error: '' },
  }

  try {
    l(`${cyan('Step 1/2:')} Initializing`)
    l(`${cyan('━'.repeat(50))}\n`)

    await mkdir(getCharacterSketchesDirectory(resolvedImagePath), { recursive: true })

    l.dim(`Character image: ${resolvedImagePath}`)
    l.dim(`Image models: ${generationOptions.models.join(', ')}`)
    l.dim(`Image size: ${generationOptions.size}`)
    l.dim(`Image quality: ${generationOptions.quality}`)
    l.dim(`Sketch views: ${CHARACTER_SKETCH_VIEWS.join(', ')}`)
    if (generationOptions.revise) {
      l.dim(`Revision mode: enabled`)
      l.dim(`Revision notes: ${generationOptions.notes}`)
    }
    if (generationOptions.models.some(isGeminiImageModel)) {
      l.dim('Gemini image models map CLI sizes to aspect ratio + 1K and ignore --quality')
    }
    if (generationOptions.force) {
      l.dim('Existing character sketch outputs will be overwritten')
    }

    stats.init.success = true
    l.success('Initialization complete')
    l('')
  } catch (error) {
    stats.init.error = error instanceof Error ? error.message : String(error)
    err('Initialization failed:', stats.init.error)
    throw new Error('Failed at initialization step')
  }

  try {
    l(`${cyan('Step 2/2:')} Generating character sketches via ${generationOptions.models.join(', ')}`)
    l(`${cyan('━'.repeat(50))}\n`)

    const prompts = await loadPromptsConfig()
    const characterSketchPrompts = prompts['Character Sketch Prompts']
    const character = await getCharacterByImagePath(resolvedImagePath)
    const imageRunStats = createImageRunStats()
    const useModelSpecificFilenames = generationOptions.models.length > 1
    let estimatedCostRequests = 0

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
          l.dim(`  View:             ${VIEW_LABELS[view]}`)
          l.dim(`  No prior sketch found at ${canonicalPath}; generating from source image`)
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
          l.dim(`  View:             ${VIEW_LABELS[view]}`)
          l.dim(`  Skipping existing output: ${outputPath}`)
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

        l.dim(`  View:             ${VIEW_LABELS[view]}${isRevising ? ' (revising)' : ''}`)
        l.dim(`  Model:            ${model}`)
        l.dim(`  Mode:             ${imageResponse.mode}`)
        if (imageResponse.inputFidelity) {
          l.dim(`  Input fidelity:   ${imageResponse.inputFidelity}`)
        }
        l.dim(
          isRevising
            ? `  References:       2 (${basename(resolvedImagePath)}, ${stem}--outline-${view}.png)`
            : `  References:       1 (${basename(resolvedImagePath)})`
        )
        l.dim(`  Size:             ${imageResponse.result.providerSizeLabel ?? generationOptions.size}`)
        l.dim(`  Quality:          ${imageResponse.result.providerQualityLabel ?? generationOptions.quality}`)
        if (imageResponse.result.mimeType && imageResponse.result.mimeType !== 'image/png') {
          l.dim(`  Source MIME:      ${imageResponse.result.mimeType} (normalized to PNG)`)
        }

        const usageCost = logUsageAndUpdateStats(model, imageResponse.result.usage, imageRunStats)
        if (usageCost === null) {
          const estimatedCost = estimateImageOutputCost(model, generationOptions.quality, generationOptions.size)
          const costUnavailableReason = imageResponse.result.usage
            ? 'no usable modality breakdown was returned'
            : 'no usage data returned'

          if (estimatedCost !== null) {
            imageRunStats.totalCost += estimatedCost
            estimatedCostRequests++
            l.dim(`  Cost:             ${formatCost(estimatedCost)} (estimated output only; ${costUnavailableReason})`)
          } else {
            l.dim(`  Cost:             unavailable (${costUnavailableReason})`)
          }
        }

        l.dim(`  Duration:         ${(requestDurationMs / 1000).toFixed(2)}s`)
        l.dim(`  Wrote:            ${outputPath}`)

        imageRunStats.imagesGenerated++
      }
    }

    l('')
    l.success(`Character sketches generated: ${imageRunStats.imagesGenerated}`)
    if (imageRunStats.imagesSkipped > 0) {
      l.dim(`Character sketches skipped: ${imageRunStats.imagesSkipped}`)
    }

    if (imageRunStats.imagesGenerated > 0) {
      l('')
      l(`${cyan('━'.repeat(50))}`)
      l(bold('Character Sketch Summary'))
      l(`${cyan('━'.repeat(50))}`)
      l.dim(
        `  Total input tokens:  ${imageRunStats.totalInputTokens.toLocaleString()} ` +
        `(${[
          `${imageRunStats.totalInputTextTokens.toLocaleString()} text`,
          `${imageRunStats.totalInputImageTokens.toLocaleString()} image`,
          ...(imageRunStats.totalInputUnattributedTokens > 0
            ? [`${imageRunStats.totalInputUnattributedTokens.toLocaleString()} unattributed`]
            : []),
        ].join(', ')})`
      )
      l.dim(
        `  Total output tokens: ${imageRunStats.totalOutputTokens.toLocaleString()} ` +
        `(${[
          `${imageRunStats.totalOutputTextTokens.toLocaleString()} text`,
          `${imageRunStats.totalOutputImageTokens.toLocaleString()} image`,
          ...(imageRunStats.totalOutputUnattributedTokens > 0
            ? [`${imageRunStats.totalOutputUnattributedTokens.toLocaleString()} unattributed`]
            : []),
        ].join(', ')})`
      )
      l.dim(
        `  Total tokens:        ${(imageRunStats.totalInputTokens + imageRunStats.totalOutputTokens).toLocaleString()}`
      )
      l.dim(`  Total cost:          ${formatCost(imageRunStats.totalCost)}`)
      if (estimatedCostRequests > 0) {
        l.dim(`  Cost estimate note:  ${estimatedCostRequests} request(s) used output-only estimates`)
      }
      l.dim(`  Total API time:      ${(imageRunStats.totalDurationMs / 1000).toFixed(2)}s`)
    }

    stats.generateSketches.success = true
    l.success('Character sketch generation complete')
    l('')
  } catch (error) {
    stats.generateSketches.error = error instanceof Error ? error.message : String(error)
    err('Character sketch generation failed:', stats.generateSketches.error)
    throw new Error('Failed at character sketch generation step')
  }

  const endTime = Date.now()
  const duration = ((endTime - startTime) / 1000).toFixed(2)

  l(`${cyan('═'.repeat(50))}`)
  l(bold('Character Sketch Generation Complete'))
  l(`${cyan('═'.repeat(50))}\n`)

  l(`  ${stats.init.success ? green('✓') : red('✗')} Initialization`)
  l(`  ${stats.generateSketches.success ? green('✓') : red('✗')} Character sketch generation (${generationOptions.models.join(', ')})`)
  l('')

  l.dim(`Character sketch output directory: ${getCharacterSketchesDirectory(resolvedImagePath)}`)
  l.success(`All operations completed in ${duration}s`)
}
