import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { err, comicLog, formatDuration } from '../../utils/logger'
import { getPanelPromptsDirectory, getPanelsDirectory } from '../../utils/project-paths'
import {
  createImage,
  createImageRunStats,
  updateImageRunStatsWithCostFallback,
  writeGeneratedImage,
} from '../../image-services'
import {
  extractExpandedScenePromptData,
  getPanelNumberFromName,
  getPromptBundleFilename,
  normalizePromptBundle,
  resolvePrimaryCharacterReferences,
  resolveReferenceImages,
  resolveScenePanelDirectories,
} from '../../utils/panel-prompt-utils'
import { selectComicPanels } from './comic-page-utils'
import { getPanelComicImagePath, loadPromptsConfig } from '../../utils/scene-utils'
import {
  applyImagePromptVariation,
  getImagePromptVariationLabel,
} from './prompt-variations'
import type { GeneratePanelImagesOptions, ImagePromptVariation } from '../../types'



export const generatePanelImages = async (
  sceneSlug: string,
  options: GeneratePanelImagesOptions
) => {
  const stats = createImageRunStats()
  let errorCount = 0
  const useModelSpecificFilenames = options.models.length > 1
  const variations: ImagePromptVariation[] = options.variations ?? ['canonical']
  const useVariationOutputPaths = options.variations !== undefined

  try {
    const prompts = useVariationOutputPaths ? await loadPromptsConfig() : undefined
    const sceneDirectory = getPanelPromptsDirectory(sceneSlug)

    try {
      const sceneEntries = await readdir(sceneDirectory, { withFileTypes: true })
      let panelDirectories = resolveScenePanelDirectories(sceneEntries, sceneDirectory, undefined)

      if (options.panels !== undefined) {
        const panelSources = panelDirectories.map(entry => ({
          panelNumber: getPanelNumberFromName(entry.name)!,
          entry,
        }))
        const selected = selectComicPanels(
          panelSources,
          options.panels,
          undefined,
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
              `Re-run "bun as comic draft-scenes <script-path> --only panel-prompts" ` +
              `after generating any missing character sketches.`
            )
          }

          await mkdir(getPanelsDirectory(sceneSlug), { recursive: true })

          for (const variation of variations) {
            const promptForVariation = prompts
              ? applyImagePromptVariation(normalizedPrompt, variation, prompts)
              : normalizedPrompt

            for (const model of options.models) {
              const outputPath = getPanelComicImagePath(
                sceneSlug,
                panelNumber,
                useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
                useVariationOutputPaths ? variation : undefined
              )
              const resolvedReferences = resolveReferenceImages(panelDirectory, panelEntries, bundleData, model)
              const referenceImages = resolvedReferences.all

              if (!options.force && await Bun.file(outputPath).exists()) {
                stats.imagesSkipped++
                comicLog.output('skipped', 'panel', [
                  `id=panel-${String(panelNumber).padStart(2, '0')}`,
                  `panel=${panelNumber}`,
                  `model=${model}`,
                  useVariationOutputPaths ? `variation=${getImagePromptVariationLabel(variation)}` : undefined,
                  `refs=${referenceImages.length}`,
                  `path=${outputPath}`,
                ])
                continue
              }

              const requestStart = Date.now()
              const imageResponse = await createImage(
                promptForVariation,
                referenceImages,
                model,
                options.size,
                options.quality,
              )
              const requestDurationMs = Date.now() - requestStart
              stats.totalDurationMs += requestDurationMs

              await mkdir(dirname(outputPath), { recursive: true })
              await writeGeneratedImage(
                outputPath,
                imageResponse.result.imageBase64,
                imageResponse.result.mimeType,
              )

              const { costLabel } = updateImageRunStatsWithCostFallback(
                model,
                imageResponse.result.usage,
                stats,
                options.quality,
                options.size,
              )

              comicLog.output('generated', 'panel', [
                `id=panel-${String(panelNumber).padStart(2, '0')}`,
                `panel=${panelNumber}`,
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
            }
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

  } catch (error) {
    err('Fatal error:', error instanceof Error ? error.message : String(error))
    throw error
  }

  if (errorCount > 0) {
    throw new Error(`${errorCount} image generation task(s) failed`)
  }

  return stats
}
