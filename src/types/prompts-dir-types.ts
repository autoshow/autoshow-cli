export type PromptExampleFormat = 'json' | 'markdown'

export type PromptExamples = {
  json: string
  markdown: string
}

export type LeafPrompt = {
  description: string
  expectedInputTokens: number
  expectedOutputTokens: number
  instruction: string
  examples: PromptExamples
  structuredPreset?: string | undefined
}

type CompositePrompt = {
  description: string
  includes: string[]
}

export type PromptEntry = LeafPrompt | CompositePrompt

export type PromptsRegistry = Record<string, PromptEntry>

export type PromptTokenEstimate = {
  estimatedInputTokens: number
  estimatedOutputTokens: number
  resolvedLeafPromptNames: string[]
}

export type ResolvedLeafPrompt = {
  name: string
  entry: LeafPrompt
}
