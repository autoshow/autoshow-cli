import type { RuntimeOptions } from '~/types'
import type { ResolvedLLMConfig } from '~/types'
export type { ResolvedLLMConfig } from '~/types'


export const DEFAULT_LLAMA_MODEL = 'ggml-org/gemma-3-270m-it-GGUF'

export const resolveLLMDefaults = (opts: RuntimeOptions): ResolvedLLMConfig => {
  const llamaModels = opts.llamaModels
  const openaiModels = opts.openaiModels
  const groqModels = opts.groqModels
  const geminiModels = opts.geminiModels
  const anthropicModels = opts.anthropicModels
  const minimaxModels = opts.minimaxModels
  const grokModels = opts.grokModels
  const anySelected = [
    openaiModels?.length,
    groqModels?.length,
    geminiModels?.length,
    anthropicModels?.length,
    minimaxModels?.length,
    grokModels?.length,
    llamaModels?.length
  ].some((value) => typeof value === 'number' && value > 0)

  const resolvedLlamaModels = llamaModels
    ? llamaModels
    : anySelected
      ? undefined
      : [DEFAULT_LLAMA_MODEL]

  const first = (models: string[] | undefined): string | undefined => models?.[0]

  return {
    llamaModels: resolvedLlamaModels,
    llamaModel: first(resolvedLlamaModels),
    openaiModels,
    openaiModel: first(openaiModels),
    groqModels,
    groqModel: first(groqModels),
    geminiModels,
    geminiModel: first(geminiModels),
    anthropicModels,
    anthropicModel: first(anthropicModels),
    minimaxModels,
    minimaxModel: first(minimaxModels),
    grokModels,
    grokModel: first(grokModels),
    llmService: openaiModels?.length ? 'openai'
      : groqModels?.length ? 'groq'
        : geminiModels?.length ? 'gemini'
          : anthropicModels?.length ? 'anthropic'
            : minimaxModels?.length ? 'minimax'
              : grokModels?.length ? 'grok'
                : resolvedLlamaModels?.length ? 'llama.cpp'
                  : undefined,
    llmModel: first(openaiModels)
      ?? first(groqModels)
      ?? first(geminiModels)
      ?? first(anthropicModels)
      ?? first(minimaxModels)
      ?? first(grokModels)
      ?? first(resolvedLlamaModels)
      ?? DEFAULT_LLAMA_MODEL,
  }
}
