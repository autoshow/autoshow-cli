export type LeafPrompt = {
  description: string
  expectedInputTokens: number
  expectedOutputTokens: number
  instruction: string
  example: string
  structuredPreset?: string | undefined
}

export type CompositePrompt = {
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
