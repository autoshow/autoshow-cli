import { mkdir, readdir } from 'node:fs/promises'
import { comicLog } from '../../utils/logger'
import { createImageRunStats } from '../../image-services'
import { getPanelPromptsDirectory, getPagesDirectory } from '../../utils/project-paths'
import {
  getPanelNumberFromName,
  resolveScenePanelDirectories,
} from '../../utils/panel-prompt-utils'
import {
  getPageComicImagePath,
  getPanelComicImagePath,
} from '../../utils/scene-utils'
import {
  chunkComicGridPanels,
  getComicGridCapacity,
  selectComicPanels,
} from './comic-page-utils'
import {
  getImagePromptVariationLabel,
} from './prompt-variations'
import { composeComicGridPage } from './comic-grid-composer'
import type {
  ComposeComicGridPageInput,
} from './comic-grid-composer'
import type {
  GenerateComicGridPagesOptions,
  ImagePromptVariation,
} from '../../types'

export type GenerateComicGridPagesDependencies = {
  composeGridPage?: (input: ComposeComicGridPageInput) => Promise<{ width: number; height: number }>
}

const formatGridSpec = (grid: GenerateComicGridPagesOptions['grid']): string => {
  return `${grid.columns}x${grid.rows}`
}

const assertPanelImagesExist = async (
  sceneSlug: string,
  pageNumber: number,
  sourcePaths: string[]
): Promise<void> => {
  const missingPaths: string[] = []
  for (const sourcePath of sourcePaths) {
    if (!await Bun.file(sourcePath).exists()) {
      missingPaths.push(sourcePath)
    }
  }

  if (missingPaths.length > 0) {
    throw new Error(
      `Missing panel PNGs for ${sceneSlug}/page-${String(pageNumber).padStart(2, '0')}:\n` +
      missingPaths.map(path => `  ${path}`).join('\n')
    )
  }
}

export const generateComicGridPages = async (
  sceneSlug: string,
  options: GenerateComicGridPagesOptions,
  dependencies: GenerateComicGridPagesDependencies = {}
) => {
  const composeGridPage = dependencies.composeGridPage ?? composeComicGridPage
  const stats = createImageRunStats()
  const useModelSpecificFilenames = options.models.length > 1
  const variations: ImagePromptVariation[] = options.variations ?? ['canonical']
  const useVariationOutputPaths = options.variations !== undefined
  const capacity = getComicGridCapacity(options.grid)
  const gridLabel = formatGridSpec(options.grid)
  const sceneDirectory = getPanelPromptsDirectory(sceneSlug)
  const sceneEntries = await readdir(sceneDirectory, { withFileTypes: true })
  const panelDirectories = resolveScenePanelDirectories(sceneEntries, sceneDirectory, undefined)
  const panelSources = panelDirectories.map(entry => ({
    panelNumber: getPanelNumberFromName(entry.name)!,
  }))
  const selectedPanels = selectComicPanels(
    panelSources,
    options.panels,
    undefined,
    sceneSlug,
  )
  const gridChunks = chunkComicGridPanels(selectedPanels, options.grid)

  await mkdir(getPagesDirectory(sceneSlug), { recursive: true })
  comicLog.line('grid inputs', [
    `scene=${sceneSlug}`,
    `grid=${gridLabel}`,
    `panels=${selectedPanels.map(panel => panel.panelNumber).join(',')}`,
    `groups=${gridChunks.length}`,
  ])

  for (const gridChunk of gridChunks) {
    for (const variation of variations) {
      for (const model of options.models) {
        const outputPath = getPageComicImagePath(
          sceneSlug,
          gridChunk.pageNumber,
          gridChunk.panelNumbers,
          useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
          useVariationOutputPaths ? variation : undefined
        )

        if (!options.force && await Bun.file(outputPath).exists()) {
          stats.imagesSkipped++
          comicLog.output('skipped', 'grid-page', [
            `id=page-${String(gridChunk.pageNumber).padStart(2, '0')}`,
            `panels=${gridChunk.panelNumbers.join('-')}`,
            `grid=${gridLabel}`,
            `model=${model}`,
            useVariationOutputPaths ? `variation=${getImagePromptVariationLabel(variation)}` : undefined,
            'refs=existing',
            `path=${outputPath}`,
          ])
          continue
        }

        const sourcePaths = gridChunk.panelNumbers.map(panelNumber => {
          return getPanelComicImagePath(
            sceneSlug,
            panelNumber,
            useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
            useVariationOutputPaths ? variation : undefined
          )
        })

        await assertPanelImagesExist(sceneSlug, gridChunk.pageNumber, sourcePaths)
        await composeGridPage({
          sources: sourcePaths,
          outputPath,
          grid: options.grid,
        })

        stats.imagesGenerated++
        comicLog.output('combined', 'grid-page', [
          `id=page-${String(gridChunk.pageNumber).padStart(2, '0')}`,
          `panels=${gridChunk.panelNumbers.join('-')}`,
          `grid=${gridLabel}`,
          `model=${model}`,
          useVariationOutputPaths ? `variation=${getImagePromptVariationLabel(variation)}` : undefined,
          `cells=${sourcePaths.length}/${capacity}`,
          'cost=local/no-cost',
          `path=${outputPath}`,
        ])
      }
    }
  }

  return stats
}
