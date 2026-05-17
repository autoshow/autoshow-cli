import { mkdir } from 'node:fs/promises'
import { l, err, bold, cyan, green, red } from '../../utils/logger'
import { generateSceneSketches } from './generate-scene-sketches'
import { DEFAULT_IMAGE_MODEL, isGeminiImageModel } from '../../models/model-registry'
import { validateImageSizeForModels } from '../../utils/image-size'
import { COMIC_OUTPUT_ROOT, getSketchesDirectory } from '../../utils/project-paths'
import { assertPanelPromptSourceCoverage } from '../../utils/source-coverage-utils'
import { DEFAULT_PANELS_PER_IMAGE } from '../generate-images/comic-page-utils'
import type {
  GenerateSceneSketchesOptions,
  GenerateSketchesCommandOptions,
} from '../../types'



const DEFAULT_IMAGE_SIZE: GenerateSceneSketchesOptions['size'] = '1536x1024'
const DEFAULT_SKETCH_QUALITY: GenerateSceneSketchesOptions['quality'] = 'high'

export const generateSketchesCommand = async (
  options: GenerateSketchesCommandOptions
): Promise<void> => {
  const generationOptions: GenerateSceneSketchesOptions = {
    models: options.imageModels ?? [DEFAULT_IMAGE_MODEL],
    size: options.size ?? DEFAULT_IMAGE_SIZE,
    quality: options.quality ?? DEFAULT_SKETCH_QUALITY,
    force: options.force ?? false,
    panelsPerImage: options.panelsPerImage ?? DEFAULT_PANELS_PER_IMAGE,
    ...(options.sketchPanels !== undefined ? { sketchPanels: options.sketchPanels } : {}),
  }
  validateImageSizeForModels(generationOptions.size, generationOptions.models)

  l(`${bold('USS Acampo')} - Generating review sketches for ${options.sceneSlug}`)
  l(`${cyan('═'.repeat(50))}\n`)

  const startTime = Date.now()
  const stats = {
    init: { success: false, error: '' },
    generateSketches: { success: false, error: '' },
  }

  try {
    l(`${cyan('Step 1/2:')} Initializing`)
    l(`${cyan('━'.repeat(50))}\n`)

    await mkdir(getSketchesDirectory(options.sceneSlug), { recursive: true })
    await assertPanelPromptSourceCoverage(options.sceneSlug)

    l.dim(`Image models: ${generationOptions.models.join(', ')}`)
    l.dim(`Image size: ${generationOptions.size}`)
    l.dim(`Image quality: ${generationOptions.quality}`)
    l.dim(`Panels per sketch: ${generationOptions.panelsPerImage}`)
    if (generationOptions.sketchPanels) {
      const sketchPanels = generationOptions.sketchPanels === 'all'
        ? 'all'
        : `${generationOptions.sketchPanels.startPanelNumber}-${generationOptions.sketchPanels.endPanelNumber}`
      l.dim(`Sketch panel range: ${sketchPanels}`)
    }
    if (generationOptions.models.some(isGeminiImageModel)) {
      l.dim('Gemini image models map CLI sizes to aspect ratio + 1K and ignore --quality')
    }
    if (generationOptions.force) {
      l.dim('Existing sketch outputs will be overwritten')
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
    l(`${cyan('Step 2/2:')} Generating sketches via ${generationOptions.models.join(', ')}`)
    l(`${cyan('━'.repeat(50))}\n`)

    await generateSceneSketches(options.sceneSlug, generationOptions)

    stats.generateSketches.success = true
    l.success('Sketch generation complete')
    l('')
  } catch (error) {
    stats.generateSketches.error = error instanceof Error ? error.message : String(error)
    err('Sketch generation failed:', stats.generateSketches.error)
    throw new Error('Failed at sketch generation step')
  }

  const endTime = Date.now()
  const duration = ((endTime - startTime) / 1000).toFixed(2)

  l(`${cyan('═'.repeat(50))}`)
  l(bold('Sketch Generation Complete'))
  l(`${cyan('═'.repeat(50))}\n`)

  l(`  ${stats.init.success ? green('✓') : red('✗')} Initialization`)
  l(`  ${stats.generateSketches.success ? green('✓') : red('✗')} Sketch generation (${generationOptions.models.join(', ')})`)
  l('')

  l.dim(`Output directory: ${COMIC_OUTPUT_ROOT}/${options.sceneSlug}`)
  l.success(`All operations completed in ${duration}s`)
}
