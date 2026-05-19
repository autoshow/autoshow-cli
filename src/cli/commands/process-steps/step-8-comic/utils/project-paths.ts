import { readdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'

export const INPUT_ROOT = 'input'
export const OUTPUT_ROOT = 'output'

export const COMIC_OUTPUT_ROOT = join(OUTPUT_ROOT, 'comic')
export const CHARACTER_INPUT_ROOT = join(INPUT_ROOT, 'characters')
export const CHARACTER_SKETCHES_ROOT = join(OUTPUT_ROOT, 'characters', 'sketches')
export const EPISODE_SCRIPTS_ROOT = join(INPUT_ROOT, 'episode-scripts')

const COMIC_SCRIPT_SHORTHAND_PATTERN = /^(\d{2})-(\d{2})$/

export const getSceneOutputDirectory = (sceneSlug: string): string =>
  join(COMIC_OUTPUT_ROOT, sceneSlug)

export const getStructuredScriptPath = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'structured-script.json')

export const getDraftPromptPath = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'draft-prompt.md')

export const getSceneJsonPath = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'scene.json')

export const getInvalidSceneJsonPath = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'scene.invalid.json')

export const getPanelPromptsDirectory = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'panel-prompts')

export const getPanelPromptCoverageReportPath = (sceneSlug: string): string =>
  join(getPanelPromptsDirectory(sceneSlug), 'source-coverage.json')

export const getSketchesDirectory = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'sketches')

export const getPagesDirectory = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'pages')

export const getPanelsDirectory = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'panels')

export const resolveSceneSlug = (scriptPath: string): string =>
  basename(scriptPath, extname(scriptPath))

export const normalizeProjectPath = (path: string): string => path.replace(/\\/g, '/')

export type ResolveComicScriptReferenceOptions = {
  episodeScriptsRoot?: string
}

export const resolveComicScriptReference = async (
  scriptReference: string,
  options: ResolveComicScriptReferenceOptions = {}
): Promise<string> => {
  const match = scriptReference.match(COMIC_SCRIPT_SHORTHAND_PATTERN)
  if (!match?.[1] || !match[2]) {
    return scriptReference
  }

  const episode = match[1]
  const scene = match[2]
  const episodeScriptsRoot = options.episodeScriptsRoot ?? EPISODE_SCRIPTS_ROOT
  const episodeDirectory = join(episodeScriptsRoot, `${episode}-script`)
  const expectedPrefix = `${scene}-`

  const entries = await (async () => {
    try {
      return await readdir(episodeDirectory, { withFileTypes: true })
    } catch (error) {
      throw new Error(
        `Comic script shorthand "${scriptReference}" could not be resolved. ` +
        `Expected exactly one Markdown file in "${normalizeProjectPath(episodeDirectory)}" ` +
        `beginning with "${expectedPrefix}". ` +
        `${error instanceof Error ? error.message : String(error)}`
      )
    }
  })()

  const matches = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.md') && entry.name.startsWith(expectedPrefix))
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))

  if (matches.length !== 1) {
    const detail = matches.length === 0
      ? 'Found none.'
      : `Found ${matches.length}: ${matches.join(', ')}.`
    throw new Error(
      `Comic script shorthand "${scriptReference}" could not be resolved. ` +
      `Expected exactly one Markdown file in "${normalizeProjectPath(episodeDirectory)}" ` +
      `beginning with "${expectedPrefix}". ${detail}`
    )
  }

  return join(episodeDirectory, matches[0]!)
}

export const getCharacterSketchesDirectory = (imagePath: string): string => {
  const stem = imagePath
    .split(/[\\/]/)
    .at(-1)
    ?.replace(/\.[^.]+$/, '')

  if (!stem) {
    throw new Error(`Invalid character image path "${imagePath}"`)
  }

  return join(CHARACTER_SKETCHES_ROOT, stem)
}

export const resolveCharacterInputAlias = (inputPath: string): string => {
  const normalizedPath = normalizeProjectPath(inputPath)
  if (normalizedPath === 'characters' || normalizedPath.startsWith('characters/')) {
    return join(INPUT_ROOT, normalizedPath)
  }

  return inputPath
}
