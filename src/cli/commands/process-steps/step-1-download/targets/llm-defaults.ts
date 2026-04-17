import type { RuntimeOptions } from '~/types'
import type { ResolvedLLMConfig } from '~/types'
export type { ResolvedLLMConfig } from '~/types'


export const DEFAULT_LLAMA_MODEL = 'ggml-org/gemma-3-270m-it-GGUF'

export const resolveLLMDefaults = (opts: RuntimeOptions): ResolvedLLMConfig => {
  const anySelected = [
    opts.openaiModel,
    opts.groqModel,
    opts.geminiModel,
    opts.anthropicModel,
    opts.minimaxModel,
    opts.grokModel,
    opts.llamaModel
  ].some((value) => typeof value === 'string' && value.length > 0)

  return {
    llamaModel: opts.llamaModel
      ? opts.llamaModel
      : anySelected
        ? undefined
        : DEFAULT_LLAMA_MODEL,
    openaiModel: opts.openaiModel,
    groqModel: opts.groqModel,
    geminiModel: opts.geminiModel,
    anthropicModel: opts.anthropicModel,
    minimaxModel: opts.minimaxModel,
    grokModel: opts.grokModel,
    llmService: opts.openaiModel ? 'openai'
      : opts.groqModel ? 'groq'
        : opts.geminiModel ? 'gemini'
          : opts.anthropicModel ? 'anthropic'
            : opts.minimaxModel ? 'minimax'
              : opts.grokModel ? 'grok'
                : (opts.llamaModel || !anySelected) ? 'llama.cpp'
                  : undefined,
    llmModel: opts.openaiModel
      ?? opts.groqModel
      ?? opts.geminiModel
      ?? opts.anthropicModel
      ?? opts.minimaxModel
      ?? opts.grokModel
      ?? opts.llamaModel
      ?? DEFAULT_LLAMA_MODEL,
  }
}
