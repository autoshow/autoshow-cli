import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { err } from './logger'
import { PromptsConfigSchema } from '../schemas/schemas'
import { parseJsonFile } from './json-prompt-utils'
import { getPanelsDirectory, getSketchesDirectory, getPagesDirectory } from './project-paths'
import type {
  ImagePromptVariation,
  ImageGenerationModel,
  PromptsConfig,
  ScenePrompts,
} from '../types'


export const PANEL_FILENAME_PADDING = 2

export const loadPromptsConfig = async (): Promise<PromptsConfig> => {
  try {
    return await parseJsonFile(join('src', 'cli', 'commands', 'process-steps', 'step-8-comic', 'config', 'prompts.json'), PromptsConfigSchema)
  } catch (error) {
    err('Failed to load prompts:', error instanceof Error ? error.message : String(error))
    throw new Error('Failed to load prompts configuration')
  }
}

export const getPanelPromptTemplate = (scenePrompts: ScenePrompts, panelNumber: number): string => {
  if (panelNumber === 1) {
    return scenePrompts['1st Panel']
  }

  const followUpPrompt = panelNumber === 2
    ? scenePrompts['2nd Panel'] ?? scenePrompts['3rd Panel']
    : scenePrompts['3rd Panel'] ?? scenePrompts['2nd Panel']

  if (!followUpPrompt) {
    throw new Error(`Missing follow-up panel prompt template for panel ${panelNumber}`)
  }

  return followUpPrompt
    .replaceAll('first few panels of the scene', 'previous panels of the scene')
    .replaceAll('first panel of the scene', 'previous panels of the scene')
    .replace(/\bPanel 3\b/g, `Panel ${panelNumber}`)
    .replace(/\bPanel 2\b/g, `Panel ${panelNumber}`)
}

export const validatePanelNumberSequence = (sceneTitle: string, panels: Array<{ number: number }>): void => {
  panels.forEach((panel, index) => {
    const expectedNumber = index + 1
    if (panel.number !== expectedNumber) {
      throw new Error(`Scene "${sceneTitle}" has panel number ${panel.number} at index ${index}; expected ${expectedNumber}`)
    }
  })
}

const getPanelComicImageFilename = (
  panelNumber: number,
): string => {
  return `panel-${String(panelNumber).padStart(PANEL_FILENAME_PADDING, '0')}.png`
}

const getSketchComicImageFilename = (
  startPanelNumber: number,
  endPanelNumber: number,
): string => {
  const panelRange = [
    String(startPanelNumber).padStart(PANEL_FILENAME_PADDING, '0'),
    String(endPanelNumber).padStart(PANEL_FILENAME_PADDING, '0'),
  ].join('-')
  return `panels-${panelRange}.png`
}

const getPagePanelRangeLabel = (panelNumbers: number[]): string => {
  const paddedPanels = panelNumbers.map(panelNumber => {
    return String(panelNumber).padStart(PANEL_FILENAME_PADDING, '0')
  })

  if (paddedPanels.length === 1) {
    return paddedPanels[0] ?? ''
  }

  const isContiguous = panelNumbers.every((panelNumber, index) => {
    const previousPanelNumber = panelNumbers[index - 1]
    return index === 0 || (
      previousPanelNumber !== undefined
      && panelNumber === previousPanelNumber + 1
    )
  })
  const firstPanelLabel = paddedPanels[0] ?? ''
  const lastPanelLabel = paddedPanels.at(-1) ?? ''

  return isContiguous
    ? `${firstPanelLabel}-${lastPanelLabel}`
    : paddedPanels.join('_')
}

export const getPageComicImageFilename = (
  pageNumber: number,
  panelNumbers: number[],
): string => {
  if (pageNumber < 1) {
    throw new Error(`Page number must be at least 1, received ${pageNumber}`)
  }

  if (panelNumbers.length === 0) {
    throw new Error('Page image filenames require at least one panel number')
  }

  const pageFilename = [
    `page-${String(pageNumber).padStart(PANEL_FILENAME_PADDING, '0')}`,
    `panels-${getPagePanelRangeLabel(panelNumbers)}`,
  ].join('-')

  return `${pageFilename}.png`
}

const getFinalImageOutputDirectory = (
  rootDirectory: string,
  model?: ImageGenerationModel,
  variation?: ImagePromptVariation
): string => {
  if (!variation) {
    return model ? join(rootDirectory, model) : rootDirectory
  }

  if (!model) {
    throw new Error(`Model is required for variation output path "${variation}"`)
  }

  return join(rootDirectory, variation, model)
}

export const getPanelComicImagePath = (
  sceneSlug: string,
  panelNumber: number,
  model?: ImageGenerationModel,
  variation?: ImagePromptVariation
): string => {
  const dir = getPanelsDirectory(sceneSlug)
  const filename = getPanelComicImageFilename(panelNumber)
  return join(getFinalImageOutputDirectory(dir, model, variation), filename)
}

export const getSketchComicImagePath = (
  sceneSlug: string,
  startPanelNumber: number,
  endPanelNumber: number,
  model?: ImageGenerationModel
): string => {
  const dir = getSketchesDirectory(sceneSlug)
  const filename = getSketchComicImageFilename(startPanelNumber, endPanelNumber)
  return model ? join(dir, model, filename) : join(dir, filename)
}

export const getPageComicImagePath = (
  sceneSlug: string,
  pageNumber: number,
  panelNumbers: number[],
  model?: ImageGenerationModel,
  variation?: ImagePromptVariation
): string => {
  const dir = getPagesDirectory(sceneSlug)
  const filename = getPageComicImageFilename(pageNumber, panelNumbers)
  return join(getFinalImageOutputDirectory(dir, model, variation), filename)
}

export const findExistingPanelImages = async (
  sceneSlug: string,
  panelNumber: number
): Promise<string[]> => {
  const panelsDirectory = getPanelsDirectory(sceneSlug)
  const filename = getPanelComicImageFilename(panelNumber)
  const results: string[] = []

  let entries
  try {
    entries = await readdir(panelsDirectory, { withFileTypes: true })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return []
    }

    throw error
  }

  const canonicalPath = join(panelsDirectory, filename)
  if (entries.some(entry => entry.isFile() && entry.name === filename)) {
    results.push(canonicalPath)
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const modelPath = join(panelsDirectory, entry.name, filename)
    if (await Bun.file(modelPath).exists()) {
      results.push(modelPath)
    }
  }

  return results.sort((left, right) => {
    if (left === canonicalPath) return -1
    if (right === canonicalPath) return 1
    return left.localeCompare(right)
  })
}
