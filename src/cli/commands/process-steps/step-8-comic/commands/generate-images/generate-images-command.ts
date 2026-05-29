import { existsSync } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { err, comicLog, formatCompactCost, formatDuration } from '../../utils/logger'
import { generatePanelImages } from './generate-panel-images'
import { generateComicPages } from './generate-comic-pages'
import { generateComicGridPages } from './generate-comic-grid-pages'
import {
  COMIC_GRID_PANEL_SIZE,
  DEFAULT_PANELS_PER_IMAGE,
  panelSelectionToSketchRange,
  validateComicGridOptions,
} from './comic-page-utils'
import { draftScenesCommand } from '../draft-scenes/draft-scenes-command'
import { panelPromptsCommand } from '../panel-prompts/panel-prompts-command'
import { generateSketchesCommand } from '../generate-sketches/generate-sketches-command'
import { DEFAULT_IMAGE_MODEL } from '../../models/model-registry'
import { validateImageSizeForModels } from '../../utils/image-size'
import { getImagePromptVariationLabel } from './prompt-variations'
import {
  getPanelPromptsDirectory,
  getSceneJsonPath,
  getSceneOutputDirectory,
} from '../../utils/project-paths'
import { assertPanelPromptSourceCoverage } from '../../utils/source-coverage-utils'
import type {
  ImageRunStats,
  ImageGenerationQuality,
  ImageGenerationSize,
} from '../../types/comic-types'
import type {
  DraftScenesCommandOptions,
  GenerateComicPagesOptions,
  GenerateImagesTarget,
  GenerateImagesCommandOptions,
  GeneratePanelImagesOptions,
  GenerateSketchesCommandOptions,
  PanelPromptsCommandOptions,
} from '../../types/comic-command-types'
import type { SourceCoverageReport } from '../../utils/source-coverage-utils'



const DEFAULT_IMAGE_SIZE: ImageGenerationSize = COMIC_GRID_PANEL_SIZE
const DEFAULT_IMAGE_QUALITY: ImageGenerationQuality = 'high'

type GenerateImagesWorkflowDependencies = {
  runDraftScenes?: (options: DraftScenesCommandOptions) => Promise<unknown>
  runPanelPrompts?: (options: PanelPromptsCommandOptions) => Promise<unknown>
  runSketches?: (options: GenerateSketchesCommandOptions) => Promise<ImageRunStats | void>
  runImages?: (options: GenerateImagesCommandOptions) => Promise<ImageRunStats | void>
  checkScenesExist?: (sceneSlug: string) => Promise<boolean>
  checkPromptsExist?: (sceneSlug: string) => Promise<boolean>
  checkPanelPromptSourceCoverage?: (sceneSlug: string) => Promise<SourceCoverageReport>
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

const createEmptyImageStats = (): ImageRunStats => ({
  imagesGenerated: 0,
  imagesSkipped: 0,
  totalInputTokens: 0,
  totalInputTextTokens: 0,
  totalInputImageTokens: 0,
  totalInputUnattributedTokens: 0,
  totalOutputTokens: 0,
  totalOutputTextTokens: 0,
  totalOutputImageTokens: 0,
  totalOutputUnattributedTokens: 0,
  totalCost: 0,
  totalDurationMs: 0,
})

const mergeImageStats = (target: ImageRunStats, source: ImageRunStats | void): void => {
  if (!source) return

  target.imagesGenerated += source.imagesGenerated
  target.imagesSkipped += source.imagesSkipped
  target.totalInputTokens += source.totalInputTokens
  target.totalInputTextTokens += source.totalInputTextTokens
  target.totalInputImageTokens += source.totalInputImageTokens
  target.totalInputUnattributedTokens += source.totalInputUnattributedTokens
  target.totalOutputTokens += source.totalOutputTokens
  target.totalOutputTextTokens += source.totalOutputTextTokens
  target.totalOutputImageTokens += source.totalOutputImageTokens
  target.totalOutputUnattributedTokens += source.totalOutputUnattributedTokens
  target.totalCost += source.totalCost
  target.totalDurationMs += source.totalDurationMs
}

const formatPanelSelection = (panels: GenerateImagesCommandOptions['panels']): string => {
  if (!panels || panels === 'all') return 'all'
  return panels.join(',')
}

const runFinalPanelImageStage = async (options: GenerateImagesCommandOptions): Promise<ImageRunStats> => {
  const { sceneSlug } = options
  const panelsPerImage = options.panelsPerImage ?? DEFAULT_PANELS_PER_IMAGE
  const usePageMode = !options.grid && panelsPerImage > 1
  const stageLabel = options.grid ? 'Grid' : usePageMode ? 'Page' : 'Image'

  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  const size: ImageGenerationSize = options.size ?? DEFAULT_IMAGE_SIZE
  const quality: ImageGenerationQuality = options.quality ?? DEFAULT_IMAGE_QUALITY
  const force = options.force ?? false
  validateImageSizeForModels(size, models)
  validateComicGridOptions(options.grid, {
    target: 'images',
    size,
    panelsPerImage,
  })

  try {
    await mkdir(getSceneOutputDirectory(sceneSlug), { recursive: true })
    await assertPanelPromptSourceCoverage(sceneSlug)
  } catch (error) {
    err('Image initialization failed:', error instanceof Error ? error.message : String(error))
    throw new Error('Failed at initialization step')
  }

  try {
    if (options.grid) {
      const panelStats = await generatePanelImages(sceneSlug, {
        models,
        size,
        quality,
        force,
        ...(options.panels !== undefined ? { panels: options.panels } : {}),
        ...(options.variations !== undefined ? { variations: options.variations } : {}),
      })
      const gridStats = await generateComicGridPages(sceneSlug, {
        models,
        force,
        panels: options.panels ?? 'all',
        grid: options.grid,
        ...(options.variations !== undefined ? { variations: options.variations } : {}),
      })
      mergeImageStats(panelStats, gridStats)
      return panelStats
    }

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
      return await generateComicPages(sceneSlug, pageOptions)
    } else {
      const generationOptions: GeneratePanelImagesOptions = {
        models,
        size,
        quality,
        force,
        ...(options.panels !== undefined ? { panels: options.panels } : {}),
        ...(options.variations !== undefined ? { variations: options.variations } : {}),
      }
      return await generatePanelImages(sceneSlug, generationOptions)
    }
  } catch (error) {
    err(`${stageLabel} generation failed:`, error instanceof Error ? error.message : String(error))
    throw new Error(`Failed at ${options.grid ? 'grid' : usePageMode ? 'page' : 'image'} generation step`)
  }
}

export const generateImagesCommand = async (
  options: GenerateImagesCommandOptions,
  dependencies: GenerateImagesWorkflowDependencies = {}
): Promise<void> => {
  const { sceneSlug } = options
  const target = getGenerateImagesTarget(options.target)
  const runDraftScenes = dependencies.runDraftScenes ?? ((opts: DraftScenesCommandOptions) => draftScenesCommand(opts, {}, 'nested'))
  const runPanelPrompts = dependencies.runPanelPrompts ?? panelPromptsCommand
  const runSketches = dependencies.runSketches ?? generateSketchesCommand
  const runImages = dependencies.runImages ?? runFinalPanelImageStage
  const checkPanelPromptSourceCoverage = dependencies.checkPanelPromptSourceCoverage ?? assertPanelPromptSourceCoverage
  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  const size: ImageGenerationSize = options.size ?? DEFAULT_IMAGE_SIZE
  const quality: ImageGenerationQuality = options.quality ?? DEFAULT_IMAGE_QUALITY
  const panelsPerImage = options.panelsPerImage ?? DEFAULT_PANELS_PER_IMAGE
  const startedAt = Date.now()
  const totals = createEmptyImageStats()

  validateImageSizeForModels(size, models)
  validateComicGridOptions(options.grid, {
    target,
    size,
    panelsPerImage,
  })
  comicLog.header('comic generate-images', [
    `scene=${sceneSlug}`,
    `target=${target}`,
  ])

  const checkScenesExist = dependencies.checkScenesExist ?? (async (slug: string) => {
    return existsSync(getSceneJsonPath(slug))
  })
  const checkPromptsExist = dependencies.checkPromptsExist ?? panelPromptsExist

  const shouldRunDraftScenes = options.force === true
    || !(await checkScenesExist(sceneSlug))
  let draftStatus = 'existing'
  let promptStatus = 'existing'

  if (shouldRunDraftScenes) {
    await runDraftScenes({
      scriptPath: options.scriptPath,
      sceneSlug,
      ...(options.llmModel ? { llmModel: options.llmModel } : {}),
    })
    draftStatus = 'rebuilt'
    promptStatus = 'from-draft-scenes'
  }

  const shouldBuildPrompts = !shouldRunDraftScenes
    && (
      options.force === true
      || !(await checkPromptsExist(sceneSlug))
    )

  if (shouldRunDraftScenes) {
    promptStatus = 'from-draft-scenes'
  } else if (shouldBuildPrompts) {
    await runPanelPrompts({
      sceneSlug,
      ...(options.force !== undefined ? { force: options.force } : {}),
    })
    promptStatus = 'rebuilt'
  }

  const coverageReport = await checkPanelPromptSourceCoverage(sceneSlug)
  comicLog.line('inputs ready', [
    `draft=${draftStatus}`,
    `prompts=${promptStatus}`,
    `coverage=${coverageReport.coveredSegments}/${coverageReport.totalSegments}`,
  ])
  comicLog.line('config', [
    `target=${target}`,
    `models=${models.join(',')}`,
    `size=${size}`,
    `quality=${quality}`,
    `panels=${formatPanelSelection(options.panels)}`,
    `panelsPerImage=${panelsPerImage}`,
    options.grid ? `grid=${options.grid.columns}x${options.grid.rows}` : undefined,
    options.variations !== undefined
      ? `variations=${options.variations.map(getImagePromptVariationLabel).join(',')}`
      : undefined,
    options.force ? 'force=true' : undefined,
  ])

  if (target === 'sketches' || target === 'both') {
    const sketchPanels = panelSelectionToSketchRange(options.panels)
    const sketchStats = await runSketches({
      sceneSlug,
      imageModels: models,
      size,
      quality,
      ...(options.force !== undefined ? { force: options.force } : {}),
      ...(sketchPanels !== undefined ? { sketchPanels } : {}),
      panelsPerImage,
    })
    mergeImageStats(totals, sketchStats)
  }

  if (target === 'images' || target === 'both') {
    const imageStats = await runImages({
      ...options,
      imageModels: models,
      size,
      quality,
      panelsPerImage,
    })
    mergeImageStats(totals, imageStats)
  }

  comicLog.summary([
    `generated=${totals.imagesGenerated}`,
    `skipped=${totals.imagesSkipped}`,
    `tokens=${(totals.totalInputTokens + totals.totalOutputTokens).toLocaleString()}`,
    `cost=${formatCompactCost(totals.totalCost)}`,
    `api=${formatDuration(totals.totalDurationMs)}`,
    `duration=${formatDuration(Date.now() - startedAt)}`,
  ])
  comicLog.outputDirectory(getSceneOutputDirectory(sceneSlug))
}
