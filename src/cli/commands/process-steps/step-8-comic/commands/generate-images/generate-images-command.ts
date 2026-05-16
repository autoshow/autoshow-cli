import { existsSync } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { l, err, bold, cyan, green, red } from '../../utils/logger'
import { generatePanelImages } from './generate-panel-images'
import { generateComicPages } from './generate-comic-pages'
import { panelSelectionToSketchRange } from './comic-page-utils'
import { draftScenesCommand } from '../draft-scenes/draft-scenes-command'
import { panelPromptsCommand } from '../panel-prompts/panel-prompts-command'
import { generateSketchesCommand } from '../generate-sketches/generate-sketches-command'
import { DEFAULT_IMAGE_MODEL, isGeminiImageModel } from '../../models/model-registry'
import { validateImageSizeForModels } from '../../utils/image-size'
import { getImagePromptVariationLabel } from './prompt-variations'
import {
  COMIC_OUTPUT_ROOT,
  getPanelPromptsDirectory,
  getSceneJsonPath,
  getSceneOutputDirectory,
} from '../../utils/project-paths'
import { assertPanelPromptSourceCoverage } from '../../utils/source-coverage-utils'
import type {
  DraftScenesCommandOptions,
  GenerateComicPagesOptions,
  GenerateImagesTarget,
  GenerateImagesCommandOptions,
  GeneratePanelImagesOptions,
  GenerateSketchesCommandOptions,
  ImageGenerationQuality,
  ImageGenerationSize,
  PanelPromptsCommandOptions,
} from '../../types'



const DEFAULT_IMAGE_SIZE: ImageGenerationSize = '1536x1024'
const DEFAULT_IMAGE_QUALITY: ImageGenerationQuality = 'high'

export type GenerateImagesWorkflowDependencies = {
  runDraftScenes?: (options: DraftScenesCommandOptions) => Promise<void>
  runPanelPrompts?: (options: PanelPromptsCommandOptions) => Promise<void>
  runSketches?: (options: GenerateSketchesCommandOptions) => Promise<void>
  runImages?: (options: GenerateImagesCommandOptions) => Promise<void>
  checkScenesExist?: (sceneSlug: string) => Promise<boolean>
  checkPromptsExist?: (sceneSlug: string) => Promise<boolean>
}

const getGenerateImagesTarget = (target: GenerateImagesCommandOptions['target']): GenerateImagesTarget => {
  return target ?? 'images'
}

const panelPromptsExist = async (sceneSlug: string): Promise<boolean> => {
  const dir = getPanelPromptsDirectory(sceneSlug)
  if (!existsSync(dir)) return false
  const entries = await readdir(dir, { withFileTypes: true })
  return entries.some(entry => entry.isDirectory() && !entry.name.startsWith('.'))
}

export const runFinalPanelImageStage = async (options: GenerateImagesCommandOptions): Promise<void> => {
  const { sceneSlug } = options
  const panelsPerImage = options.panelsPerImage ?? 4
  const usePageMode = panelsPerImage > 1

  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  const size: ImageGenerationSize = options.size ?? DEFAULT_IMAGE_SIZE
  const quality: ImageGenerationQuality = options.quality ?? DEFAULT_IMAGE_QUALITY
  const force = options.force ?? false
  validateImageSizeForModels(size, models)

  l(`${bold('USS Acampo')} - Generating comic ${usePageMode ? 'page' : 'panel'} images for ${sceneSlug}`)
  l(`${cyan('═'.repeat(50))}\n`)

  const startTime = Date.now()
  const stats = {
    init: { success: false, error: '' },
    generateImages: { success: false, error: '' },
  }

  try {
    l(`${cyan('Step 1/2:')} Initializing`)
    l(`${cyan('━'.repeat(50))}\n`)

    await mkdir(getSceneOutputDirectory(sceneSlug), { recursive: true })
    await assertPanelPromptSourceCoverage(sceneSlug)

    l.dim(`Image models: ${models.join(', ')}`)
    l.dim(`Image size: ${size}`)
    l.dim(`Image quality: ${quality}`)
    if (models.some(isGeminiImageModel)) {
      l.dim('Gemini image models map CLI sizes to aspect ratio + 1K and ignore --quality')
    }
    if (options.variations !== undefined) {
      l.dim(`Variations: ${options.variations.map(getImagePromptVariationLabel).join(', ')}`)
    }
    if (usePageMode) {
      const panelSelection = options.panels ?? 'all'
      l.dim(`Panels: ${panelSelection === 'all' ? 'all' : panelSelection.join(', ')}`)
      l.dim(`Panels per image: ${panelsPerImage}`)
    } else {
      if (options.panels) {
        l.dim(`Panels: ${options.panels === 'all' ? 'all' : options.panels.join(', ')}`)
      }
    }
    if (force) {
      l.dim(`Existing comic ${usePageMode ? 'page' : 'panel'} images will be overwritten`)
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
    l(`${cyan('Step 2/2:')} Generating ${usePageMode ? 'page' : 'panel'} images via ${models.join(', ')}`)
    l(`${cyan('━'.repeat(50))}\n`)

    if (usePageMode) {
      const pageOptions: GenerateComicPagesOptions = {
        models,
        size,
        quality,
        force,
        panels: options.panels ?? 'all',
        panelsPerImage,
        ...(options.variations !== undefined ? { variations: options.variations } : {}),
      }
      await generateComicPages(sceneSlug, pageOptions)
    } else {
      const generationOptions: GeneratePanelImagesOptions = {
        models,
        size,
        quality,
        force,
        ...(options.panels !== undefined ? { panels: options.panels } : {}),
        ...(options.variations !== undefined ? { variations: options.variations } : {}),
      }
      await generatePanelImages(sceneSlug, generationOptions)
    }

    stats.generateImages.success = true
    l.success(`${usePageMode ? 'Page' : 'Image'} generation complete`)
    l('')
  } catch (error) {
    stats.generateImages.error = error instanceof Error ? error.message : String(error)
    err(`${usePageMode ? 'Page' : 'Image'} generation failed:`, stats.generateImages.error)
    throw new Error(`Failed at ${usePageMode ? 'page' : 'image'} generation step`)
  }

  const endTime = Date.now()
  const duration = ((endTime - startTime) / 1000).toFixed(2)

  l(`${cyan('═'.repeat(50))}`)
  l(bold(`${usePageMode ? 'Page' : 'Image'} Generation Complete`))
  l(`${cyan('═'.repeat(50))}\n`)

  l(`  ${stats.init.success ? green('✓') : red('✗')} Initialization`)
  l(`  ${stats.generateImages.success ? green('✓') : red('✗')} ${usePageMode ? 'Page' : 'Image'} generation (${models.join(', ')})`)
  l('')

  l.dim(`Output directory: ${COMIC_OUTPUT_ROOT}/${sceneSlug}`)
  l.success(`All operations completed in ${duration}s`)
}

export const generateImagesCommand = async (
  options: GenerateImagesCommandOptions,
  dependencies: GenerateImagesWorkflowDependencies = {}
): Promise<void> => {
  const { sceneSlug } = options
  const target = getGenerateImagesTarget(options.target)
  const runDraftScenes = dependencies.runDraftScenes ?? draftScenesCommand
  const runPanelPrompts = dependencies.runPanelPrompts ?? panelPromptsCommand
  const runSketches = dependencies.runSketches ?? generateSketchesCommand
  const runImages = dependencies.runImages ?? runFinalPanelImageStage

  const checkScenesExist = dependencies.checkScenesExist ?? (async (slug: string) => {
    return existsSync(getSceneJsonPath(slug))
  })
  const checkPromptsExist = dependencies.checkPromptsExist ?? panelPromptsExist

  const shouldRunDraftScenes = options.force === true
    || !(await checkScenesExist(sceneSlug))

  if (shouldRunDraftScenes) {
    await runDraftScenes({
      scriptPath: options.scriptPath,
      sceneSlug,
      ...(options.llmModel ? { llmModel: options.llmModel } : {}),
    })
  } else {
    l.dim('Scene drafts already exist, skipping draft-scenes (use --force to rebuild)')
  }

  const shouldBuildPrompts = target === 'prompts'
    || options.force === true
    || !(await checkPromptsExist(sceneSlug))

  if (shouldBuildPrompts) {
    await runPanelPrompts({
      sceneSlug,
      ...(options.force !== undefined ? { force: options.force } : {}),
    })
  } else {
    l.dim('Panel prompt bundles already exist, skipping rebuild (use --force to rebuild)')
  }

  if (target === 'prompts') {
    return
  }

  const coverageReport = await assertPanelPromptSourceCoverage(sceneSlug)
  l.dim(
    `Panel prompt source coverage verified: ` +
    `${coverageReport.coveredSegments}/${coverageReport.totalSegments} segment(s)`
  )

  if (target === 'sketches' || target === 'both') {
    const sketchPanels = panelSelectionToSketchRange(options.panels)
    await runSketches({
      sceneSlug,
      ...(options.imageModels ? { imageModels: options.imageModels } : {}),
      ...(options.size ? { size: options.size } : {}),
      ...(options.quality ? { quality: options.quality } : {}),
      ...(options.force !== undefined ? { force: options.force } : {}),
      ...(sketchPanels !== undefined ? { sketchPanels } : {}),
    })
  }

  if (target === 'images' || target === 'both') {
    await runImages(options)
  }
}
