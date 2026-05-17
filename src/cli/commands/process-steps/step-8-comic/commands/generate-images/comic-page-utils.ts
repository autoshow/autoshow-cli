import * as v from 'valibot'
import { ExpandedScenePromptDataSchema } from '../../schemas/schemas'
import type {
  ComicGridChunk,
  ComicGridSpec,
  ComicPageChunk,
  ComicPanelSelection,
  ExpandedScenePromptData,
  GenerateImagesTarget,
  ImageGenerationSize,
  SketchPanelRange,
} from '../../types'

const PANEL_SELECTOR_PART_PATTERN = /^(\d+)(?:-(\d+))?$/
const GRID_SPEC_PATTERN = /^([1-9]\d*)x([1-9]\d*)$/i

export const DEFAULT_PANELS_PER_IMAGE = 6
export const COMIC_GRID_PANEL_SIZE: ImageGenerationSize = '1536x1024'

const assertPositiveInteger = (value: number, label: string): void => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`)
  }
}

export const parseComicGridSpec = (value: string): ComicGridSpec => {
  const trimmed = value.trim()
  const match = trimmed.match(GRID_SPEC_PATTERN)
  const columns = match?.[1] ? Number(match[1]) : 0
  const rows = match?.[2] ? Number(match[2]) : 0

  if (
    !match
    || !Number.isSafeInteger(columns)
    || !Number.isSafeInteger(rows)
  ) {
    throw new Error(`Invalid grid "${value}". Expected positive columns x rows like 2x3`)
  }

  return { columns, rows }
}

export const validateComicGridOptions = (
  grid: ComicGridSpec | undefined,
  options: {
    target: GenerateImagesTarget
    size: ImageGenerationSize
    panelsPerImage: number
  }
): void => {
  if (!grid) {
    return
  }

  if (options.target !== 'images' && options.target !== 'both') {
    throw new Error('--grid only applies when --target is images or both')
  }

  if (options.size !== COMIC_GRID_PANEL_SIZE) {
    throw new Error(`--grid requires --size ${COMIC_GRID_PANEL_SIZE}`)
  }

  if (options.panelsPerImage !== 1) {
    throw new Error('--grid requires --panels-per-image 1')
  }
}

export const parsePanelSelector = (value: string): ComicPanelSelection => {
  const trimmed = value.trim()
  if (trimmed === 'all') {
    return 'all'
  }

  if (!trimmed || trimmed.includes(' ')) {
    throw new Error(`Invalid panels "${value}". Expected all, a range like 1-8, or a list like 1,3,7`)
  }

  const selectedPanels = new Set<number>()
  for (const rawPart of trimmed.split(',')) {
    if (!rawPart) {
      throw new Error(`Invalid panels "${value}". Expected all, a range like 1-8, or a list like 1,3,7`)
    }

    const match = rawPart.match(PANEL_SELECTOR_PART_PATTERN)
    const startPanel = match?.[1] ? Number(match[1]) : 0
    const endPanel = match?.[2] ? Number(match[2]) : startPanel

    if (!match || startPanel < 1 || endPanel < 1 || startPanel > endPanel) {
      throw new Error(`Invalid panels "${value}". Expected all, a range like 1-8, or a list like 1,3,7`)
    }

    for (let panelNumber = startPanel; panelNumber <= endPanel; panelNumber++) {
      selectedPanels.add(panelNumber)
    }
  }

  return Array.from(selectedPanels).sort((left, right) => left - right)
}

export const isContiguousPanelSelection = (panelNumbers: number[]): boolean => {
  return panelNumbers.every((panelNumber, index) => {
    return index === 0 || panelNumber === panelNumbers[index - 1]! + 1
  })
}

export const hasOnlyTrailingPanelSelectionMisses = (
  requestedPanelNumbers: number[],
  selectedPanelNumbers: number[],
  missingPanelNumbers: number[]
): boolean => {
  const requestedStartPanel = requestedPanelNumbers[0]
  const firstSelectedPanel = selectedPanelNumbers[0]
  const lastSelectedPanel = selectedPanelNumbers.at(-1)

  return isContiguousPanelSelection(requestedPanelNumbers)
    && requestedStartPanel !== undefined
    && firstSelectedPanel === requestedStartPanel
    && lastSelectedPanel !== undefined
    && missingPanelNumbers.every(panelNumber => panelNumber > lastSelectedPanel)
}

export const panelSelectionToSketchRange = (
  panels: ComicPanelSelection | undefined
): SketchPanelRange | undefined => {
  if (panels === undefined || panels === 'all') {
    return undefined
  }

  const sorted = Array.from(new Set(panels)).sort((a, b) => a - b)
  if (!isContiguousPanelSelection(sorted)) {
    throw new Error(
      'Sketch panel selection must be contiguous when generating sketches. ' +
      'Use a range like 1-4 or pass --target images for non-contiguous final panel selections.'
    )
  }

  return { startPanelNumber: sorted[0]!, endPanelNumber: sorted.at(-1)! }
}

export const applyPanelLimit = <T>(
  panels: T[],
  panelLimit: number | undefined
): T[] => {
  if (panelLimit === undefined) {
    return panels
  }

  assertPositiveInteger(panelLimit, 'Panel limit')
  return panels.slice(0, panelLimit)
}

export const selectComicPanels = <T extends { panelNumber: number }>(
  panels: T[],
  selection: ComicPanelSelection,
  panelLimit: number | undefined,
  sceneLabel: string
): T[] => {
  const sortedPanels = [...panels].sort((left, right) => left.panelNumber - right.panelNumber)
  const requestedPanelNumbers = selection === 'all'
    ? undefined
    : Array.from(new Set(selection)).sort((left, right) => left - right)
  const requestedPanelNumberSet = requestedPanelNumbers
    ? new Set(requestedPanelNumbers)
    : undefined
  const selectedPanels = selection === 'all'
    ? sortedPanels
    : sortedPanels.filter(panel => requestedPanelNumberSet?.has(panel.panelNumber))

  if (requestedPanelNumbers) {
    const availablePanels = new Set(sortedPanels.map(panel => panel.panelNumber))
    const missingPanels = requestedPanelNumbers.filter(panelNumber => !availablePanels.has(panelNumber))
    const selectedPanelNumbers = selectedPanels.map(panel => panel.panelNumber)
    if (missingPanels.length > 0 && !hasOnlyTrailingPanelSelectionMisses(
      requestedPanelNumbers,
      selectedPanelNumbers,
      missingPanels
    )) {
      const missingPanelLabel = `Selected panel${missingPanels.length === 1 ? '' : 's'} ${missingPanels.join(', ')}`
      const missingPanelVerb = missingPanels.length === 1 ? 'was' : 'were'
      throw new Error(
        `${missingPanelLabel} ${missingPanelVerb} not found in ${sceneLabel}.`
      )
    }
  }

  const limitedPanels = applyPanelLimit(selectedPanels, panelLimit)
  if (limitedPanels.length === 0) {
    throw new Error(`No selected panels were found in ${sceneLabel}.`)
  }

  return limitedPanels
}

export const chunkComicPagePanels = <T extends { panelNumber: number }>(
  panels: T[],
  panelsPerImage: number
): Array<ComicPageChunk<T>> => {
  assertPositiveInteger(panelsPerImage, 'Panels per image')

  const chunks: Array<ComicPageChunk<T>> = []
  for (let index = 0; index < panels.length; index += panelsPerImage) {
    const chunkPanels = panels.slice(index, index + panelsPerImage)
    if (chunkPanels.length === 0) {
      continue
    }

    chunks.push({
      pageNumber: chunks.length + 1,
      panelNumbers: chunkPanels.map(panel => panel.panelNumber),
      panels: chunkPanels,
    })
  }

  return chunks
}

export const getComicGridCapacity = (grid: ComicGridSpec): number => {
  assertPositiveInteger(grid.columns, 'Grid columns')
  assertPositiveInteger(grid.rows, 'Grid rows')

  const capacity = grid.columns * grid.rows
  if (!Number.isSafeInteger(capacity)) {
    throw new Error('Grid capacity is too large')
  }

  return capacity
}

export const chunkComicGridPanels = <T extends { panelNumber: number }>(
  panels: T[],
  grid: ComicGridSpec
): Array<ComicGridChunk<T>> => {
  return chunkComicPagePanels(panels, getComicGridCapacity(grid))
}

export const buildComicPagePromptData = (
  bundleDataList: ExpandedScenePromptData[]
): ExpandedScenePromptData => {
  if (bundleDataList.length === 0) {
    throw new Error('Page image prompts require at least one panel bundle')
  }

  const [firstBundle] = bundleDataList
  if (!firstBundle) {
    throw new Error('Page image prompts require at least one panel bundle')
  }

  const panels = bundleDataList.map(bundleData => {
    if (bundleData.title !== firstBundle.title || bundleData.location !== firstBundle.location) {
      throw new Error('Page image panels must share the same title and location')
    }

    const panel = bundleData.panels[0]
    if (!panel) {
      throw new Error('Panel prompt bundle is missing its panel payload')
    }

    return panel
  })

  return v.parse(ExpandedScenePromptDataSchema, {
    title: firstBundle.title,
    location: firstBundle.location,
    panels,
  })
}

export const buildComicPagePrompt = (
  pagePromptData: ExpandedScenePromptData
): string => {
  const panelCount = pagePromptData.panels.length
  const subPanelLabel = panelCount === 1 ? 'sub-panel' : 'sub-panels'

  return [
    'Create one final USS Acampo comic page image from the ordered panel data below.',
    [
      'Page requirements:',
      `- Render exactly ${panelCount} ${subPanelLabel}, one sub-panel for each source panel, in the listed order.`,
      '- Do not add, remove, merge, split, or reorder sub-panels.',
      '- Preserve each source panel\'s staging, characters, setting, and action.',
      '- Include every speech bubble exactly as written in the JSON.',
      '- Do not paraphrase, correct, translate, or omit speech text.',
      '- Place speech text only in the matching source panel.',
      '- Use polished full-color final comic art with clean linework, consistent characters, and readable lettering.',
    ].join('\n'),
    `Ordered page data:\n\`\`\`json\n${JSON.stringify(pagePromptData, null, 2)}\n\`\`\``,
  ].join('\n\n')
}
