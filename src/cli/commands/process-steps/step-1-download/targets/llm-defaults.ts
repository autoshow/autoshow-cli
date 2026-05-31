import type { RuntimeOptions } from '~/types'
import type { ResolvedLLMConfig } from '~/types'

const DEFAULT_LLAMA_MODEL = 'ggml-org/gemma-3-270m-it-GGUF'

type LLMModelOptionKey = Exclude<keyof ResolvedLLMConfig, 'llmService' | 'llmModel'>

export type ResolvedLLMModelOptions = Pick<ResolvedLLMConfig, LLMModelOptionKey>

export const buildLLMModelOptions = (config: ResolvedLLMConfig): ResolvedLLMModelOptions => ({
  llamaModels: config.llamaModels,
  llamaModel: config.llamaModel,
  openaiModels: config.openaiModels,
  openaiModel: config.openaiModel,
  groqModels: config.groqModels,
  groqModel: config.groqModel,
  geminiModels: config.geminiModels,
  geminiModel: config.geminiModel,
  anthropicModels: config.anthropicModels,
  anthropicModel: config.anthropicModel,
  minimaxModels: config.minimaxModels,
  minimaxModel: config.minimaxModel,
  grokModels: config.grokModels,
  grokModel: config.grokModel,
  glmModels: config.glmModels,
  glmModel: config.glmModel,
  kimiModels: config.kimiModels,
  kimiModel: config.kimiModel,
})

export const resolveLLMDefaults = (opts: RuntimeOptions): ResolvedLLMConfig => {
  const llamaModels = opts.llamaModels
  const openaiModels = opts.openaiModels
  const groqModels = opts.groqModels
  const geminiModels = opts.geminiModels
  const anthropicModels = opts.anthropicModels
  const minimaxModels = opts.minimaxModels
  const grokModels = opts.grokModels
  const glmModels = opts.glmModels
  const kimiModels = opts.kimiModels
  const anySelected = [
    openaiModels?.length,
    groqModels?.length,
    geminiModels?.length,
    anthropicModels?.length,
    minimaxModels?.length,
    grokModels?.length,
    glmModels?.length,
    kimiModels?.length,
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
    glmModels,
    glmModel: first(glmModels),
    kimiModels,
    kimiModel: first(kimiModels),
    llmService: openaiModels?.length ? 'openai'
      : groqModels?.length ? 'groq'
        : geminiModels?.length ? 'gemini'
          : anthropicModels?.length ? 'anthropic'
            : minimaxModels?.length ? 'minimax'
              : grokModels?.length ? 'grok'
                : glmModels?.length ? 'glm'
                  : kimiModels?.length ? 'kimi'
                    : resolvedLlamaModels?.length ? 'llama.cpp'
                      : undefined,
    llmModel: first(openaiModels)
      ?? first(groqModels)
      ?? first(geminiModels)
      ?? first(anthropicModels)
      ?? first(minimaxModels)
      ?? first(grokModels)
      ?? first(glmModels)
      ?? first(kimiModels)
      ?? first(resolvedLlamaModels)
      ?? DEFAULT_LLAMA_MODEL,
  }
}
