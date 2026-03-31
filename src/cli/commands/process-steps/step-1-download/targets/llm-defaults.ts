import type { RuntimeOptions } from '~/types'
import type { ResolvedLLMConfig } from '~/types'
export type { ResolvedLLMConfig } from '~/types'


export const DEFAULT_LLAMA_MODEL = 'ggml-org/gemma-3-270m-it-GGUF'

export const resolveLLMDefaults = (opts: RuntimeOptions): ResolvedLLMConfig => {
  const useOpenAIArg = opts.useOpenAI && !!opts.openaiModel
  const useGroqArg = !!opts.groqModel
  const useGeminiArg = opts.useGemini && !!opts.geminiModel
  const useAnthropicArg = opts.useAnthropic && !!opts.anthropicModel
  const useMinimaxArg = !!opts.minimaxModel
  const useGrokArg = !!opts.grokModel
  const useLlamaArg = !!opts.llamaModel

  const anySelected = useOpenAIArg || useGroqArg || useGeminiArg || useAnthropicArg || useMinimaxArg || useGrokArg || useLlamaArg

  return {
    useOpenAI: useOpenAIArg,
    useGroq: useGroqArg,
    useGemini: useGeminiArg,
    useAnthropic: useAnthropicArg,
    useMinimax: useMinimaxArg,
    llamaModel: useLlamaArg
      ? opts.llamaModel
      : anySelected
        ? undefined
        : DEFAULT_LLAMA_MODEL,
    openaiModel: useOpenAIArg ? opts.openaiModel : undefined,
    groqModel: useGroqArg ? opts.groqModel : undefined,
    geminiModel: useGeminiArg ? opts.geminiModel : undefined,
    anthropicModel: useAnthropicArg ? opts.anthropicModel : undefined,
    minimaxModel: useMinimaxArg ? opts.minimaxModel : undefined,
    grokModel: useGrokArg ? opts.grokModel : undefined,
    llmService: useOpenAIArg ? 'openai'
      : useGroqArg ? 'groq'
        : useGeminiArg ? 'gemini'
          : useAnthropicArg ? 'anthropic'
            : useMinimaxArg ? 'minimax'
              : useGrokArg ? 'grok'
                : (useLlamaArg || !anySelected) ? 'llama.cpp'
                  : undefined,
    llmModel: useOpenAIArg ? opts.openaiModel
      : useGroqArg ? opts.groqModel
        : useGeminiArg ? opts.geminiModel
          : useAnthropicArg ? opts.anthropicModel
            : useMinimaxArg ? opts.minimaxModel
              : useGrokArg ? opts.grokModel
                : useLlamaArg ? opts.llamaModel
                  : DEFAULT_LLAMA_MODEL,
  }
}
