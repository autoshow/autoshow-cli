import { mkdir, readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { l, err, cyan, bold } from '../../utils/logger'
import { getPanelPromptsDirectory, getPanelsDirectory } from '../../utils/project-paths'
import {
  createImage,
  createImageRunStats,
  estimateImageOutputCost,
  formatCost,
  logUsageAndUpdateStats,
  writeGeneratedImage,
} from '../../image-services'
import {
  extractExpandedScenePromptData,
  formatPanelDirectoryName,
  getPanelNumberFromName,
  getPromptBundleFilename,
  normalizePromptBundle,
  resolvePrimaryCharacterReferences,
  resolveReferenceImages,
  resolveScenePanelDirectories,
} from '../../utils/panel-prompt-utils'
import { selectComicPanels } from './comic-page-utils'
import { getPanelComicImagePath } from '../../utils/scene-utils'
import type { GeneratePanelImagesOptions } from '../../types'



export const generatePanelImages = async (
  sceneSlug: string,
  options: GeneratePanelImagesOptions
) => {
  l(`Generating comic panel images from stable panel prompt bundles via ${options.models.join(', ')}`)

  const stats = createImageRunStats()
  let errorCount = 0
  let estimatedCostRequests = 0
  const useModelSpecificFilenames = options.models.length > 1

  try {
    const sceneDirectory = getPanelPromptsDirectory(sceneSlug)
    l.dim(`Scene: ${sceneSlug}${options.panel ? ` (${formatPanelDirectoryName(options.panel)})` : ''}`)

    try {
      const sceneEntries = await readdir(sceneDirectory, { withFileTypes: true })
      let panelDirectories = resolveScenePanelDirectories(sceneEntries, sceneDirectory, options.panel)

      if (options.panels !== undefined || options.panelLimit !== undefined) {
        const panelSources = panelDirectories.map(entry => ({
          panelNumber: getPanelNumberFromName(entry.name)!,
          entry,
        }))
        const selected = selectComicPanels(
          panelSources,
          options.panels ?? 'all',
          options.panelLimit,
          sceneSlug,
        )
        panelDirectories = selected.map(s => s.entry)
      }

      for (const panelEntry of panelDirectories) {
        const panelNumber = getPanelNumberFromName(panelEntry.name)
        if (!panelNumber) {
          throw new Error(`Invalid panel directory name "${panelEntry.name}"`)
        }

        const panelDirectory = join(sceneDirectory, panelEntry.name)

        try {
          const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
          const promptFilename = getPromptBundleFilename(panelDirectory, panelEntries)
          const promptContent = await Bun.file(join(panelDirectory, promptFilename)).text()

          if (!promptContent.trim()) {
            throw new Error(`Prompt bundle "${promptFilename}" is empty`)
          }

          const normalizedPrompt = normalizePromptBundle(promptContent)
          if (!normalizedPrompt) {
            throw new Error(`Prompt bundle "${promptFilename}" became empty after normalization`)
          }

          const bundleData = extractExpandedScenePromptData(promptContent)
          const primaryCharacterReferenceState = resolvePrimaryCharacterReferences(
            panelDirectory,
            panelEntries,
            bundleData,
          )
          if (primaryCharacterReferenceState.missingPrimaryCharacterRefs.length > 0) {
            throw new Error(
              `Missing character reference images in ${panelEntry.name}: ` +
              `${primaryCharacterReferenceState.missingPrimaryCharacterRefs.join(', ')}. ` +
              `Re-run "bun as comic generate-images --target prompts --scene ${sceneSlug}" ` +
              `after generating any missing character sketches.`
            )
          }

          await mkdir(getPanelsDirectory(sceneSlug), { recursive: true })

          for (const model of options.models) {
            const outputPath = getPanelComicImagePath(
              sceneSlug,
              panelNumber,
              useModelSpecificFilenames ? model : undefined
            )
            const resolvedReferences = resolveReferenceImages(panelDirectory, panelEntries, bundleData, model)
            const referenceImages = resolvedReferences.all

            if (!options.force && await Bun.file(outputPath).exists()) {
              stats.imagesSkipped++
              l.dim(`  Skipping existing output: ${outputPath}`)
              continue
            }

            const requestStart = Date.now()
            const imageResponse = await createImage(
              normalizedPrompt,
              referenceImages,
              model,
              options.size,
              options.quality,
            )
            const requestDurationMs = Date.now() - requestStart
            stats.totalDurationMs += requestDurationMs

            await writeGeneratedImage(
              outputPath,
              imageResponse.result.imageBase64,
              imageResponse.result.mimeType,
            )

            l.dim(`  Model:            ${model}`)
            l.dim(`  Mode:             ${imageResponse.mode}`)
            if (imageResponse.inputFidelity) {
              l.dim(`  Input fidelity:   ${imageResponse.inputFidelity}`)
            }
            l.dim(`  References:       ${referenceImages.length}`)
            if (resolvedReferences.primaryCharacterRefs.length > 0) {
              l.dim(`  Character refs:   ${resolvedReferences.primaryCharacterRefs.map(path => basename(path)).join(', ')}`)
            }
            if (resolvedReferences.sketchCharacterRefs.length > 0) {
              l.dim(`  Sketch refs:      ${resolvedReferences.sketchCharacterRefs.map(path => basename(path)).join(', ')}`)
            }
            if (resolvedReferences.canonicalCharacterRefs.length > 0) {
              l.dim(`  Canonical refs:   ${resolvedReferences.canonicalCharacterRefs.map(path => basename(path)).join(', ')}`)
            }
            if (resolvedReferences.priorPanelRefs.length > 0) {
              l.dim(`  Prior panel refs: ${resolvedReferences.priorPanelRefs.map(path => basename(path)).join(', ')}`)
            }
            if (resolvedReferences.secondaryRefs.length > 0) {
              l.dim(`  Other refs:       ${resolvedReferences.secondaryRefs.map(path => basename(path)).join(', ')}`)
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
          }
        } catch (error) {
          errorCount++
          err(`Failed to generate ${sceneSlug}/${panelEntry.name}:`, error instanceof Error ? error.message : String(error))
        }
      }
    } catch (error) {
      errorCount++
      err(`Failed to process scene ${sceneSlug}:`, error instanceof Error ? error.message : String(error))
    }

    l('')
    l.success(`Images generated: ${stats.imagesGenerated}`)
    if (stats.imagesSkipped > 0) {
      l.dim(`Images skipped: ${stats.imagesSkipped}`)
    }

    if (stats.imagesGenerated > 0) {
      l('')
      l(`${cyan('━'.repeat(50))}`)
      l(bold('Image Generation Summary'))
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
    throw new Error(`${errorCount} image generation task(s) failed`)
  }

  return stats
}
