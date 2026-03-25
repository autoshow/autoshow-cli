import { resolve } from 'node:path'
import * as v from 'valibot'
import { validateData } from '~/utils/validate/validation'
import type {
  LeafPrompt,
  PromptEntry,
  PromptExampleFormat,
  PromptExamples,
  PromptTokenEstimate,
  PromptsRegistry,
  ResolvedLeafPrompt
} from '~/types'


const LeafPromptSchema = v.object({
  description: v.string(),
  expectedInputTokens: v.pipe(v.number(), v.integer(), v.minValue(0)),
  expectedOutputTokens: v.pipe(v.number(), v.integer(), v.minValue(0)),
  instruction: v.string(),
  examples: v.object({
    json: v.string(),
    markdown: v.string()
  }),
  structuredPreset: v.optional(v.string(), undefined)
})

const CompositePromptSchema = v.object({
  description: v.string(),
  includes: v.array(v.string())
})

const PromptsRegistrySchema = v.record(v.string(), v.union([LeafPromptSchema, CompositePromptSchema]))

const PROMPTS_PATH = resolve(import.meta.dir, 'prompts.json')

let cachedRegistry: PromptsRegistry | undefined

const isLeaf = (entry: PromptEntry): entry is LeafPrompt => 'instruction' in entry

const getPromptExample = (examples: PromptExamples, exampleFormat: PromptExampleFormat): string =>
  examples[exampleFormat]

const stripMarkdownExamplePrefix = (example: string): string => {
  const prefixMatch = example.match(/^\s*Format the output like so:(?:\r?\n)+/u)
  const stripped = prefixMatch ? example.slice(prefixMatch[0].length) : example
  return stripped.trimEnd()
}

const stripJsonExamplePrefix = (example: string): string =>
  example.replace(/^\s*Example JSON output:\s*/u, '').trim()

const normalizeExampleText = (
  example: string,
  exampleFormat: PromptExampleFormat
): string => {
  if (exampleFormat === 'markdown') {
    return stripMarkdownExamplePrefix(example)
  }

  return stripJsonExamplePrefix(example)
}

const tryBuildCombinedJsonExample = (leaves: ResolvedLeafPrompt[]): string | undefined => {
  if (leaves.length <= 1) {
    return undefined
  }

  try {
    const combined = Object.fromEntries(
      leaves.map(({ name, entry }) => [name, JSON.parse(normalizeExampleText(entry.examples.json, 'json'))])
    )
    return JSON.stringify(combined, null, 2)
  } catch {
    return undefined
  }
}

const buildExamplesText = (
  leaves: ResolvedLeafPrompt[],
  exampleFormat: PromptExampleFormat
): string => {
  const normalizedExamples = leaves
    .map(({ entry }) => normalizeExampleText(getPromptExample(entry.examples, exampleFormat), exampleFormat))
    .filter((example) => example.length > 0)

  if (normalizedExamples.length === 0) {
    return ''
  }

  if (exampleFormat === 'markdown') {
    return `Format the output like so:\n\n${normalizedExamples.join('\n\n')}`
  }

  const combinedJsonExample = tryBuildCombinedJsonExample(leaves)
  if (combinedJsonExample) {
    return `Example JSON output:\n\n${combinedJsonExample}`
  }

  return `Example JSON output:\n\n${normalizedExamples[0]}`
}

const resolveRequestedPromptNames = (names: string[]): string[] =>
  names.length === 0 ? ['default'] : names

const collectLeafPromptsFromRegistry = (registry: PromptsRegistry, names: string[]): ResolvedLeafPrompt[] => {
  const available = Object.keys(registry)
  const resolved = resolveRequestedPromptNames(names)
  const leaves: ResolvedLeafPrompt[] = []
  const seen = new Set<string>()

  const collect = (name: string, stack: string[]): void => {
    if (stack.includes(name)) {
      throw new Error(
        `Circular prompt include detected: ${[...stack, name].join(' → ')}`
      )
    }

    if (!registry[name]) {
      throw new Error(
        `Unknown prompt "${name}". Available: ${available.join(', ')}`
      )
    }

    const entry = registry[name] as PromptEntry

    if (isLeaf(entry)) {
      if (!seen.has(name)) {
        seen.add(name)
        leaves.push({ name, entry })
      }
      return
    }

    for (const child of entry.includes) {
      collect(child, [...stack, name])
    }
  }

  for (const name of resolved) {
    collect(name, [])
  }

  return leaves
}

const loadPrompts = async (): Promise<PromptsRegistry> => {
  if (cachedRegistry !== undefined) return cachedRegistry

  const file = Bun.file(PROMPTS_PATH)
  if (!await file.exists()) {
    throw new Error(`Prompts registry not found at ${PROMPTS_PATH}`)
  }

  let raw: unknown
  try {
    raw = await file.json()
  } catch {
    throw new Error(`Failed to parse prompts registry at ${PROMPTS_PATH}: invalid JSON`)
  }

  const validated = validateData(PromptsRegistrySchema, raw, `prompts registry at ${PROMPTS_PATH}`)
  cachedRegistry = validated
  return validated
}

export const resolvePromptNames = async (
  names: string[],
  options: { exampleFormat?: PromptExampleFormat } = {}
): Promise<string> => {
  const registry = await loadPrompts()
  const exampleFormat = options.exampleFormat ?? 'json'
  const leaves = collectLeafPromptsFromRegistry(registry, names)

  const instructionsText = leaves
    .map(({ entry }) => entry.instruction.trim())
    .filter((instruction) => instruction.length > 0)
    .join('\n\n')

  const examplesText = buildExamplesText(leaves, exampleFormat)

  return [instructionsText, examplesText]
    .filter((section) => section.length > 0)
    .join('\n\n')
}

export const resolvePromptTokenEstimate = async (names: string[]): Promise<PromptTokenEstimate> => {
  const registry = await loadPrompts()
  const leaves = collectLeafPromptsFromRegistry(registry, names)

  const estimatedInputTokens = leaves.reduce((sum, leaf) => sum + leaf.entry.expectedInputTokens, 0)
  const estimatedOutputTokens = leaves.reduce((sum, leaf) => sum + leaf.entry.expectedOutputTokens, 0)

  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    resolvedLeafPromptNames: leaves.map(leaf => leaf.name)
  }
}

export const getAvailablePromptNames = async (): Promise<string[]> => {
  const registry = await loadPrompts()
  return Object.keys(registry)
}

export const collectLeafPrompts = async (names: string[]): Promise<ResolvedLeafPrompt[]> => {
  const registry = await loadPrompts()
  return collectLeafPromptsFromRegistry(registry, names)
}

export const resolvePresetNames = async (names: string[]): Promise<string[]> => {
  const leaves = await collectLeafPrompts(names)
  return leaves.map(({ name, entry }) => entry.structuredPreset ?? name)
}
