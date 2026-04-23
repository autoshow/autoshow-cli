import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { AnthropicOcrModel, GeminiOcrModel, GlmOcrModel, MistralOcrModel, OpenAIOcrModel } from '../setup-and-utilities-types'
export type { AnthropicOcrModel, GeminiOcrModel, GlmOcrModel, MistralOcrModel, OpenAIOcrModel } from '../setup-and-utilities-types'

export const SUPPORTED_MISTRAL_OCR_MODELS = [
  'mistral-ocr-2512'
] as const satisfies readonly string[]

export const validateMistralOcrModel = createModelValidator<MistralOcrModel>(SUPPORTED_MISTRAL_OCR_MODELS, 'mistral-ocr')

export const SUPPORTED_GLM_OCR_MODELS = [
  'glm-ocr'
] as const satisfies readonly string[]

export const validateGlmOcrModel = createModelValidator<GlmOcrModel>(SUPPORTED_GLM_OCR_MODELS, 'glm-ocr')

export const SUPPORTED_OPENAI_OCR_MODELS = [
  'gpt-5.4',
  'gpt-5.4-pro',
  'gpt-5.4-mini',
  'gpt-5.4-nano'
] as const satisfies readonly string[]

export const validateOpenAIOcrModel = createModelValidator<OpenAIOcrModel>(SUPPORTED_OPENAI_OCR_MODELS, 'openai-ocr')

export const SUPPORTED_ANTHROPIC_OCR_MODELS = [
  'claude-haiku-4-5',
  'claude-sonnet-4-6',
  'claude-opus-4-7'
] as const satisfies readonly string[]

export const validateAnthropicOcrModel = createModelValidator<AnthropicOcrModel>(SUPPORTED_ANTHROPIC_OCR_MODELS, 'anthropic-ocr')

export const SUPPORTED_GEMINI_OCR_MODELS = [
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite-preview'
] as const satisfies readonly string[]

export const validateGeminiOcrModel = createModelValidator<GeminiOcrModel>(SUPPORTED_GEMINI_OCR_MODELS, 'gemini-ocr')
