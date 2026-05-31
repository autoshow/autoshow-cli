import type { Dirent } from 'node:fs'
import { basename, extname, join } from 'node:path'
import * as v from 'valibot'
import { l } from './logger'
import { ExpandedScenePromptDataSchema } from '../schemas/schemas'
import {
  geminiPrimaryCharacterRefsNeedWarning,
  truncateGeminiReferenceImages,
} from '../models/gemini-models'
import { isGeminiImageModel } from '../models/model-registry'
import type {
  CharacterReferenceState,
  ExpandedScenePromptData,
  ImageGenerationModel,
  PanelPrimaryReferenceInput,
  PrimaryCharacterReferenceState,
  PriorPanelReference,
  ResolvedReferenceImages,
  ResolveReferenceImagesOptions,
} from '../types/comic-types'








export const PANEL_DIRECTORY_PATTERN = /^panel-(\d+)$/

const PRIOR_PANEL_REFERENCE_PATTERN = /^panel-(\d+)(?:--(.+))?\.png$/
const SUPPORTED_REFERENCE_EXTENSIONS = new Set(['.png', '.webp', '.jpg', '.jpeg'])
const MAX_REFERENCE_IMAGES = 16
const HIGH_FIDELITY_REFERENCE_LIMIT = 5

export const formatPanelDirectoryName = (panelNumber: number): string => {
  return `panel-${String(panelNumber).padStart(2, '0')}`
}

export const getPanelNumberFromName = (
  value: string,
  pattern: RegExp = PANEL_DIRECTORY_PATTERN
): number | null => {
  const match = value.match(pattern)
  if (!match?.[1]) {
    return null
  }

  return Number(match[1])
}

const isReferenceImageEntry = (entry: Dirent): boolean => {
  return entry.isFile() && SUPPORTED_REFERENCE_EXTENSIONS.has(extname(entry.name).toLowerCase())
}

const parsePriorPanelReference = (
  panelDirectory: string,
  entry: Dirent
): PriorPanelReference | null => {
  const match = entry.name.match(PRIOR_PANEL_REFERENCE_PATTERN)
  if (!match?.[1]) {
    return null
  }

  return {
    panelNumber: Number(match[1]),
    path: join(panelDirectory, entry.name),
    ...(match[2] ? { model: match[2] } : {}),
  }
}

export const normalizePromptBundle = (content: string): string => {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/^## Panel \d+ \(for reference\)\n\n!\[[^\]]*\]\([^)]+\)\n\n?/gm, '')
    .replace(/^!\[[^\]]*\]\([^)]+\)\n?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const extractExpandedScenePromptData = (content: string): ExpandedScenePromptData => {
  const jsonMatches = Array.from(content.matchAll(/```json\s*([\s\S]*?)\s*```/g))
  const jsonMatch = jsonMatches.at(-1)
  if (!jsonMatch?.[1]) {
    throw new Error('Prompt bundle is missing a JSON block')
  }

  try {
    const parsed = JSON.parse(jsonMatch[1])
    const validated = v.parse(ExpandedScenePromptDataSchema, parsed)

    if (validated.panels.length !== 1) {
      throw new Error(`Expected exactly 1 panel in prompt bundle JSON, found ${validated.panels.length}`)
    }

    return validated
  } catch (error) {
    if (v.isValiError(error)) {
      throw new Error('Prompt bundle JSON did not match the expanded scene schema')
    }

    throw error
  }
}

export const getPromptBundleFilename = (panelDirectory: string, entries: Dirent[]): string => {
  const promptFiles = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => entry.name)
    .sort()

  if (promptFiles.length !== 1) {
    throw new Error(
      `Expected exactly 1 markdown prompt bundle in ${panelDirectory}, found ${promptFiles.length}`
    )
  }

  const promptFilename = promptFiles[0]
  if (!promptFilename) {
    throw new Error(`No markdown prompt bundle was found in ${panelDirectory}`)
  }

  return promptFilename
}

const addUniquePaths = (destination: string[], seen: Set<string>, candidates: string[]): void => {
  candidates.forEach(candidate => {
    if (seen.has(candidate)) {
      return
    }

    seen.add(candidate)
    destination.push(candidate)
  })
}

const addUniquePathsByBasename = (
  destination: string[],
  seenBasenames: Set<string>,
  candidates: string[]
): void => {
  candidates.forEach(candidate => {
    const filename = basename(candidate)
    if (seenBasenames.has(filename)) {
      return
    }

    seenBasenames.add(filename)
    destination.push(candidate)
  })
}

const addUniqueValues = (destination: string[], seen: Set<string>, candidates: string[]): void => {
  candidates.forEach(candidate => {
    if (seen.has(candidate)) {
      return
    }

    seen.add(candidate)
    destination.push(candidate)
  })
}

const buildCharacterReferenceState = (
  panelDirectory: string,
  filenames: Set<string>,
  character: ExpandedScenePromptData['panels'][number]['characters'][number]
): CharacterReferenceState => {
  const canonicalFilename = basename(character.image)
  const sketchFilenames = Array.from(
    new Set((character.sketchImages ?? []).map(imagePath => basename(imagePath)))
  )

  return {
    key: canonicalFilename,
    sketchRefs: sketchFilenames
      .filter(filename => filenames.has(filename))
      .map(filename => join(panelDirectory, filename)),
    ...(filenames.has(canonicalFilename)
      ? { canonicalRef: join(panelDirectory, canonicalFilename) }
      : {}),
    missingPrimaryCharacterRefs: [
      ...(filenames.has(canonicalFilename) ? [] : [canonicalFilename]),
      ...sketchFilenames.filter(filename => !filenames.has(filename)),
    ].sort(),
  }
}

const mergeCharacterReferenceStates = (
  states: CharacterReferenceState[]
): CharacterReferenceState[] => {
  const groupedStates = new Map<string, CharacterReferenceState>()

  states.forEach(state => {
    const existing = groupedStates.get(state.key)
    if (!existing) {
      groupedStates.set(state.key, {
        ...state,
        sketchRefs: [...state.sketchRefs],
        missingPrimaryCharacterRefs: [...state.missingPrimaryCharacterRefs],
      })
      return
    }

    const seenSketchRefBasenames = new Set(existing.sketchRefs.map(path => basename(path)))
    addUniquePathsByBasename(existing.sketchRefs, seenSketchRefBasenames, state.sketchRefs)

    if (!existing.canonicalRef && state.canonicalRef) {
      existing.canonicalRef = state.canonicalRef
    }

    const missingRefs = new Set(existing.missingPrimaryCharacterRefs)
    state.missingPrimaryCharacterRefs.forEach(missingRef => {
      missingRefs.add(missingRef)
    })
    if (existing.canonicalRef) {
      missingRefs.delete(existing.key)
    }
    existing.sketchRefs.forEach(sketchRef => {
      missingRefs.delete(basename(sketchRef))
    })
    existing.missingPrimaryCharacterRefs = Array.from(missingRefs).sort()
  })

  return Array.from(groupedStates.values())
}

const buildPrimaryCharacterReferenceState = (
  states: CharacterReferenceState[]
): PrimaryCharacterReferenceState => {
  const orderedPrimaryRefs: string[] = []
  const seenPrimaryRefs = new Set<string>()
  const orderedSketchRefs: string[] = []
  const seenSketchRefs = new Set<string>()
  const orderedCanonicalRefs: string[] = []
  const seenCanonicalRefs = new Set<string>()
  const missingPrimaryCharacterRefs: string[] = []
  const seenMissingPrimaryRefs = new Set<string>()
  const referenceQueues = states.map(state => {
    return [...state.sketchRefs, ...(state.canonicalRef ? [state.canonicalRef] : [])]
  })

  let addedReference = true
  while (addedReference) {
    addedReference = false

    referenceQueues.forEach(queue => {
      const nextReference = queue.shift()
      if (!nextReference || seenPrimaryRefs.has(nextReference)) {
        return
      }

      seenPrimaryRefs.add(nextReference)
      orderedPrimaryRefs.push(nextReference)
      addedReference = true
    })
  }

  states.forEach(state => {
    addUniquePaths(orderedSketchRefs, seenSketchRefs, state.sketchRefs)
    addUniquePaths(
      orderedCanonicalRefs,
      seenCanonicalRefs,
      state.canonicalRef ? [state.canonicalRef] : []
    )
    addUniqueValues(
      missingPrimaryCharacterRefs,
      seenMissingPrimaryRefs,
      state.missingPrimaryCharacterRefs
    )
  })

  return {
    primaryCharacterRefs: orderedPrimaryRefs,
    sketchCharacterRefs: orderedPrimaryRefs.filter(path => seenSketchRefs.has(path)),
    canonicalCharacterRefs: orderedPrimaryRefs.filter(path => seenCanonicalRefs.has(path)),
    missingPrimaryCharacterRefs,
  }
}


export const resolvePrimaryCharacterReferencesAcrossPanels = (
  panels: PanelPrimaryReferenceInput[]
): PrimaryCharacterReferenceState => {
  const states = panels.flatMap(panel => {
    const filenames = new Set(panel.entries.filter(entry => entry.isFile()).map(entry => entry.name))
    const panelCharacters = panel.bundleData.panels.flatMap(currentPanel => currentPanel.characters)

    return panelCharacters.map(character => buildCharacterReferenceState(
      panel.panelDirectory,
      filenames,
      character,
    ))
  })

  return buildPrimaryCharacterReferenceState(mergeCharacterReferenceStates(states))
}

export const resolvePrimaryCharacterReferences = (
  panelDirectory: string,
  entries: Dirent[],
  bundleData: ExpandedScenePromptData
): PrimaryCharacterReferenceState => {
  return resolvePrimaryCharacterReferencesAcrossPanels([
    {
      panelDirectory,
      entries,
      bundleData,
    },
  ])
}

const buildResolvedReferenceImages = (
  all: string[],
  primaryCharacterRefs: string[],
  sketchCharacterRefs: string[],
  canonicalCharacterRefs: string[],
  priorPanelRefs: string[],
  secondaryRefs: string[],
  missingPrimaryCharacterRefs: string[]
): ResolvedReferenceImages => {
  const selectedPaths = new Set(all)

  return {
    all,
    primaryCharacterRefs: primaryCharacterRefs.filter(path => selectedPaths.has(path)),
    sketchCharacterRefs: sketchCharacterRefs.filter(path => selectedPaths.has(path)),
    canonicalCharacterRefs: canonicalCharacterRefs.filter(path => selectedPaths.has(path)),
    priorPanelRefs: priorPanelRefs.filter(path => selectedPaths.has(path)),
    secondaryRefs: secondaryRefs.filter(path => selectedPaths.has(path)),
    missingPrimaryCharacterRefs,
  }
}

export const applyReferenceImageLimits = (
  orderedReferenceImages: string[],
  primaryCharacterRefs: string[],
  sketchCharacterRefs: string[],
  canonicalCharacterRefs: string[],
  priorPanelRefs: string[],
  secondaryRefs: string[],
  missingPrimaryCharacterRefs: string[],
  model: ImageGenerationModel
): ResolvedReferenceImages => {
  if (isGeminiImageModel(model)) {
    if (geminiPrimaryCharacterRefsNeedWarning(primaryCharacterRefs.length)) {
      l.dim(
        `  Gemini note: ${primaryCharacterRefs.length} primary character refs were provided; ` +
        'character resemblance is best supported with up to 4 primary refs'
      )
    }

    const truncated = truncateGeminiReferenceImages(orderedReferenceImages)
    if (truncated.wasTruncated) {
      l.dim(
        `  Truncating Gemini references from ${truncated.originalCount} to ${truncated.references.length}; ` +
        'soft cap is 10 inputs'
      )
    }

    return buildResolvedReferenceImages(
      truncated.references,
      primaryCharacterRefs,
      sketchCharacterRefs,
      canonicalCharacterRefs,
      priorPanelRefs,
      secondaryRefs,
      missingPrimaryCharacterRefs,
    )
  }

  if (orderedReferenceImages.length <= MAX_REFERENCE_IMAGES) {
    return buildResolvedReferenceImages(
      orderedReferenceImages,
      primaryCharacterRefs,
      sketchCharacterRefs,
      canonicalCharacterRefs,
      priorPanelRefs,
      secondaryRefs,
      missingPrimaryCharacterRefs,
    )
  }

  l.dim(
    `  Truncating references from ${orderedReferenceImages.length} to ${MAX_REFERENCE_IMAGES}; ` +
    `the first ${HIGH_FIDELITY_REFERENCE_LIMIT} inputs receive higher-fidelity preservation`
  )

  return buildResolvedReferenceImages(
    orderedReferenceImages.slice(0, MAX_REFERENCE_IMAGES),
    primaryCharacterRefs,
    sketchCharacterRefs,
    canonicalCharacterRefs,
    priorPanelRefs,
    secondaryRefs,
    missingPrimaryCharacterRefs,
  )
}

export const resolveReferenceImages = (
  panelDirectory: string,
  entries: Dirent[],
  bundleData: ExpandedScenePromptData,
  model: ImageGenerationModel,
  options: ResolveReferenceImagesOptions = {}
): ResolvedReferenceImages => {
  const includePriorPanelRefs = options.includePriorPanelRefs ?? true
  const includeSecondaryRefs = options.includeSecondaryRefs ?? true
  const allImagePaths = entries
    .filter(isReferenceImageEntry)
    .map(entry => join(panelDirectory, entry.name))
  const primaryCharacterReferenceState = resolvePrimaryCharacterReferences(panelDirectory, entries, bundleData)

  const priorPanelCandidates = includePriorPanelRefs
    ? entries
        .filter(isReferenceImageEntry)
        .map(entry => parsePriorPanelReference(panelDirectory, entry))
        .filter((entry): entry is PriorPanelReference => entry !== null)
    : []

  const priorPanelPaths = new Set(priorPanelCandidates.map(entry => entry.path))
  const preferredPriorPanelRefs = Array.from(
    priorPanelCandidates.reduce((grouped, entry) => {
      const existing = grouped.get(entry.panelNumber)
      if (existing) {
        existing.push(entry)
      } else {
        grouped.set(entry.panelNumber, [entry])
      }

      return grouped
    }, new Map<number, PriorPanelReference[]>())
  )
    .sort((left, right) => right[0] - left[0])
    .map(([, candidates]) => {
      return [...candidates].sort((left, right) => {
        const leftPriority = left.model === model ? 0 : left.model === undefined ? 1 : 2
        const rightPriority = right.model === model ? 0 : right.model === undefined ? 1 : 2
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority
        }

        return basename(left.path).localeCompare(basename(right.path))
      })[0]
    })
    .filter((entry): entry is PriorPanelReference => entry !== undefined)

  const priorPanelRefs = preferredPriorPanelRefs.map(entry => entry.path)

  const orderedReferenceImages: string[] = []
  const seenPaths = new Set<string>()

  addUniquePaths(orderedReferenceImages, seenPaths, primaryCharacterReferenceState.primaryCharacterRefs)
  addUniquePaths(orderedReferenceImages, seenPaths, priorPanelRefs)

  const secondaryRefs = includeSecondaryRefs
    ? allImagePaths
        .sort((left, right) => basename(left).localeCompare(basename(right)))
        .filter(path => !seenPaths.has(path) && !priorPanelPaths.has(path))
    : []
  addUniquePaths(orderedReferenceImages, seenPaths, secondaryRefs)

  return applyReferenceImageLimits(
    orderedReferenceImages,
    primaryCharacterReferenceState.primaryCharacterRefs,
    primaryCharacterReferenceState.sketchCharacterRefs,
    primaryCharacterReferenceState.canonicalCharacterRefs,
    priorPanelRefs,
    secondaryRefs,
    primaryCharacterReferenceState.missingPrimaryCharacterRefs,
    model,
  )
}

export const resolveScenePanelDirectories = (
  sceneEntries: Dirent[],
  sceneDirectory: string,
  requestedPanelNumber: number | undefined
): Dirent[] => {
  const panelDirectories = sceneEntries
    .filter(entry => entry.isDirectory() && PANEL_DIRECTORY_PATTERN.test(entry.name))
    .sort((left, right) => {
      const leftNumber = getPanelNumberFromName(left.name) ?? 0
      const rightNumber = getPanelNumberFromName(right.name) ?? 0
      return leftNumber - rightNumber
    })

  if (panelDirectories.length === 0) {
    throw new Error(`No panel directories were found in ${sceneDirectory}`)
  }

  if (!requestedPanelNumber) {
    return panelDirectories
  }

  const requestedPanelDirectoryName = formatPanelDirectoryName(requestedPanelNumber)
  const selectedPanelDirectory = panelDirectories.find(entry => entry.name === requestedPanelDirectoryName)
  if (!selectedPanelDirectory) {
    const availablePanels = panelDirectories.map(entry => entry.name).join(', ')
    throw new Error(
      `Requested ${requestedPanelDirectoryName} was not found in ${sceneDirectory}. ` +
      `Available panels: ${availablePanels}`
    )
  }

  return [selectedPanelDirectory]
}
