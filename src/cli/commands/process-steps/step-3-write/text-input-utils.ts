import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { ensureDirectory } from '~/utils/cli-utils'
import type { Step3Metadata, StructuredRunResult } from '~/types'

const TEXT_INPUT_EXTENSIONS = new Set(['.md', '.txt'])
const TRACK_LINE_PATTERN = /^\s*(\d+)\.\s+(.+?)\s*$/

const promptFileCache = new Map<string, string>()
const trackListCache = new Map<string, Map<string, string>>()

const compareByBasename = (left: string, right: string): number => {
  const byBase = basename(left).localeCompare(basename(right), undefined, {
    numeric: true,
    sensitivity: 'base'
  })
  return byBase !== 0 ? byBase : left.localeCompare(right)
}

const appendTrailingNewline = (value: string): string => `${value.trimEnd()}\n`

const SERVICE_FILE_SUFFIX: Record<Step3Metadata['llmService'], string> = {
  openai: 'chatgpt',
  anthropic: 'claude',
  gemini: 'gemini',
  groq: 'groq',
  minimax: 'minimax',
  grok: 'grok',
  'llama.cpp': 'llama'
}

const SERVICE_DISPLAY_LABEL: Record<Step3Metadata['llmService'], string> = {
  openai: 'ChatGPT',
  anthropic: 'Claude',
  gemini: 'Gemini',
  groq: 'Groq',
  minimax: 'MiniMax',
  grok: 'Grok',
  'llama.cpp': 'llama.cpp'
}

const buildInternalRenderedFileName = (
  metadata: Step3Metadata,
  singleTarget: boolean
): string =>
  singleTarget
    ? 'text.md'
    : `text-${SERVICE_FILE_SUFFIX[metadata.llmService]}.md`

const buildExternalRenderedFileName = (
  baseName: string,
  metadata: Step3Metadata
): string => `${baseName}-${SERVICE_FILE_SUFFIX[metadata.llmService]}.md`

const buildInternalArtifactKey = (
  metadata: Step3Metadata,
  singleTarget: boolean
): string =>
  singleTarget
    ? 'rendered'
    : `rendered-${SERVICE_FILE_SUFFIX[metadata.llmService]}`

const withTrackHeader = (
  content: string,
  sourcePath: string | undefined,
  service: Step3Metadata['llmService'],
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

  return `${trackNumber}. ${title} (${SERVICE_DISPLAY_LABEL[service]})\n\n${content}`
}

export const isTextInputPath = (value: string): boolean =>
  TEXT_INPUT_EXTENSIONS.has(extname(value).toLowerCase())

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

export type RenderedTextArtifactResult = {
  internalArtifacts: Record<string, string>
  externalFiles: string[]
}

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
      withTrackHeader(result.renderedText, sourcePath, result.metadata.llmService, tracks)
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
