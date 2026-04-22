import { getLlamaDownloadRepo } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { CLIUsageError } from '~/utils/error-handler'
import type { GroqModel, AnthropicModel, MinimaxModel } from '~/types'
export type { GroqModel, AnthropicModel, MinimaxModel } from '~/types'

export const SUPPORTED_OPENAI_MODELS = [
  'gpt-5.4',
  'gpt-5.4-pro',
  'gpt-5.4-mini',
  'gpt-5.4-nano'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_MODELS = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b'
] as const satisfies readonly string[]

export const SUPPORTED_GEMINI_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite-preview',
] as const satisfies readonly string[]

export const SUPPORTED_ANTHROPIC_MODELS = [
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'claude-opus-4-6',
] as const satisfies readonly string[]

export const SUPPORTED_MINIMAX_MODELS = [
  'MiniMax-M2.5',
  'MiniMax-M2.5-highspeed'
] as const satisfies readonly string[]

export const SUPPORTED_GROK_MODELS = [
  'grok-4.20-reasoning',
  'grok-4.20-non-reasoning'
] as const satisfies readonly string[]

export const SUPPORTED_LLAMA_MODELS = [
  'ggml-org/gemma-3-270m-it-GGUF',
  'ggml-org/Qwen3-0.6B-GGUF'
] as const satisfies readonly string[]

const HUGGING_FACE_REPO_ID_PATTERN = /^[^/\s]+\/[^/\s]+$/

const _validateOpenAI = createModelValidator(SUPPORTED_OPENAI_MODELS, 'openai')
export const validateOpenAIModel = (model: string): string => _validateOpenAI(model)

const _validateGroqRaw = createModelValidator<GroqModel>(SUPPORTED_GROQ_MODELS, 'groq')
export const validateGroqModel = (model: string): GroqModel => _validateGroqRaw(model)

export const validateGeminiModel = createModelValidator(SUPPORTED_GEMINI_MODELS, 'gemini')
export const validateAnthropicModel = createModelValidator<AnthropicModel>(SUPPORTED_ANTHROPIC_MODELS, 'anthropic')
export const validateMinimaxModel = createModelValidator<MinimaxModel>(SUPPORTED_MINIMAX_MODELS, 'minimax')
export const validateGrokModel = createModelValidator(SUPPORTED_GROK_MODELS, 'grok')
export const validateLlamaModel = (model: string): string => {
  if (SUPPORTED_LLAMA_MODELS.includes(model as typeof SUPPORTED_LLAMA_MODELS[number])) {
    return model
  }

  if (HUGGING_FACE_REPO_ID_PATTERN.test(model)) {
    return model
  }

  throw CLIUsageError(
    `Invalid --llama model "${model}". Use a supported local model alias or a Hugging Face repo ID in namespace/repo_name form.`
  )
}

export const resolveLlamaDownloadRepo = (model: string): string => {
  return getLlamaDownloadRepo(model) || model
}
