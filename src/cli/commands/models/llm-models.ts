import { CLIUsageError } from '~/utils/error-handler'
import { getLlamaDownloadRepo } from '~/cli/commands/models/model-loader'
import type { GroqModel, AnthropicModel, MinimaxModel } from '~/types'
export type { GroqModel, AnthropicModel, MinimaxModel } from '~/types'

const formatAllowedValues = (values: readonly string[]): string => values.join(', ')

export const SUPPORTED_OPENAI_MODELS = [
  'gpt-5.2',
  'gpt-5.1',
  'gpt-5.2-pro'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_MODELS = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b'
] as const satisfies readonly string[]

const GROQ_MODEL_ALIASES = {
  'gpt-oss-20b': 'openai/gpt-oss-20b',
  'gpt-oss-120b': 'openai/gpt-oss-120b'
} as const satisfies Record<string, GroqModel>

const normalizeGroqModel = (model: string): string => {
  if (model === 'gpt-oss-20b') return GROQ_MODEL_ALIASES['gpt-oss-20b']
  if (model === 'gpt-oss-120b') return GROQ_MODEL_ALIASES['gpt-oss-120b']
  return model
}

export const SUPPORTED_GEMINI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3-pro-preview',
] as const satisfies readonly string[]

export const SUPPORTED_ANTHROPIC_MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
] as const satisfies readonly string[]

export const SUPPORTED_MINIMAX_MODELS = [
  'MiniMax-M2.5',
  'MiniMax-M2.5-highspeed'
] as const satisfies readonly string[]

export const SUPPORTED_LLAMA_MODELS = [
  'ggml-org/gemma-3-270m-it-GGUF',
  'ggml-org/Qwen3-0.6B-GGUF'
] as const satisfies readonly string[]

export const validateOpenAIModel = (model: string): string => {
  if (!SUPPORTED_OPENAI_MODELS.includes(model as typeof SUPPORTED_OPENAI_MODELS[number])) {
    throw CLIUsageError(
      `Invalid --openai model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_OPENAI_MODELS)}`
    )
  }

  return model
}

export const validateGroqModel = (model: string): GroqModel => {
  const normalizedModel = normalizeGroqModel(model)

  if (!SUPPORTED_GROQ_MODELS.includes(normalizedModel as GroqModel)) {
    throw CLIUsageError(
      `Invalid --groq model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_GROQ_MODELS)}`
    )
  }

  return normalizedModel as GroqModel
}

export const validateGeminiModel = (model: string): string => {
  if (!SUPPORTED_GEMINI_MODELS.includes(model as typeof SUPPORTED_GEMINI_MODELS[number])) {
    throw CLIUsageError(
      `Invalid --gemini model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_GEMINI_MODELS)}`
    )
  }

  return model
}

export const validateAnthropicModel = (model: string): AnthropicModel => {
  if (!SUPPORTED_ANTHROPIC_MODELS.includes(model as AnthropicModel)) {
    throw CLIUsageError(
      `Invalid --anthropic model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_ANTHROPIC_MODELS)}`
    )
  }

  return model as AnthropicModel
}

export const validateMinimaxModel = (model: string): MinimaxModel => {
  if (!SUPPORTED_MINIMAX_MODELS.includes(model as MinimaxModel)) {
    throw CLIUsageError(
      `Invalid --minimax model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_MINIMAX_MODELS)}`
    )
  }

  return model as MinimaxModel
}

export const validateLlamaModel = (model: string): string => {
  if (!SUPPORTED_LLAMA_MODELS.includes(model as typeof SUPPORTED_LLAMA_MODELS[number])) {
    throw CLIUsageError(
      `Invalid --llama model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_LLAMA_MODELS)}`
    )
  }

  return model
}

export const resolveLlamaDownloadRepo = (model: string): string => {
  return getLlamaDownloadRepo(model) || model
}
