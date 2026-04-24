import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { ensureDirectory } from '~/utils/cli-utils'
import type { LeafPrompt, Step3Metadata, StructuredRunResult } from '~/types'
import type { RenderedTextArtifactResult } from '~/types'
import { getModelRegistry } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { LeafPromptSchema } from '~/prompts/prompt-loader'
import { validateData } from '~/utils/validate/validation'

const TEXT_INPUT_EXTENSIONS = new Set(['.md', '.txt'])
const TRACK_LINE_PATTERN = /^\s*(\d+)\.\s+(.+?)\s*$/
const PROJECT_ROOT = resolve(import.meta.dir, '../../../../../')
const OUTPUT_ROOT = join(PROJECT_ROOT, 'output')

const promptFileCache = new Map<string, string>()
const promptFileResultCache = new Map<string, PromptFileResult>()
const trackListCache = new Map<string, Map<string, string>>()

export type PromptFileResult =
  | { kind: 'text'; text: string }
  | { kind: 'leaf'; name: string; leaf: LeafPrompt }

export type WriteTextProjectDefaults = {
  projectDir: string
  projectName: string
  textDir: string
  lyricsDir: string
  promptFile: string
  trackList?: string | undefined
  renderedOutDir: string
}

const compareByBasename = (left: string, right: string): number => {
  const byBase = basename(left).localeCompare(basename(right), undefined, {
    numeric: true,
    sensitivity: 'base'
  })
  return byBase !== 0 ? byBase : left.localeCompare(right)
}

const appendTrailingNewline = (value: string): string => `${value.trimEnd()}\n`

const toPosixPath = (value: string): string =>
  value.replace(/\\/g, '/')

const toProjectDisplayPath = (absolutePath: string): string => {
  const rel = relative(PROJECT_ROOT, absolutePath)
  if (rel.length === 0 || rel.startsWith('..') || isAbsolute(rel)) {
    return absolutePath
  }

  return `./${toPosixPath(rel)}`
}

const pathExistsAsFile = async (filePath: string): Promise<boolean> => {
  try {
    return (await stat(filePath)).isFile()
  } catch {
    return false
  }
}

const SERVICE_FILE_SUFFIX: Record<Step3Metadata['llmService'], string> = {
  openai: 'chatgpt',
  anthropic: 'claude',
  gemini: 'gemini',
  groq: 'groq',
  minimax: 'minimax',
  grok: 'grok',
  'llama.cpp': 'llama'
}

const sanitizeModelName = (model: string): string =>
  model.replace(/[/\\:*?"<>|]/g, '-')

const modelFileSuffix = (metadata: Step3Metadata): string =>
  metadata.llmModel
    ? sanitizeModelName(metadata.llmModel)
    : SERVICE_FILE_SUFFIX[metadata.llmService]

const SERVICE_DISPLAY_LABEL: Record<Step3Metadata['llmService'], string> = {
  openai: 'ChatGPT',
  anthropic: 'Claude',
  gemini: 'Gemini',
  groq: 'Groq',
  minimax: 'MiniMax',
  grok: 'Grok',
  'llama.cpp': 'llama.cpp'
}

const toRegistryLlmService = (service: Step3Metadata['llmService']): string =>
  service === 'llama.cpp' ? 'llama' : service

const toTitleCase = (value: string): string =>
  value.replace(/\b[a-z]/g, char => char.toUpperCase())

const descriptionToDisplayName = (description: string): string => {
  const parts = description.split(/\s+[\u2013\u2014-]\s+/u, 2)
  const displayName = parts[0]?.trim() ?? description.trim()
  const detail = parts[1]?.trim()

  const variantMatch = detail?.match(/^((?:non-)?reasoning) model$/i)
  if (variantMatch?.[1]) {
    return `${displayName} ${toTitleCase(variantMatch[1])}`
  }

  return displayName
}

export const formatRenderedLlmLabel = (metadata: Pick<Step3Metadata, 'llmService' | 'llmModel'>): string => {
  const registryService = toRegistryLlmService(metadata.llmService)
  const description = getModelRegistry().llm[registryService]?.models[metadata.llmModel]?.description
  if (description) {
    const displayName = descriptionToDisplayName(description)
    if (displayName.length > 0) {
      return displayName
    }
  }

  return metadata.llmModel || SERVICE_DISPLAY_LABEL[metadata.llmService]
}

const buildInternalRenderedFileName = (
  metadata: Step3Metadata,
  singleTarget: boolean
): string =>
  singleTarget
    ? 'text.md'
    : `text-${modelFileSuffix(metadata)}.md`

const buildExternalRenderedFileName = (
  baseName: string,
  metadata: Step3Metadata
): string => `${baseName}-${modelFileSuffix(metadata)}.md`

const buildInternalArtifactKey = (
  metadata: Step3Metadata,
  singleTarget: boolean
): string =>
  singleTarget
    ? 'rendered'
    : `rendered-${modelFileSuffix(metadata)}`

const stripLeadingTitleHeading = (content: string, title: string): string => {
  const normalized = content.trimStart()
  const [firstLine, ...rest] = normalized.split(/\r?\n/)
  const headingMatch = firstLine?.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/u)
  if (headingMatch?.[1]?.trim() !== title.trim()) {
    return content
  }

  return rest.join('\n').replace(/^\s*\n/u, '')
}

const withTrackHeader = (
  content: string,
  sourcePath: string | undefined,
  metadata: Pick<Step3Metadata, 'llmService' | 'llmModel'>,
  tracks: Map<string, string> | undefined
): string => {
  if (!sourcePath || !tracks || tracks.size === 0) {
    return content
  }

  const trackNumber = extractTrackNumber(sourcePath)
  if (!trackNumber) {
    return content
  }

  const title = tracks.get(trackNumber)
  if (!title) {
    return content
  }

  const contentWithoutDuplicateTitle = stripLeadingTitleHeading(content, title)
  return `${trackNumber}. ${title} (${formatRenderedLlmLabel(metadata)})\n\n${contentWithoutDuplicateTitle}`
}

export const isTextInputPath = (value: string): boolean =>
  TEXT_INPUT_EXTENSIONS.has(extname(value).toLowerCase())

export const resolveWriteTextProjectDefaults = async (
  target: string,
  options: {
    promptFile?: string | undefined
    trackList?: string | undefined
    renderedOutDir?: string | undefined
  },
  explicitFlags: Set<string>
): Promise<WriteTextProjectDefaults | undefined> => {
  if (/^https?:\/\//i.test(target)) {
    return undefined
  }

  const absoluteTarget = resolve(PROJECT_ROOT, target)
  const relativeToOutput = relative(OUTPUT_ROOT, absoluteTarget)
  if (relativeToOutput.length === 0 || relativeToOutput.startsWith('..') || isAbsolute(relativeToOutput)) {
    return undefined
  }

  const parts = toPosixPath(relativeToOutput).split('/').filter(Boolean)
  if (parts.length < 2 || parts[1] !== 'text') {
    return undefined
  }

  const projectName = parts[0]
  if (!projectName) {
    return undefined
  }

  const isTextDirTarget = parts.length === 2
  const isTextFileTarget = parts.length > 2 && isTextInputPath(absoluteTarget)
  if (!isTextDirTarget && !isTextFileTarget) {
    return undefined
  }

  const projectDir = join(OUTPUT_ROOT, projectName)
  const textDir = join(projectDir, 'text')
  const lyricsDir = join(projectDir, 'lyrics')
  const promptFile = explicitFlags.has('prompt-file') && options.promptFile
    ? options.promptFile
    : toProjectDisplayPath(join(projectDir, 'prompt.md'))

  let trackList: string | undefined
  if (explicitFlags.has('track-list')) {
    trackList = options.trackList
  } else {
    const autoTrackList = join(projectDir, 'tracks.md')
    trackList = await pathExistsAsFile(autoTrackList)
      ? toProjectDisplayPath(autoTrackList)
      : undefined
  }

  const renderedOutDir = explicitFlags.has('rendered-out-dir') && options.renderedOutDir
    ? options.renderedOutDir
    : toProjectDisplayPath(lyricsDir)

  return {
    projectDir: toProjectDisplayPath(projectDir),
    projectName,
    textDir: toProjectDisplayPath(textDir),
    lyricsDir: toProjectDisplayPath(lyricsDir),
    promptFile,
    ...(trackList ? { trackList } : {}),
    renderedOutDir
  }
}

export const extractTrackNumber = (filePath: string): string | undefined => {
  const stem = basename(filePath, extname(filePath))
  const match = stem.match(/^(?:text-)?(\d+)(?:-|$)/)
  return match?.[1] ? match[1].padStart(2, '0') : undefined
}

export const estimatePromptTokensFromText = (value: string): number =>
  Math.max(0, Math.ceil(value.trim().length / 4))

export const collectTextInputFiles = async (dir: string): Promise<string[]> => {
  const files: string[] = []

  const walk = async (currentDir: string): Promise<void> => {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const entryPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(entryPath)
        continue
      }

      if (entry.isFile() && isTextInputPath(entryPath)) {
        files.push(entryPath)
      }
    }
  }

  try {
    await walk(dir)
  } catch {
    return []
  }

  files.sort(compareByBasename)
  return files
}

export const readPromptFileText = async (filePath: string | undefined): Promise<string | undefined> => {
  if (!filePath) {
    return undefined
  }

  if (promptFileCache.has(filePath)) {
    return promptFileCache.get(filePath)
  }

  let fileStat
  try {
    fileStat = await stat(filePath)
  } catch {
    throw new Error(`Prompt file not found: ${filePath}`)
  }

  if (!fileStat.isFile()) {
    throw new Error(`Prompt file is not a regular file: ${filePath}`)
  }

  const text = await readFile(filePath, 'utf8')
  const normalized = text.trim()
  promptFileCache.set(filePath, normalized)
  return normalized.length > 0 ? normalized : undefined
}

export const readPromptFile = async (filePath: string | undefined): Promise<PromptFileResult | undefined> => {
  if (!filePath) {
    return undefined
  }

  if (promptFileResultCache.has(filePath)) {
    return promptFileResultCache.get(filePath)
  }

  let fileStat
  try {
    fileStat = await stat(filePath)
  } catch {
    throw new Error(`Prompt file not found: ${filePath}`)
  }

  if (!fileStat.isFile()) {
    throw new Error(`Prompt file is not a regular file: ${filePath}`)
  }

  const text = await readFile(filePath, 'utf8')
  const normalized = text.trim()

  if (normalized.length === 0) {
    return undefined
  }

  if (extname(filePath).toLowerCase() === '.json') {
    let rawEntry: unknown
    try {
      rawEntry = JSON.parse(normalized) as unknown
    } catch {
      throw new Error(`Prompt file is not valid JSON: ${filePath}`)
    }

    const leaf = validateData(LeafPromptSchema, rawEntry, `prompt file at ${filePath}`)
    const name = basename(filePath, '.json')
    const result: PromptFileResult = { kind: 'leaf', name, leaf: leaf as LeafPrompt }
    promptFileResultCache.set(filePath, result)
    return result
  }

  const result: PromptFileResult = { kind: 'text', text: normalized }
  promptFileResultCache.set(filePath, result)
  return result
}

export const loadTrackTitles = async (filePath: string | undefined): Promise<Map<string, string> | undefined> => {
  if (!filePath) {
    return undefined
  }

  const cached = trackListCache.get(filePath)
  if (cached) {
    return cached
  }

  let fileStat
  try {
    fileStat = await stat(filePath)
  } catch {
    throw new Error(`Track list not found: ${filePath}`)
  }

  if (!fileStat.isFile()) {
    throw new Error(`Track list is not a regular file: ${filePath}`)
  }

  const content = await readFile(filePath, 'utf8')
  const tracks = new Map<string, string>()
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(TRACK_LINE_PATTERN)
    if (!match) {
      continue
    }

    const trackNumber = match[1]
    const title = match[2]
    if (!trackNumber || !title) {
      continue
    }

    tracks.set(trackNumber.padStart(2, '0'), title.trim())
  }

  trackListCache.set(filePath, tracks)
  return tracks
}

export const resolveTextInputSongTitle = async (
  inputPath: string,
  trackListPath: string | undefined
): Promise<string> => {
  const tracks = await loadTrackTitles(trackListPath)
  const trackNumber = extractTrackNumber(inputPath)
  const trackTitle = trackNumber ? tracks?.get(trackNumber) : undefined

  return trackTitle && trackTitle.length > 0
    ? trackTitle
    : getTextInputTitle(inputPath)
}

export const buildTextInputPrompt = (
  text: string,
  options: {
    title: string
    sourcePath: string
    instruction: string
  }
): string => {
  const frontmatter = [
    `title: "${options.title.replace(/"/g, '\\"')}"`,
    `sourcePath: "${options.sourcePath.replace(/"/g, '\\"')}"`
  ].join('\n')

  return `---\n${frontmatter}\n---\n\nThis is user-provided source text. Do not use the word delve.\n\n${options.instruction}\n\nSource Text:\n${text}`
}

export const getTextInputTitle = (inputPath: string): string =>
  basename(inputPath, extname(inputPath))

export const writeRenderedTextArtifacts = async (options: {
  outputDir: string
  results: StructuredRunResult[]
  writeInternal: boolean
  sourcePath?: string | undefined
  trackListPath?: string | undefined
  externalDir?: string | undefined
  externalBaseName?: string | undefined
}): Promise<RenderedTextArtifactResult> => {
  const { outputDir, results, writeInternal, sourcePath, trackListPath, externalDir, externalBaseName } = options
  const internalArtifacts: Record<string, string> = {}
  const externalFiles: string[] = []

  if (!writeInternal && (!externalDir || !externalBaseName)) {
    return { internalArtifacts, externalFiles }
  }

  const tracks = await loadTrackTitles(trackListPath)
  const singleTarget = results.length === 1

  if (externalDir && externalBaseName) {
    await ensureDirectory(externalDir)
  }

  for (const result of results) {
    const rendered = appendTrailingNewline(
      withTrackHeader(result.renderedText, sourcePath, result.metadata, tracks)
    )

    if (writeInternal) {
      const fileName = buildInternalRenderedFileName(result.metadata, singleTarget)
      await Bun.write(join(outputDir, fileName), rendered)
      internalArtifacts[buildInternalArtifactKey(result.metadata, singleTarget)] = fileName
    }

    if (externalDir && externalBaseName) {
      const fileName = buildExternalRenderedFileName(externalBaseName, result.metadata)
      const absolutePath = join(externalDir, fileName)
      await Bun.write(absolutePath, rendered)
      externalFiles.push(absolutePath)
    }
  }

  return { internalArtifacts, externalFiles }
}
