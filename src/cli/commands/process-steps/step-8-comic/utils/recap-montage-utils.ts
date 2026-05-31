import { readdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { normalizeProjectPath } from './project-paths'
import { parseScriptMarkdownToStructuredData } from './structured-script-utils'
import type {
  ScenePromptData,
  StructuredScriptData,
  StructuredScriptSourceSegment,
} from '../types/comic-types'

type RecapMontageSceneEntry = {
  scriptPath: string
  sceneTitle: string
  location: string
  characters: string[]
  visualBeats: string[]
}

export type RecapMontageExpansion = {
  sourceSegmentId: string
  sourceSegmentIds: string[]
  beatIndex: number
  cueText: string
  previousEpisodeDirectory: string
  priorScenes: RecapMontageSceneEntry[]
}

const SCRIPT_FOLDER_PATTERN = /^(\d+)-script$/i
const MARKDOWN_EMPHASIS_PATTERN = /[*_`]+/g

const formatExcerpt = (text: string, maxLength = 180): string => {
  const normalized = text
    .replace(MARKDOWN_EMPHASIS_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 3)}...`
    : normalized
}

const isRecapMontageCueText = (text: string): boolean => {
  return /\bepisode\b/i.test(text) && /\bmontage\b/i.test(text)
}

export const isRecapMontageBeat = (beat: { text: string }): boolean => {
  return isRecapMontageCueText(beat.text)
}

export const resolvePreviousEpisodeScriptsDirectory = (sourceFile: string): string => {
  const currentDirectory = dirname(sourceFile)
  const scriptFolderName = basename(currentDirectory)
  const match = scriptFolderName.match(SCRIPT_FOLDER_PATTERN)

  if (!match?.[1]) {
    throw new Error(
      `Cannot resolve recap montage previous episode folder from "${sourceFile}": ` +
      'expected the source script to live in a folder like "04-script".'
    )
  }

  const currentEpisodeNumber = Number.parseInt(match[1], 10)
  if (!Number.isFinite(currentEpisodeNumber) || currentEpisodeNumber <= 1) {
    throw new Error(
      `Cannot resolve recap montage previous episode folder from "${sourceFile}": ` +
      `episode ${match[1]} has no previous numbered episode.`
    )
  }

  const previousEpisodeLabel = String(currentEpisodeNumber - 1).padStart(match[1].length, '0')
  return join(dirname(currentDirectory), `${previousEpisodeLabel}-script`)
}

const readPriorScriptPaths = async (previousEpisodeDirectory: string): Promise<string[]> => {
  const entries = await (async () => {
    try {
      return await readdir(previousEpisodeDirectory, { withFileTypes: true })
    } catch (error) {
      throw new Error(
        `Recap montage expansion could not read previous episode folder ` +
        `"${normalizeProjectPath(previousEpisodeDirectory)}": ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  })()

  const scriptPaths = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
    .map(entry => join(previousEpisodeDirectory, entry.name))

  if (scriptPaths.length === 0) {
    throw new Error(
      `Recap montage expansion found no prior scene scripts in ` +
      `"${normalizeProjectPath(previousEpisodeDirectory)}".`
    )
  }

  return scriptPaths
}

const getVisualBeatExcerpts = (structuredScript: StructuredScriptData): string[] => {
  const visualBeats = structuredScript.beats.filter(beat => beat.type !== 'dialogue')
  const selectedBeats = (visualBeats.length > 0 ? visualBeats : structuredScript.beats).slice(0, 3)
  return selectedBeats.map(beat => formatExcerpt(beat.text))
}

const buildPriorSceneEntry = async (scriptPath: string): Promise<RecapMontageSceneEntry> => {
  const content = await Bun.file(scriptPath).text()
  const structuredScript = parseScriptMarkdownToStructuredData(content, scriptPath)

  return {
    scriptPath: normalizeProjectPath(scriptPath),
    sceneTitle: structuredScript.scene.title,
    location: structuredScript.scene.location.raw,
    characters: structuredScript.characters,
    visualBeats: getVisualBeatExcerpts(structuredScript),
  }
}

const getBeatSourceSegments = (
  beatIndex: number,
  sourceSegments: StructuredScriptSourceSegment[]
): StructuredScriptSourceSegment[] => {
  return sourceSegments.filter(segment => segment.beatIndex === beatIndex)
}

export const resolveRecapMontageExpansions = async (
  structuredScript: StructuredScriptData
): Promise<RecapMontageExpansion[]> => {
  const montageBeats = structuredScript.beats.filter(isRecapMontageBeat)
  if (montageBeats.length === 0) {
    return []
  }

  const previousEpisodeDirectory = resolvePreviousEpisodeScriptsDirectory(structuredScript.sourceFile)
  const priorScriptPaths = await readPriorScriptPaths(previousEpisodeDirectory)
  const priorScenes = await Promise.all(priorScriptPaths.map(buildPriorSceneEntry))

  return montageBeats.map(beat => {
    const sourceSegments = getBeatSourceSegments(beat.index, structuredScript.sourceSegments)
    const firstSourceSegment = sourceSegments[0]

    if (!firstSourceSegment) {
      throw new Error(
        `Recap montage beat ${beat.index} in "${structuredScript.sourceFile}" ` +
        'does not have a source segment ID.'
      )
    }

    return {
      sourceSegmentId: firstSourceSegment.id,
      sourceSegmentIds: sourceSegments.map(segment => segment.id),
      beatIndex: beat.index,
      cueText: beat.text,
      previousEpisodeDirectory: normalizeProjectPath(previousEpisodeDirectory),
      priorScenes,
    }
  })
}

const formatCharacters = (characters: string[]): string => {
  return characters.length > 0 ? characters.join(', ') : 'None named'
}

const formatSceneEntry = (scene: RecapMontageSceneEntry, index: number): string => {
  const visualBeats = scene.visualBeats.length > 0
    ? scene.visualBeats.map(beat => `   - ${beat}`).join('\n')
    : '   - No visual staging beats detected.'

  return [
    `${index + 1}. ${scene.sceneTitle}`,
    `   - Source: \`${scene.scriptPath}\``,
    `   - Location: ${scene.location}`,
    `   - Characters: ${formatCharacters(scene.characters)}`,
    '   - Visual staging beats:',
    visualBeats,
  ].join('\n')
}

export const formatRecapMontagePromptSection = (
  expansions: RecapMontageExpansion[]
): string => {
  if (expansions.length === 0) {
    return ''
  }

  const sections = ['## Recap Montage Expansion']

  for (const expansion of expansions) {
    sections.push([
      `### Montage Cue ${expansion.sourceSegmentId}`,
      `Cue beat: ${expansion.beatIndex}`,
      `Cue text: ${formatExcerpt(expansion.cueText)}`,
      `Resolved previous episode folder: \`${expansion.previousEpisodeDirectory}\``,
      `Required recap montage panel count for \`${expansion.sourceSegmentId}\`: exactly ${expansion.priorScenes.length}.`,
      '',
      'Create exactly one fast recap montage panel for each prior scene below, in the listed order.',
      'These recap panels are in addition to any panels needed for source segments before and after the montage cue; do not merge black-screen, title-card, or transition beats into the recap panels.',
      `Every recap montage panel must include \`${expansion.sourceSegmentId}\` in \`sourceSegmentIds\`.`,
      'Every recap montage panel must use `"speech": []` because the dialogue is incomprehensible gibberish.',
      'Every recap montage panel description must include motion blur, speed lines, and under 30 seconds pacing.',
      'Do not collapse these prior scenes into a single collage panel.',
      '`TEXT ON SCREEN` is a production directive. Do not render the literal words "TEXT ON SCREEN" as visible text; render only the authored on-screen text that follows it.',
      '',
      'Prior scenes to recap:',
      expansion.priorScenes.map(formatSceneEntry).join('\n'),
    ].join('\n'))
  }

  return sections.join('\n\n')
}

export const validateSceneRecapMontageExpansion = async (
  sceneData: ScenePromptData,
  structuredScript: StructuredScriptData
): Promise<void> => {
  const expansions = await resolveRecapMontageExpansions(structuredScript)

  for (const expansion of expansions) {
    const matchingPanels = sceneData.panels.filter(panel => {
      return panel.sourceSegmentIds.includes(expansion.sourceSegmentId)
    })

    if (matchingPanels.length < expansion.priorScenes.length) {
      throw new Error(
        `Scene JSON recap montage expansion incomplete: source segment ` +
        `${expansion.sourceSegmentId} appears in ${matchingPanels.length} panel(s), ` +
        `but ${expansion.priorScenes.length} prior scene(s) were resolved from ` +
        `${expansion.previousEpisodeDirectory}. Use one recap panel per prior scene.`
      )
    }
  }
}
