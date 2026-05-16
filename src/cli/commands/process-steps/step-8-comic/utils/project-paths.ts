import { basename, extname, join } from 'node:path'

export const INPUT_ROOT = 'input'
export const OUTPUT_ROOT = 'output'

export const COMIC_OUTPUT_ROOT = join(OUTPUT_ROOT, 'comic')
export const CHARACTER_INPUT_ROOT = join(INPUT_ROOT, 'characters')
export const CHARACTER_SKETCHES_ROOT = join(OUTPUT_ROOT, 'characters', 'sketches')

export const getSceneOutputDirectory = (sceneSlug: string): string =>
  join(COMIC_OUTPUT_ROOT, sceneSlug)

export const getStructuredScriptPath = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'structured-script.json')

export const getDraftPromptPath = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'draft-prompt.md')

export const getSceneJsonPath = (sceneSlug: string): string =>
  join(getSceneOutputDirectory(sceneSlug), 'scene.json')

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
