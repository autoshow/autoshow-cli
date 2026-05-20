import * as v from 'valibot'

export const LlamaResponseSchema = v.object({
  choices: v.array(v.object({
    message: v.object({
      content: v.string()
    })
  })),
  usage: v.optional(v.object({
    prompt_tokens: v.number(),
    completion_tokens: v.number(),
    total_tokens: v.number()
  }), undefined)
})

export type Step3Metadata = {
  llmService: 'llama.cpp' | 'openai' | 'groq' | 'gemini' | 'anthropic' | 'minimax' | 'grok' | 'glm' | 'kimi'
  llmModel: string
  providerReturnedModel?: string | undefined
  processingTime: number
  inputTokenCount: number
  outputTokenCount: number
  tokenCountSource?: 'provider_usage' | 'local_count' | undefined
  providerUsage?: {
    inputTokenCount?: number | undefined
    outputTokenCount?: number | undefined
    totalTokenCount?: number | undefined
  } | undefined
  rawProviderUsage?: unknown
  outputFileName: string
  outputFormat: 'json'
  structuredMode: 'native' | 'schema-guided'
  structuredPresetNames: string[]
}
