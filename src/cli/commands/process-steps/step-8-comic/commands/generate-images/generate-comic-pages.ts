import type { Dirent } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { l, err, cyan, bold } from '../../utils/logger'
import {
  createImage,
  createImageRunStats,
  estimateImageOutputCost,
  formatCost,
  logUsageAndUpdateStats,
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
import { getPageComicImagePath } from '../../utils/scene-utils'
import {
  buildComicPagePrompt,
  buildComicPagePromptData,
  chunkComicPagePanels,
  selectComicPanels,
} from './comic-page-utils'
import type {
  ComicPagePanelSource,
  GenerateComicPagesDependencies,
  GenerateComicPagesOptions,
  ImageGenerationModel,
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
  l(`Generating comic page images from stable panel prompt bundles via ${options.models.join(', ')}`)

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
  let estimatedCostRequests = 0
  const useModelSpecificFilenames = options.models.length > 1

  try {
    const sceneDirectory = getPanelPromptsDirectory(sceneSlug)
    const sceneLabel = sceneSlug
    l.dim(`Scene: ${sceneSlug}`)

    try {
      const sceneEntries = await readdir(sceneDirectory, { withFileTypes: true })
      const panelDirectories = resolveScenePanelDirectories(sceneEntries, sceneDirectory, undefined)
      const panelSources = await Promise.all(
        panelDirectories.map(panelEntry => readComicPagePanelSource(sceneDirectory, panelEntry))
      )
      const selectedPanels = selectComicPanels(
        panelSources,
        options.panels,
        options.panelLimit,
        sceneLabel,
      )
      const pageChunks = chunkComicPagePanels(selectedPanels, options.panelsPerImage)
      const pagesDirectory = getPagesDirectory(sceneSlug)
      const previousPageByModel = new Map<ImageGenerationModel, string>()

      await mkdir(pagesDirectory, { recursive: true })
      l.dim(`  Selected panels: ${selectedPanels.map(panel => panel.panelNumber).join(', ')}`)
      l.dim(`  Page groups:     ${pageChunks.length}`)

      for (const pageChunk of pageChunks) {
        const pagePromptData = buildComicPagePromptData(pageChunk.panels.map(panel => panel.bundleData))
        const normalizedPrompt = buildComicPagePrompt(pagePromptData)

        for (const model of options.models) {
          const outputPath = getPageComicImagePath(
            sceneSlug,
            pageChunk.pageNumber,
            pageChunk.panelNumbers,
            useModelSpecificFilenames ? model : undefined
          )

          if (!options.force && await Bun.file(outputPath).exists()) {
            stats.imagesSkipped++
            previousPageByModel.set(model, outputPath)
            l.dim(`  Skipping existing output: ${outputPath}`)
            continue
          }

          try {
            const resolvedReferences = await resolvePageReferences(
              pageChunk.panels,
              model,
              previousPageByModel.get(model)
            )
            const referenceImages = resolvedReferences.all
            const requestStart = Date.now()
            const imageResponse = await requestImage({
              normalizedPrompt,
              referenceImages,
              model,
              size: options.size,
              quality: options.quality,
            })
            const requestDurationMs = Date.now() - requestStart
            stats.totalDurationMs += requestDurationMs

            await writeImage(
              outputPath,
              imageResponse.result.imageBase64,
              imageResponse.result.mimeType,
            )
            previousPageByModel.set(model, outputPath)

            l.dim(`  Page:             ${String(pageChunk.pageNumber).padStart(2, '0')}`)
            l.dim(`  Source panels:    ${pageChunk.panelNumbers.join(', ')}`)
            l.dim(`  Model:            ${model}`)
            l.dim(`  Mode:             ${imageResponse.mode}`)
            if (imageResponse.inputFidelity) {
              l.dim(`  Input fidelity:   ${imageResponse.inputFidelity}`)
            }
            l.dim(`  References:       ${referenceImages.length}`)
            if (resolvedReferences.primaryCharacterRefs.length > 0) {
              l.dim(`  Character refs:   ${resolvedReferences.primaryCharacterRefs.map(path => basename(path)).join(', ')}`)
            }
            if (resolvedReferences.priorPanelRefs.length > 0) {
              l.dim(`  Continuity refs:  ${resolvedReferences.priorPanelRefs.map(path => basename(path)).join(', ')}`)
            }
            l.dim(`  Size:             ${imageResponse.result.providerSizeLabel ?? options.size}`)
            l.dim(`  Quality:          ${imageResponse.result.providerQualityLabel ?? options.quality}`)
            if (imageResponse.result.mimeType && imageResponse.result.mimeType !== 'image/png') {
              l.dim(`  Source MIME:      ${imageResponse.result.mimeType} (normalized to PNG)`)
            }

            const usageCost = logUsageAndUpdateStats(model, imageResponse.result.usage, stats)
            if (usageCost === null) {
              const estimatedCost = estimateImageOutputCost(model, options.quality, options.size)
              const costUnavailableReason = imageResponse.result.usage
                ? 'no usable modality breakdown was returned'
                : 'no usage data returned'

              if (estimatedCost !== null) {
                stats.totalCost += estimatedCost
                estimatedCostRequests++
                l.dim(`  Cost:             ${formatCost(estimatedCost)} (estimated output only; ${costUnavailableReason})`)
              } else {
                l.dim(`  Cost:             unavailable (${costUnavailableReason})`)
              }
            }

            l.dim(`  Duration:         ${(requestDurationMs / 1000).toFixed(2)}s`)
            l.dim(`  Wrote:            ${outputPath}`)

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
    } catch (error) {
      errorCount++
      err(`Failed to process scene ${sceneLabel}:`, error instanceof Error ? error.message : String(error))
    }

    l('')
    l.success(`Page images generated: ${stats.imagesGenerated}`)
    if (stats.imagesSkipped > 0) {
      l.dim(`Page images skipped: ${stats.imagesSkipped}`)
    }

    if (stats.imagesGenerated > 0) {
      l('')
      l(`${cyan('━'.repeat(50))}`)
      l(bold('Comic Page Image Summary'))
      l(`${cyan('━'.repeat(50))}`)
      l.dim(
        `  Total input tokens:  ${stats.totalInputTokens.toLocaleString()} ` +
        `(${[
          `${stats.totalInputTextTokens.toLocaleString()} text`,
          `${stats.totalInputImageTokens.toLocaleString()} image`,
          ...(stats.totalInputUnattributedTokens > 0
            ? [`${stats.totalInputUnattributedTokens.toLocaleString()} unattributed`]
            : []),
        ].join(', ')})`
      )
      l.dim(
        `  Total output tokens: ${stats.totalOutputTokens.toLocaleString()} ` +
        `(${[
          `${stats.totalOutputTextTokens.toLocaleString()} text`,
          `${stats.totalOutputImageTokens.toLocaleString()} image`,
          ...(stats.totalOutputUnattributedTokens > 0
            ? [`${stats.totalOutputUnattributedTokens.toLocaleString()} unattributed`]
            : []),
        ].join(', ')})`
      )
      l.dim(`  Total tokens:        ${(stats.totalInputTokens + stats.totalOutputTokens).toLocaleString()}`)
      l.dim(`  Total cost:          ${formatCost(stats.totalCost)}`)
      if (estimatedCostRequests > 0) {
        l.dim(`  Cost estimate note:  ${estimatedCostRequests} request(s) used output-only estimates`)
      }
      l.dim(`  Total API time:      ${(stats.totalDurationMs / 1000).toFixed(2)}s`)
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
