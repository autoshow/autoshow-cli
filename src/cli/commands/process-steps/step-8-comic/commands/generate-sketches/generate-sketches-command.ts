import { mkdir } from 'node:fs/promises'
import { err } from '../../utils/logger'
import { generateSceneSketches } from './generate-scene-sketches'
import { DEFAULT_IMAGE_MODEL } from '../../models/model-registry'
import { validateImageSizeForModels } from '../../utils/image-size'
import { getSketchesDirectory } from '../../utils/project-paths'
import { assertPanelPromptSourceCoverage } from '../../utils/source-coverage-utils'
import { DEFAULT_PANELS_PER_IMAGE } from '../generate-images/comic-page-utils'
import type {
  GenerateSceneSketchesOptions,
  GenerateSketchesCommandOptions,
  ImageRunStats,
} from '../../types'



const DEFAULT_IMAGE_SIZE: GenerateSceneSketchesOptions['size'] = '1536x1024'
const DEFAULT_SKETCH_QUALITY: GenerateSceneSketchesOptions['quality'] = 'high'

export const generateSketchesCommand = async (
  options: GenerateSketchesCommandOptions
): Promise<ImageRunStats> => {
  const generationOptions: GenerateSceneSketchesOptions = {
    models: options.imageModels ?? [DEFAULT_IMAGE_MODEL],
    size: options.size ?? DEFAULT_IMAGE_SIZE,
    quality: options.quality ?? DEFAULT_SKETCH_QUALITY,
    force: options.force ?? false,
    panelsPerImage: options.panelsPerImage ?? DEFAULT_PANELS_PER_IMAGE,
    ...(options.sketchPanels !== undefined ? { sketchPanels: options.sketchPanels } : {}),
  }
  validateImageSizeForModels(generationOptions.size, generationOptions.models)

  try {
    await mkdir(getSketchesDirectory(options.sceneSlug), { recursive: true })
    await assertPanelPromptSourceCoverage(options.sceneSlug)
  } catch (error) {
    err('Sketch initialization failed:', error instanceof Error ? error.message : String(error))
    throw new Error('Failed at initialization step')
  }

  try {
    return await generateSceneSketches(options.sceneSlug, generationOptions)
  } catch (error) {
    err('Sketch generation failed:', error instanceof Error ? error.message : String(error))
    throw new Error('Failed at sketch generation step')
  }
}
