import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { l, bold, cyan } from './logger'
import { validateImageSizeForModels } from './image-size'
import {
  CHARACTER_SKETCH_VIEWS,
  getCharacterSketchImagePath,
  getUnsupportedCharacterSketchDirectoryFlags,
  resolveCharacterSketchesDirectoryPath,
  resolveCharacterSourceImagePath,
} from '../commands/process-scenes/character-utils'
import {
  describeCharacterSketchSheetSources,
  selectCharacterSketchSheetSources,
} from '../commands/character-sketch/character-sketch-sheet'
import {
  resolveSketchChunks,
} from '../commands/generate-sketches/generate-scene-sketches'
import {
  getGeminiLlmPricing,
} from '../models/gemini-models'
import {
  isGeminiImageModel,
  isGeminiLlmModel,
  isOpenAiLlmModel,
  DEFAULT_LLM_MODEL,
  DEFAULT_IMAGE_MODEL,
} from '../models/model-registry'
import {
  LLM_MODEL_PRICING,
} from '../models/openai-models'
import {
  getPanelComicImagePath,
  getPageComicImagePath,
  getSketchComicImagePath,
} from './scene-utils'
import {
  getSceneJsonPath,
  getDraftPromptPath,
  getPanelPromptsDirectory,
} from './project-paths'
import { estimateImageOutputCost, formatCost } from '../image-services'
import {
  PANEL_DIRECTORY_PATTERN,
  getPanelNumberFromName,
} from './panel-prompt-utils'
import {
  chunkComicPagePanels,
  panelSelectionToSketchRange,
  selectComicPanels,
} from '../commands/generate-images/comic-page-utils'
import {
  getImagePromptVariationLabel,
} from '../commands/generate-images/prompt-variations'
import type {
  CharacterSketchCommandOptions,
  DraftScenesCommandOptions,
  GenerateImagesCommandOptions,
  GenerateSketchesCommandOptions,
  ImageGenerationModel,
  ImageGenerationQuality,
  ImageGenerationSize,
  ImagePromptVariation,
  ModelRow,
  ScenePanelCount,
  SceneSketchCount,
  StructureScriptsCommandOptions,
} from '../types'


const ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL = 800

const estimateTokens = (content: string): number => {
  return Math.ceil(content.length / 4)
}

const estimateLlmCost = (model: DraftScenesCommandOptions['llmModel'], inputTokens: number, outputTokens: number): number => {
  const resolvedModel = model ?? DEFAULT_LLM_MODEL

  if (isOpenAiLlmModel(resolvedModel)) {
    const pricing = LLM_MODEL_PRICING[resolvedModel]
    return (
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output
    )
  }

  if (isGeminiLlmModel(resolvedModel)) {
    const pricing = getGeminiLlmPricing(resolvedModel, inputTokens)
    return (
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output
    )
  }

  throw new Error(`Unsupported LLM model "${resolvedModel}"`)
}

export const estimateSceneDraftPrice = async (options: DraftScenesCommandOptions): Promise<void> => {
  const model = options.llmModel ?? DEFAULT_LLM_MODEL
  const { sceneSlug } = options

  l(`${bold('USS Acampo')} - Price Estimate: draft-scenes --only scene`)
  l(`${cyan('='.repeat(50))}\n`)
  l(`  Model: ${model}`)
  l('')

  const draftPromptPath = getDraftPromptPath(sceneSlug)

  if (!existsSync(draftPromptPath)) {
    l('  No draft prompt file found. Run "bun as comic draft-scenes --only prompt" first.')
    return
  }

  const content = await Bun.file(draftPromptPath).text()
  const tokens = estimateTokens(content)

  l('  Prompt files:')
  l(`    ${sceneSlug}/draft-prompt.md`.padEnd(50, ' ') + `  ~${tokens.toLocaleString()} tokens`)
  l('')

  const totalInputTokens = tokens
  const totalCalls = 1
  const totalOutputTokens = ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL * totalCalls

  l(`  Estimated totals:`)
  l(`    Input:  ~${totalInputTokens.toLocaleString()} tokens (${totalCalls} call)`)
  l(`    Output: ~${totalOutputTokens.toLocaleString()} tokens (~${ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL} tokens per call)`)
  l('')

  const totalCost = estimateLlmCost(model, totalInputTokens, totalOutputTokens)
  const inputCost = estimateLlmCost(model, totalInputTokens, 0)
  const outputCost = estimateLlmCost(model, 0, totalOutputTokens)

  l(`  ${model}:`)
  l(`    Input cost:   ~${formatCost(inputCost)}`)
  l(`    Output cost:  ~${formatCost(outputCost)}`)
  l(`    Total:        ~${formatCost(totalCost)}`)
  l('')
  l.dim('  Estimates: tokens ~ chars / 4, no cache discount, output ~800 tokens/call')
}

export const estimateDraftScenesPrice = async (options: DraftScenesCommandOptions): Promise<void> => {
  const stages = options.only ? [options.only] : ['structure', 'prompt', 'scene'] as const

  if (stages.includes('structure')) {
    await estimateStructureScriptsPrice({
      scriptPath: options.scriptPath,
      sceneSlug: options.sceneSlug,
      ...(options.llmModel ? { llmModel: options.llmModel } : {}),
    })
  }

  if (stages.includes('prompt')) {
    l(`${bold('USS Acampo')} - Price Estimate: draft-scenes --only prompt`)
    l(`${cyan('='.repeat(50))}\n`)
    l('  The prompt-bundle stage makes no LLM or image generation API calls.')
    l('')
  }

  if (stages.includes('scene')) {
    await estimateSceneDraftPrice(options)
  }
}

export const estimateStructureScriptsPrice = async (options: StructureScriptsCommandOptions): Promise<void> => {
  l(`${bold('USS Acampo')} - Price Estimate: draft-scenes --only structure`)
  l(`${cyan('='.repeat(50))}\n`)

  if (!options.llmModel) {
    l('  No --llm-model specified. The structure stage makes no API calls without --llm-model.')
    return
  }

  const model = options.llmModel
  const { scriptPath, sceneSlug } = options
  l(`  Model: ${model}`)
  l('')

  if (!existsSync(scriptPath)) {
    l(`  Script file not found: ${scriptPath}`)
    return
  }

  const content = await Bun.file(scriptPath).text()
  const tokens = estimateTokens(content)

  l('  Script files:')
  l(`    ${sceneSlug}`.padEnd(50, ' ') + `  ~${tokens.toLocaleString()} tokens`)
  l('')

  const totalInputTokens = tokens
  const totalCalls = 1
  const totalOutputTokens = ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL * totalCalls

  l(`  Estimated totals:`)
  l(`    Input:  ~${totalInputTokens.toLocaleString()} tokens (${totalCalls} call)`)
  l(`    Output: ~${totalOutputTokens.toLocaleString()} tokens (~${ESTIMATED_OUTPUT_TOKENS_PER_LLM_CALL} tokens per call)`)
  l('')

  const totalCost = estimateLlmCost(model, totalInputTokens, totalOutputTokens)
  const inputCost = estimateLlmCost(model, totalInputTokens, 0)
  const outputCost = estimateLlmCost(model, 0, totalOutputTokens)

  l(`  ${model}:`)
  l(`    Input cost:   ~${formatCost(inputCost)}`)
  l(`    Output cost:  ~${formatCost(outputCost)}`)
  l(`    Total:        ~${formatCost(totalCost)}`)
  l('')
  l.dim('  Estimates: tokens ~ chars / 4, no cache discount, output ~800 tokens/call')
}

const printImageEstimateTable = (
  models: ImageGenerationModel[],
  quality: ImageGenerationQuality,
  size: ImageGenerationSize,
  totalOutputs: number,
  outputLabel: string
): void => {
  const colWidths = { model: 0 }
  const rows: ModelRow[] = []

  for (const model of models) {
    const qualityLabel = isGeminiImageModel(model) ? 'ignored' : quality
    const modelLabel = `${model} (${qualityLabel})`
    colWidths.model = Math.max(colWidths.model, modelLabel.length)

    const pricePerImage = estimateImageOutputCost(model, quality, size)
    const subtotal = pricePerImage !== null ? pricePerImage * totalOutputs : null
    rows.push({ modelLabel, pricePerImage, subtotal })
  }

  const headerPer = 'per image'
  const headerOutputs = `x ${totalOutputs} ${outputLabel}${totalOutputs !== 1 ? 's' : ''}`
  const headerSubtotal = 'subtotal'

  l(`  ${''.padEnd(colWidths.model + 2)}  ${headerPer.padEnd(12)}  ${headerOutputs.padEnd(14)}  ${headerSubtotal}`)

  let grandTotal = 0
  let hasNullCost = false

  for (const { modelLabel, pricePerImage, subtotal } of rows) {
    const perImageStr = pricePerImage !== null ? formatCost(pricePerImage) : 'n/a'
    const subtotalStr = subtotal !== null ? formatCost(subtotal) : 'n/a'
    l(`  ${modelLabel.padEnd(colWidths.model + 2)}  ${perImageStr.padEnd(12)}               ${subtotalStr}`)
    if (subtotal !== null) {
      grandTotal += subtotal
    } else {
      hasNullCost = true
    }
  }

  l('')
  if (hasNullCost) {
    l(`  Total: ~${formatCost(grandTotal)} + n/a (some models have no per-image estimate)`)
  } else {
    l(`  Total: ~${formatCost(grandTotal)}`)
  }
  l('')
  l.dim('  Per-image output cost only. Token-based input costs are not estimated.')
  if (models.some(isGeminiImageModel)) {
    l.dim('  Gemini costs use estimated1KImage (~$0.067/image) -- actual token costs vary.')
  }
}

export const estimateCharacterSketchPrice = async (
  options: CharacterSketchCommandOptions
): Promise<void> => {
  if (!options.image) {
    throw new Error('--image is required')
  }

  const resolvedSketchesDirectory = resolveCharacterSketchesDirectoryPath(options.image)
  if (resolvedSketchesDirectory) {
    const unsupportedFlags = getUnsupportedCharacterSketchDirectoryFlags(options)
    if (unsupportedFlags.length > 0) {
      throw new Error(
        `${unsupportedFlags.join(', ')} cannot be used when --image points to a character sketch directory`
      )
    }

    const force = options.force ?? false
    const selection = selectCharacterSketchSheetSources(resolvedSketchesDirectory)
    const outputExists = existsSync(selection.outputPath)

    l(`${bold('USS Acampo')} - Price Estimate: character-sketch`)
    l(`${cyan('='.repeat(50))}\n`)
    l(`  Sketch directory: ${resolvedSketchesDirectory}`)
    l(`  Selected variant: ${selection.variant}`)
    l(`  Source sketches:  ${describeCharacterSketchSheetSources(selection)}`)
    l(`  Output:           ${selection.outputPath}`)
    l('')

    if (outputExists && !force) {
      l('  Character sketch sheet already exists. Nothing to combine.')
    } else {
      l(`  Character sketch sheet will be ${outputExists ? 'overwritten' : 'combined'}.`)
    }

    l('')
    l('  Total: $0.0000')
    l('')
    l.dim('  Combining sketch sheets is a local image operation and makes no API calls.')
    return
  }

  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  const size: ImageGenerationSize = options.size ?? '1024x1536'
  const quality: ImageGenerationQuality = options.quality ?? 'medium'
  const force = options.force ?? false
  const useModelSpecificFilenames = models.length > 1
  const resolvedImagePath = resolveCharacterSourceImagePath(options.image)
  validateImageSizeForModels(size, models)

  l(`${bold('USS Acampo')} - Price Estimate: character-sketch`)
  l(`${cyan('='.repeat(50))}\n`)
  l(`  Image:   ${resolvedImagePath}`)
  l(`  Models:  ${models.join(', ')}`)
  l(`  Size:    ${size}  Quality: ${quality}`)
  l('')

  let skipped = 0
  if (!force) {
    for (const view of CHARACTER_SKETCH_VIEWS) {
      const allExist = models.every(model => {
        const outputPath = getCharacterSketchImagePath(
          resolvedImagePath,
          view,
          useModelSpecificFilenames ? model : undefined
        )
        return existsSync(outputPath)
      })

      if (allExist) {
        skipped++
      }
    }
  }

  const totalSketches = CHARACTER_SKETCH_VIEWS.length - skipped

  l('  Sketch views:')
  CHARACTER_SKETCH_VIEWS.forEach(view => {
    const allExist = !force && models.every(model => {
      const outputPath = getCharacterSketchImagePath(
        resolvedImagePath,
        view,
        useModelSpecificFilenames ? model : undefined
      )
      return existsSync(outputPath)
    })

    l(`    ${view.padEnd(40, ' ')}  ${allExist ? 'skipped -- already exists' : 'will generate'}`)
  })
  l('')

  if (totalSketches === 0) {
    l('  All character sketch views already exist. Nothing to generate.')
    return
  }

  printImageEstimateTable(models, quality, size, totalSketches, 'view')
}

const estimateFinalPanelImagesPrice = async (options: GenerateImagesCommandOptions): Promise<void> => {
  const { sceneSlug } = options
  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  const size: ImageGenerationSize = options.size ?? '1536x1024'
  const quality: ImageGenerationQuality = options.quality ?? 'high'
  const force = options.force ?? false
  const panelsPerImage = options.panelsPerImage ?? 4
  const usePageMode = panelsPerImage > 1
  const useModelSpecificFilenames = models.length > 1
  const variations: ImagePromptVariation[] = options.variations ?? ['canonical']
  const useVariationOutputPaths = options.variations !== undefined
  validateImageSizeForModels(size, models)

  l(`${bold('USS Acampo')} - Price Estimate: generate-images${usePageMode ? ' (page mode)' : ''}`)
  l(`${cyan('='.repeat(50))}\n`)
  l(`  Models:  ${models.join(', ')}`)
  if (options.variations !== undefined) {
    l(`  Variations: ${options.variations.map(getImagePromptVariationLabel).join(', ')}`)
  }
  l(`  Size:    ${size}  Quality: ${quality}`)
  if (usePageMode) {
    l(`  Panels per image: ${panelsPerImage}`)
  }
  l('')

  const panelPromptsDir = getPanelPromptsDirectory(sceneSlug)

  if (!existsSync(panelPromptsDir)) {
    l('  No stable panel prompt bundles found. Run "bun as comic generate-images --target prompts" first.')
    return
  }

  const entries = await readdir(panelPromptsDir, { withFileTypes: true })
  const panelNumbers = entries
    .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
    .map(entry => getPanelNumberFromName(entry.name))
    .filter((panelNumber): panelNumber is number => panelNumber !== null)
    .sort((left, right) => left - right)

  if (panelNumbers.length === 0) {
    l('  No panel prompt bundles found.')
    return
  }

  if (usePageMode) {
    const selectedPanels = selectComicPanels(
      panelNumbers.map(panelNumber => ({ panelNumber })),
      options.panels ?? 'all',
      undefined,
      sceneSlug,
    )
    const pageChunks = chunkComicPagePanels(selectedPanels, panelsPerImage)

    let skipped = 0
    if (!force) {
      for (const pageChunk of pageChunks) {
        for (const variation of variations) {
          const allExist = models.every(model => {
            const outputPath = getPageComicImagePath(
              sceneSlug,
              pageChunk.pageNumber,
              pageChunk.panelNumbers,
              useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
              useVariationOutputPaths ? variation : undefined
            )
            return existsSync(outputPath)
          })
          if (allExist) {
            skipped++
          }
        }
      }
    }

    const totalPages = (pageChunks.length * variations.length) - skipped

    l('  Pages:')
    const skipNote = skipped > 0 ? ` (${skipped} skipped -- already exist)` : ''
    l(`    ${sceneSlug.padEnd(40, ' ')}  ${totalPages} page${totalPages !== 1 ? 's' : ''}${skipNote}`)
    l('')

    if (totalPages === 0) {
      l('  All page images already exist. Nothing to generate.')
      return
    }

    printImageEstimateTable(models, quality, size, totalPages, 'page')
    return
  }

  const panelDirs = entries
    .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
    .map(entry => entry.name)
    .sort()

  let panelList = panelDirs
  if (options.panels !== undefined) {
    const availablePanelNumbers = panelDirs
      .map(name => getPanelNumberFromName(name))
      .filter((panelNumber): panelNumber is number => panelNumber !== null)
    const selected = selectComicPanels(
      availablePanelNumbers.map(panelNumber => ({ panelNumber, name: `panel-${String(panelNumber).padStart(2, '0')}` })),
      options.panels,
      undefined,
      sceneSlug,
    )
    panelList = selected.map(s => s.name)
  }

  let skipped = 0
  if (!force) {
    for (const panelDir of panelList) {
      const match = panelDir.match(PANEL_DIRECTORY_PATTERN)
      if (!match?.[1]) continue
      const panelNumber = Number(match[1])
      for (const variation of variations) {
        const allExist = models.every(model => {
          const outputPath = getPanelComicImagePath(
            sceneSlug,
            panelNumber,
            useVariationOutputPaths ? model : useModelSpecificFilenames ? model : undefined,
            useVariationOutputPaths ? variation : undefined
          )
          return existsSync(outputPath)
        })
        if (allExist) skipped++
      }
    }
  }

  const totalPanels = (panelList.length * variations.length) - skipped
  const scenePanelCount: ScenePanelCount = { panels: totalPanels, skipped }

  l('  Panels:')
  const skipNote = scenePanelCount.skipped > 0 ? ` (${scenePanelCount.skipped} skipped -- already exist)` : ''
  l(`    ${sceneSlug.padEnd(40, ' ')}  ${scenePanelCount.panels} panel${scenePanelCount.panels !== 1 ? 's' : ''}${skipNote}`)
  l('')

  if (totalPanels === 0) {
    l('  All panels already exist. Nothing to generate.')
    return
  }

  printImageEstimateTable(models, quality, size, totalPanels, 'panel')
}

export const estimateGenerateSketchesPrice = async (
  options: GenerateSketchesCommandOptions
): Promise<void> => {
  const { sceneSlug } = options
  const models = options.imageModels ?? [DEFAULT_IMAGE_MODEL]
  const size: ImageGenerationSize = options.size ?? '1536x1024'
  const quality: ImageGenerationQuality = options.quality ?? 'low'
  const force = options.force ?? false
  const useModelSpecificFilenames = models.length > 1
  validateImageSizeForModels(size, models)

  l(`${bold('USS Acampo')} - Price Estimate: generate-images --target sketches`)
  l(`${cyan('='.repeat(50))}\n`)
  l(`  Models:  ${models.join(', ')}`)
  l(`  Size:    ${size}  Quality: ${quality}`)
  l('')

  const panelPromptsDir = getPanelPromptsDirectory(sceneSlug)

  if (!existsSync(panelPromptsDir)) {
    l('  No stable panel prompt bundles found. Run "bun as comic generate-images --target prompts" first.')
    return
  }

  const entries = await readdir(panelPromptsDir, { withFileTypes: true })
  const panelNumbers = entries
    .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
    .map(entry => getPanelNumberFromName(entry.name))
    .filter((panelNumber): panelNumber is number => panelNumber !== null)
    .sort((left, right) => left - right)

  if (panelNumbers.length === 0) {
    l('  No panel prompt bundles found.')
    return
  }

  const { selectedChunks: selectedSketchChunks } = resolveSketchChunks(
    panelNumbers.map(panelNumber => ({ panelNumber })),
    {
      ...(options.sketchPanels !== undefined ? { sketchPanels: options.sketchPanels } : {}),
    },
    sceneSlug,
  )

  let skipped = 0
  if (!force) {
    for (const sketchChunk of selectedSketchChunks) {
      const allExist = models.every(model => {
        const outputPath = getSketchComicImagePath(
          sceneSlug,
          sketchChunk.startPanelNumber,
          sketchChunk.endPanelNumber,
          useModelSpecificFilenames ? model : undefined
        )
        return existsSync(outputPath)
      })
      if (allExist) {
        skipped++
      }
    }
  }

  const totalSketches = selectedSketchChunks.length - skipped
  const explicitSketchChunk = options.sketchPanels !== undefined && options.sketchPanels !== 'all'
    ? selectedSketchChunks[0]
    : undefined
  const label = explicitSketchChunk
    ? `${sceneSlug}/panels-${String(explicitSketchChunk.startPanelNumber).padStart(2, '0')}-${String(explicitSketchChunk.endPanelNumber).padStart(2, '0')}`
    : options.sketchPanels === 'all'
      ? `${sceneSlug}/all-panels`
      : sceneSlug
  const sceneSketchCount: SceneSketchCount = { label, sketches: totalSketches, skipped }

  l('  Sketch chunks:')
  const skipNote = sceneSketchCount.skipped > 0 ? ` (${sceneSketchCount.skipped} skipped -- already exist)` : ''
  l(`    ${sceneSketchCount.label.padEnd(40, ' ')}  ${sceneSketchCount.sketches} sketch${sceneSketchCount.sketches !== 1 ? 'es' : ''}${skipNote}`)
  l('')

  if (totalSketches === 0) {
    l('  All sketch chunks already exist. Nothing to generate.')
    return
  }

  printImageEstimateTable(models, quality, size, totalSketches, 'sketch')
}

export const estimateGenerateImagesPrice = async (
  options: GenerateImagesCommandOptions
): Promise<void> => {
  const { sceneSlug } = options
  const sceneJsonExists = existsSync(getSceneJsonPath(sceneSlug))

  if (!sceneJsonExists || options.force) {
    await estimateStructureScriptsPrice({
      scriptPath: options.scriptPath,
      sceneSlug: options.sceneSlug,
      ...(options.llmModel ? { llmModel: options.llmModel } : {}),
    })

    try {
      await estimateSceneDraftPrice({
        scriptPath: options.scriptPath,
        sceneSlug: options.sceneSlug,
        ...(options.llmModel ? { llmModel: options.llmModel } : {}),
      })
    } catch (error) {
      l(`${bold('USS Acampo')} - Price Estimate: draft-scenes (auto-detected)`)
      l(`${cyan('='.repeat(50))}\n`)
      l(
        '  Scene LLM cost cannot be estimated until the draft prompt bundle exists. ' +
        'Run "bun as comic draft-scenes --only prompt" first, or use the structure estimate above as a lower bound.'
      )
      l.dim(`  Detail: ${error instanceof Error ? error.message : String(error)}`)
      l('')
    }
  }

  const target = options.target ?? 'images'

  if (target === 'prompts') {
    l(`${bold('USS Acampo')} - Price Estimate: generate-images --target prompts`)
    l(`${cyan('='.repeat(50))}\n`)
    l('  The panel-prompt stage makes no LLM or image generation API calls.')
    return
  }

  if (target === 'sketches' || target === 'both') {
    const sketchPanels = panelSelectionToSketchRange(options.panels)
    await estimateGenerateSketchesPrice({
      sceneSlug: options.sceneSlug,
      ...(options.imageModels ? { imageModels: options.imageModels } : {}),
      ...(options.size ? { size: options.size } : {}),
      ...(options.quality ? { quality: options.quality } : {}),
      ...(options.force !== undefined ? { force: options.force } : {}),
      ...(sketchPanels !== undefined ? { sketchPanels } : {}),
    })
  }

  if (target === 'images' || target === 'both') {
    await estimateFinalPanelImagesPrice(options)
  }
}

export const estimateNoCostCommandPrice = (commandName: string): void => {
  l(`${bold('USS Acampo')} - Price Estimate: ${commandName}`)
  l(`${cyan('='.repeat(50))}\n`)
  l(`  ${commandName} makes no LLM or image generation API calls.`)
}
