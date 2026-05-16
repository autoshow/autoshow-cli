import * as v from 'valibot'
import { ExpandedScenePromptDataSchema } from '../../schemas/schemas'
import type {
  ComicPageChunk,
  ComicPanelSelection,
  ExpandedScenePromptData,
} from '../../types'

const PANEL_SELECTOR_PART_PATTERN = /^(\d+)(?:-(\d+))?$/

const assertPositiveInteger = (value: number, label: string): void => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`)
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
  const selectedPanels = selection === 'all'
    ? sortedPanels
    : sortedPanels.filter(panel => selection.includes(panel.panelNumber))

  if (selection !== 'all') {
    const availablePanels = new Set(sortedPanels.map(panel => panel.panelNumber))
    const missingPanels = selection.filter(panelNumber => !availablePanels.has(panelNumber))
    if (missingPanels.length > 0) {
      throw new Error(
        `Selected panel${missingPanels.length === 1 ? '' : 's'} ${missingPanels.join(', ')} ` +
        `were not found in ${sceneLabel}.`
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
