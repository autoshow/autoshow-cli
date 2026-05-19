import type { Dirent } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { err, comicLog, formatDuration } from '../../utils/logger'
import {
  createImage,
  createImageRunStats,
  updateImageRunStatsWithCostFallback,
  writeGeneratedImage,
} from '../../image-services'
import {
  applyReferenceImageLimits,
  extractExpandedScenePromptData,
  getPanelNumberFromName,
  getPromptBundleFilename,
  resolvePrimaryCharacterReferencesAcrossPanels,
  resolveScenePanelDirectories,
} from '../../utils/panel-prompt-utils'
import { getPanelPromptsDirectory, getPagesDirectory } from '../../utils/project-paths'
import { getPageComicImagePath, loadPromptsConfig } from '../../utils/scene-utils'
import {
  buildComicPagePrompt,
  buildComicPagePromptData,
  chunkComicPagePanels,
  selectComicPanels,
} from './comic-page-utils'
import {
  applyImagePromptVariation,
  getImagePromptVariationLabel,
} from './prompt-variations'
import type {
  ComicPagePanelSource,
  GenerateComicPagesDependencies,
  GenerateComicPagesOptions,
  ImageGenerationModel,
  ImagePromptVariation,
  ResolvedReferenceImages,
} from '../../types'

const readComicPagePanelSource = async (
  sceneDirectory: string,
  panelEntry: Dirent
): Promise<ComicPagePanelSource> => {
  const panelNumber = getPanelNumberFromName(panelEntry.name)
  if (!panelNumber) {
    throw new Error(`Invalid panel directory name "${panelEntry.name}"`)
  }

  const panelDirectory = join(sceneDirectory, panelEntry.name)
  const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
  const promptFilename = getPromptBundleFilename(panelDirectory, panelEntries)
  const promptContent = await Bun.file(join(panelDirectory, promptFilename)).text()

  if (!promptContent.trim()) {
    throw new Error(`Prompt bundle "${promptFilename}" is empty`)
  }

  return {
    panelDirectory,
    panelEntries,
    panelNumber,
    bundleData: extractExpandedScenePromptData(promptContent),
  }
}

const resolvePageReferences = async (
  panels: ComicPagePanelSource[],
  model: ImageGenerationModel,
  previousPagePath: string | undefined
): Promise<ResolvedReferenceImages> => {
  const primaryCharacterReferenceState = resolvePrimaryCharacterReferencesAcrossPanels(
    panels.map(panel => ({
      panelDirectory: panel.panelDirectory,
      entries: panel.panelEntries,
      bundleData: panel.bundleData,
    }))
  )

  if (primaryCharacterReferenceState.missingPrimaryCharacterRefs.length > 0) {
    throw new Error(
      `Missing character reference images: ` +
      `${primaryCharacterReferenceState.missingPrimaryCharacterRefs.join(', ')}. ` +
      'Generate any missing character sketches, then rebuild stable panel prompt bundles.'
    )
  }

  const priorPageRefs = previousPagePath && await Bun.file(previousPagePath).exists()
    ? [previousPagePath]
    : []
  const orderedReferences = [
    ...priorPageRefs,
    ...primaryCharacterReferenceState.primaryCharacterRefs,
  ]

  return applyReferenceImageLimits(
    orderedReferences,
    primaryCharacterReferenceState.primaryCharacterRefs,
    primaryCharacterReferenceState.sketchCharacterRefs,
    primaryCharacterReferenceState.canonicalCharacterRefs,
    priorPageRefs,
    [],
    primaryCharacterReferenceState.missingPrimaryCharacterRefs,
    model,
  )
}

export const generateComicPages = async (
  sceneSlug: string,
  options: GenerateComicPagesOptions,
  dependencies: GenerateComicPagesDependencies = {}
) => {
  const requestImage = dependencies.requestImage ?? (async input => {
    return createImage(
      input.normalizedPrompt,
      input.referenceImages,
      input.model,
      input.size,
      input.quality,
    )
  })
  const writeImage = dependencies.writeImage ?? writeGeneratedImage
  const stats = createImageRunStats()
  let errorCount = 0
  const useModelSpecificFilenames = options.models.length > 1
  const variations: ImagePromptVariation[] = options.variations ?? ['canonical']
  const useVariationOutputPaths = options.variations !== undefined

  try {
    const prompts = useVariationOutputPaths ? await loadPromptsConfig() : undefined
    const sceneDirectory = getPanelPromptsDirectory(sceneSlug)
    const sceneLabel = sceneSlug

    try {
      const sceneEntries = await readdir(sceneDirectory, { withFileTypes: true })
      const panelDirectories = resolveScenePanelDirectories(sceneEntries, sceneDirectory, undefined)
      const panelSources = await Promise.all(
        panelDirectories.map(panelEntry => readComicPagePanelSource(sceneDirectory, panelEntry))
      )
      const selectedPanels = selectComicPanels(
        panelSources,
        options.panels,
        undefined,
        sceneLabel,
      )
      const pageChunks = chunkComicPagePanels(selectedPanels, options.panelsPerImage)
      const pagesDirectory = getPagesDirectory(sceneSlug)
      const previousPageByModel = new Map<string, string>()

      await mkdir(pagesDirectory, { recursive: true })
      comicLog.line('page inputs', [
        `scene=${sceneSlug}`,
        `panels=${selectedPanels.map(panel => panel.panelNumber).join(',')}`,
        `groups=${pageChunks.length}`,
      ])

      for (const pageChunk of pageChunks) {
        const pagePromptData = buildComicPagePromptData(pageChunk.panels.map(panel => panel.bundleData))
        const normalizedPrompt = buildComicPagePrompt(pagePromptData)

        for (const variation of variations) {
          const promptForVariation = prompts
            ? applyImagePromptVariation(normalizedPrompt, variation, prompts)
            : normalizedPrompt

          for (const model of options.models) {
            const previousPageKey = `${variation}/${model}`
            const outputPath = getPageComicImagePath(
              sceneSlug,
              pageChunk.pageNumber,
              pageChunk.panelNumbers,
              useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
              useVariationOutputPaths ? variation : undefined
            )

            if (!options.force && await Bun.file(outputPath).exists()) {
              stats.imagesSkipped++
              previousPageByModel.set(previousPageKey, outputPath)
              comicLog.output('skipped', 'page', [
                `id=page-${String(pageChunk.pageNumber).padStart(2, '0')}`,
                `panels=${pageChunk.panelNumbers.join('-')}`,
                `model=${model}`,
                useVariationOutputPaths ? `variation=${getImagePromptVariationLabel(variation)}` : undefined,
                'refs=existing',
                `path=${outputPath}`,
              ])
              continue
            }

            try {
              const resolvedReferences = await resolvePageReferences(
                pageChunk.panels,
                model,
                previousPageByModel.get(previousPageKey)
              )
              const referenceImages = resolvedReferences.all
              const requestStart = Date.now()
              const imageResponse = await requestImage({
                normalizedPrompt: promptForVariation,
                referenceImages,
                model,
                size: options.size,
                quality: options.quality,
              })
              const requestDurationMs = Date.now() - requestStart
              stats.totalDurationMs += requestDurationMs

              await mkdir(dirname(outputPath), { recursive: true })
              await writeImage(
                outputPath,
                imageResponse.result.imageBase64,
                imageResponse.result.mimeType,
              )
              previousPageByModel.set(previousPageKey, outputPath)

              const { costLabel } = updateImageRunStatsWithCostFallback(
                model,
                imageResponse.result.usage,
                stats,
                options.quality,
                options.size,
              )

              comicLog.output('generated', 'page', [
                `id=page-${String(pageChunk.pageNumber).padStart(2, '0')}`,
                `panels=${pageChunk.panelNumbers.join('-')}`,
                `model=${model}`,
                useVariationOutputPaths ? `variation=${getImagePromptVariationLabel(variation)}` : undefined,
                `mode=${imageResponse.mode}`,
                imageResponse.inputFidelity ? `fidelity=${imageResponse.inputFidelity}` : undefined,
                `refs=${referenceImages.length}`,
                `cost=${costLabel}`,
                `duration=${formatDuration(requestDurationMs)}`,
                `path=${outputPath}`,
              ])

              stats.imagesGenerated++
            } catch (error) {
              errorCount++
              err(
                `Failed to generate ${sceneLabel}/page-${String(pageChunk.pageNumber).padStart(2, '0')}:`,
                error instanceof Error ? error.message : String(error)
              )
            }
          }
        }
      }
    } catch (error) {
      errorCount++
      err(`Failed to process scene ${sceneLabel}:`, error instanceof Error ? error.message : String(error))
    }

  } catch (error) {
    err('Fatal error:', error instanceof Error ? error.message : String(error))
    throw error
  }

  if (errorCount > 0) {
    throw new Error(`${errorCount} comic page generation task(s) failed`)
  }

  return stats
}
