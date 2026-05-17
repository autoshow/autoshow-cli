import type { Dirent } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import * as v from 'valibot'
import { l, err, cyan, bold } from '../../utils/logger'
import { ExpandedScenePromptDataSchema } from '../../schemas/schemas'
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
  formatPanelDirectoryName,
  getPanelNumberFromName,
  getPromptBundleFilename,
  resolvePrimaryCharacterReferencesAcrossPanels,
  resolveScenePanelDirectories,
} from '../../utils/panel-prompt-utils'
import {
  getSketchComicImagePath,
  loadPromptsConfig,
  PANEL_FILENAME_PADDING,
} from '../../utils/scene-utils'
import {
  DEFAULT_PANELS_PER_IMAGE,
  hasOnlyTrailingPanelSelectionMisses,
} from '../generate-images/comic-page-utils'
import { getPanelPromptsDirectory, getSketchesDirectory } from '../../utils/project-paths'
import type {
  ExpandedScenePromptData,
  GenerateSceneSketchesDependencies,
  GenerateSceneSketchesOptions,
  ImageGenerationModel,
  PromptsConfig,
  ResolvedReferenceImages,
  SketchPanelChunk,
  SketchPanelSource,
} from '../../types'


export const SKETCH_CHUNK_SIZE = DEFAULT_PANELS_PER_IMAGE





const formatSketchChunkLabel = (startPanelNumber: number, endPanelNumber: number): string => {
  return `panels-${String(startPanelNumber).padStart(PANEL_FILENAME_PADDING, '0')}-${String(endPanelNumber).padStart(PANEL_FILENAME_PADDING, '0')}`
}

export const chunkSketchPanels = <T extends { panelNumber: number }>(
  panels: T[],
  chunkSize = SKETCH_CHUNK_SIZE
): Array<SketchPanelChunk<T>> => {
  if (chunkSize < 1) {
    throw new Error(`Chunk size must be at least 1, received ${chunkSize}`)
  }

  const chunks: Array<SketchPanelChunk<T>> = []

  for (let index = 0; index < panels.length; index += chunkSize) {
    const chunkPanels = panels.slice(index, index + chunkSize)
    const firstPanel = chunkPanels[0]
    const lastPanel = chunkPanels.at(-1)
    if (!firstPanel || !lastPanel) {
      continue
    }

    chunks.push({
      startPanelNumber: firstPanel.panelNumber,
      endPanelNumber: lastPanel.panelNumber,
      panels: chunkPanels,
    })
  }

  return chunks
}

export const selectSketchPanelRange = <T extends { panelNumber: number }>(
  panels: T[],
  sketchPanels: NonNullable<GenerateSceneSketchesOptions['sketchPanels']>,
  sceneLabel: string
): SketchPanelChunk<T> => {
  if (panels.length === 0) {
    throw new Error(`No sketch panels were found in ${sceneLabel}.`)
  }

  const sortedPanels = [...panels].sort((left, right) => left.panelNumber - right.panelNumber)
  const selectedPanels = sketchPanels === 'all'
    ? sortedPanels
    : sortedPanels.filter(panel => {
      return panel.panelNumber >= sketchPanels.startPanelNumber
        && panel.panelNumber <= sketchPanels.endPanelNumber
    })

  const firstPanel = selectedPanels[0]
  const lastPanel = selectedPanels.at(-1)
  if (!firstPanel || !lastPanel) {
    const rangeLabel = sketchPanels === 'all'
      ? 'all'
      : `${sketchPanels.startPanelNumber}-${sketchPanels.endPanelNumber}`
    throw new Error(`Sketch panel range "${rangeLabel}" was not found in ${sceneLabel}.`)
  }

  if (sketchPanels !== 'all') {
    const availablePanels = new Set(sortedPanels.map(panel => panel.panelNumber))
    const requestedPanels: number[] = []
    for (
      let panelNumber = sketchPanels.startPanelNumber;
      panelNumber <= sketchPanels.endPanelNumber;
      panelNumber++
    ) {
      requestedPanels.push(panelNumber)
    }

    const missingPanels = requestedPanels.filter(panelNumber => !availablePanels.has(panelNumber))
    const selectedPanelNumbers = selectedPanels.map(panel => panel.panelNumber)
    if (missingPanels.length > 0 && !hasOnlyTrailingPanelSelectionMisses(
      requestedPanels,
      selectedPanelNumbers,
      missingPanels
    )) {
      throw new Error(
        `Sketch panel range "${sketchPanels.startPanelNumber}-${sketchPanels.endPanelNumber}" ` +
        `was not found in ${sceneLabel}.`
      )
    }
  }

  return {
    startPanelNumber: firstPanel.panelNumber,
    endPanelNumber: lastPanel.panelNumber,
    panels: selectedPanels,
  }
}

export const resolveSketchChunks = <T extends { panelNumber: number }>(
  panels: T[],
  options: Pick<GenerateSceneSketchesOptions, 'sketchPanels' | 'panelsPerImage'>,
  sceneLabel: string
): {
  allChunks: Array<SketchPanelChunk<T>>
  selectedChunks: Array<SketchPanelChunk<T>>
} => {
  const chunkSize = options.panelsPerImage ?? SKETCH_CHUNK_SIZE

  if (options.sketchPanels !== undefined) {
    const selectedChunk = selectSketchPanelRange(panels, options.sketchPanels, sceneLabel)
    const selectedChunks = chunkSketchPanels(selectedChunk.panels, chunkSize)
    return {
      allChunks: selectedChunks,
      selectedChunks,
    }
  }

  const sketchChunks = chunkSketchPanels(panels, chunkSize)

  return {
    allChunks: sketchChunks,
    selectedChunks: sketchChunks,
  }
}

export const buildSketchPromptData = (
  bundleDataList: ExpandedScenePromptData[]
): ExpandedScenePromptData => {
  if (bundleDataList.length === 0) {
    throw new Error(`Sketch chunks must contain at least 1 panel, found ${bundleDataList.length}`)
  }

  const [firstBundle] = bundleDataList
  if (!firstBundle) {
    throw new Error('Sketch chunks require at least one panel')
  }

  const panels = bundleDataList.map(bundleData => {
    if (bundleData.title !== firstBundle.title || bundleData.location !== firstBundle.location) {
      throw new Error('Sketch chunk panels must share the same title and location')
    }

    const panel = bundleData.panels[0]
    if (!panel) {
      throw new Error('Sketch prompt bundle is missing its panel payload')
    }

    return panel
  })

  return v.parse(ExpandedScenePromptDataSchema, {
    title: firstBundle.title,
    location: firstBundle.location,
    panels,
  })
}

export const assembleSketchPromptDataFromBundleContents = (
  bundleContents: string[]
): ExpandedScenePromptData => {
  return buildSketchPromptData(bundleContents.map(extractExpandedScenePromptData))
}

const preferSketchRefsOverCanonicalRefs = (
  panels: Array<Pick<SketchPanelSource, 'bundleData'>>,
  primaryCharacterRefs: string[],
  sketchCharacterRefs: string[],
  canonicalCharacterRefs: string[]
): string[] => {
  const sketchRefFilenames = new Set(sketchCharacterRefs.map(path => basename(path)))
  const canonicalRefPaths = new Set(canonicalCharacterRefs)
  const canonicalFilenamesCoveredBySketches = new Set<string>()

  panels.forEach(panel => {
    panel.bundleData.panels.forEach(currentPanel => {
      currentPanel.characters.forEach(character => {
        const hasSketchRef = (character.sketchImages ?? [])
          .map(imagePath => basename(imagePath))
          .some(filename => sketchRefFilenames.has(filename))

        if (hasSketchRef) {
          canonicalFilenamesCoveredBySketches.add(basename(character.image))
        }
      })
    })
  })

  return primaryCharacterRefs.filter(referencePath => {
    return !canonicalRefPaths.has(referencePath)
      || !canonicalFilenamesCoveredBySketches.has(basename(referencePath))
  })
}

export const buildSketchPrompt = (
  sketchPromptData: ExpandedScenePromptData,
  sketchPrompts: PromptsConfig['Sketch Prompts']
): string => {
  const sections = [
    sketchPrompts.Prefix?.trim(),
    sketchPrompts.Chunk.trim(),
    [
      'Requirements:',
      '- Produce black-and-white rough sketch output only.',
      '- Use one sub-panel per source panel, in order.',
      '- Label each sub-panel only with its source panel number, as a small boxed numeral in the upper-left corner.',
      '- Do not add panel title cards, shot labels, descriptive headings, or caption banners such as "Wide opening shot..." or "Action panel...".',
      '- Keep visible text limited to story content explicitly present in the panel data, such as speech bubbles, signs, screens, and prop labels.',
      '- Preserve scenery and character staging for each panel.',
      '- Include the exact speech bubble text from each panel\'s speech entries.',
      '- Keep the result at review quality, not polished final art.',
    ].join('\n'),
    `Ordered scene data:\n\`\`\`json\n${JSON.stringify(sketchPromptData, null, 2)}\n\`\`\``,
  ]

  return sections.filter(section => section && section.length > 0).join('\n\n')
}

export const resolveSketchChunkReferences = (
  panels: Array<Pick<SketchPanelSource, 'panelDirectory' | 'panelEntries' | 'bundleData'>>,
  model: ImageGenerationModel
): ResolvedReferenceImages => {
  const primaryCharacterReferenceState = resolvePrimaryCharacterReferencesAcrossPanels(
    panels.map(panel => ({
      panelDirectory: panel.panelDirectory,
      entries: panel.panelEntries,
      bundleData: panel.bundleData,
    }))
  )
  const preferredPrimaryCharacterRefs = preferSketchRefsOverCanonicalRefs(
    panels,
    primaryCharacterReferenceState.primaryCharacterRefs,
    primaryCharacterReferenceState.sketchCharacterRefs,
    primaryCharacterReferenceState.canonicalCharacterRefs,
  )

  return applyReferenceImageLimits(
    preferredPrimaryCharacterRefs,
    preferredPrimaryCharacterRefs,
    primaryCharacterReferenceState.sketchCharacterRefs,
    primaryCharacterReferenceState.canonicalCharacterRefs,
    [],
    [],
    primaryCharacterReferenceState.missingPrimaryCharacterRefs,
    model,
  )
}

const readSketchPanelSource = async (
  sceneDirectory: string,
  panelEntry: Dirent
): Promise<SketchPanelSource> => {
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

export const generateSceneSketches = async (
  sceneSlug: string,
  options: GenerateSceneSketchesOptions,
  dependencies: GenerateSceneSketchesDependencies = {}
) => {
  l(`Generating review sketches from stable panel prompt bundles via ${options.models.join(', ')}`)

  const prompts = await loadPromptsConfig()
  const sketchPrompts = prompts['Sketch Prompts']
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

    try {
      const sceneEntries = await readdir(sceneDirectory, { withFileTypes: true })
      const panelDirectories = resolveScenePanelDirectories(sceneEntries, sceneDirectory, undefined)
      const sketchPanels = await Promise.all(panelDirectories.map(panelEntry => {
        return readSketchPanelSource(sceneDirectory, panelEntry)
      }))
      const { allChunks: sketchChunks, selectedChunks: selectedSketchChunks } = resolveSketchChunks(
        sketchPanels,
        options,
        sceneSlug,
      )

      if (options.sketchPanels !== undefined) {
        const firstSelectedChunk = selectedSketchChunks[0]
        const lastSelectedChunk = selectedSketchChunks.at(-1)
        l.dim(
          `Scene: ${sceneSlug} ` +
          (firstSelectedChunk && lastSelectedChunk
            ? `(${selectedSketchChunks.length} selected sketch chunk${selectedSketchChunks.length !== 1 ? 's' : ''}, ` +
              `${formatSketchChunkLabel(firstSelectedChunk.startPanelNumber, lastSelectedChunk.endPanelNumber)})`
            : '(no selected sketch panels)')
        )
      } else {
        l.dim(
          `Scene: ${sceneSlug} ` +
          `(${sketchChunks.length} sketch chunk${sketchChunks.length !== 1 ? 's' : ''})`
        )
      }

      await mkdir(getSketchesDirectory(sceneSlug), { recursive: true })

      for (const sketchChunk of selectedSketchChunks) {
        const chunkLabel = formatSketchChunkLabel(
          sketchChunk.startPanelNumber,
          sketchChunk.endPanelNumber,
        )

        try {
          const sketchPromptData = buildSketchPromptData(
            sketchChunk.panels.map(panel => panel.bundleData)
          )
          const normalizedPrompt = buildSketchPrompt(sketchPromptData, sketchPrompts)

          for (const model of options.models) {
            const resolvedReferences = resolveSketchChunkReferences(sketchChunk.panels, model)

            if (resolvedReferences.missingPrimaryCharacterRefs.length > 0) {
              throw new Error(
                `Missing character reference images in ${chunkLabel}: ` +
                `${resolvedReferences.missingPrimaryCharacterRefs.join(', ')}. ` +
                `Re-run "bun as comic draft-scenes <script-path> --only panel-prompts" ` +
                `after generating any missing character sketches.`
              )
            }

            const outputPath = getSketchComicImagePath(
              sceneSlug,
              sketchChunk.startPanelNumber,
              sketchChunk.endPanelNumber,
              useModelSpecificFilenames ? model : undefined
            )

            if (!options.force && await Bun.file(outputPath).exists()) {
              stats.imagesSkipped++
              l.dim(`  Sketch chunk:     ${chunkLabel}`)
              l.dim(`  Skipping existing output: ${outputPath}`)
              continue
            }

            const requestStart = Date.now()
            const imageResponse = await requestImage({
              normalizedPrompt,
              referenceImages: resolvedReferences.all,
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

            l.dim(`  Sketch chunk:     ${chunkLabel}`)
            l.dim(`  Source panels:    ${sketchChunk.panels.map(panel => formatPanelDirectoryName(panel.panelNumber)).join(', ')}`)
            l.dim(`  Model:            ${model}`)
            l.dim(`  Mode:             ${imageResponse.mode}`)
            if (imageResponse.inputFidelity) {
              l.dim(`  Input fidelity:   ${imageResponse.inputFidelity}`)
            }
            l.dim(`  References:       ${resolvedReferences.all.length}`)
            if (resolvedReferences.primaryCharacterRefs.length > 0) {
              l.dim(`  Character refs:   ${resolvedReferences.primaryCharacterRefs.map(path => basename(path)).join(', ')}`)
            }
            if (resolvedReferences.sketchCharacterRefs.length > 0) {
              l.dim(`  Sketch refs:      ${resolvedReferences.sketchCharacterRefs.map(path => basename(path)).join(', ')}`)
            }
            if (resolvedReferences.canonicalCharacterRefs.length > 0) {
              l.dim(`  Canonical refs:   ${resolvedReferences.canonicalCharacterRefs.map(path => basename(path)).join(', ')}`)
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
          err(`Failed to generate ${sceneSlug}/${chunkLabel}:`, error instanceof Error ? error.message : String(error))
        }
      }
    } catch (error) {
      errorCount++
      err(`Failed to process scene ${sceneSlug}:`, error instanceof Error ? error.message : String(error))
    }

    l('')
    l.success(`Sketches generated: ${stats.imagesGenerated}`)
    if (stats.imagesSkipped > 0) {
      l.dim(`Sketches skipped: ${stats.imagesSkipped}`)
    }

    if (stats.imagesGenerated > 0) {
      l('')
      l(`${cyan('━'.repeat(50))}`)
      l(bold('Sketch Generation Summary'))
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
    throw new Error(`${errorCount} sketch generation task(s) failed`)
  }

  return stats
}
