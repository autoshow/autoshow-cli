import { GEMINI_IMAGE_MODELS, GEMINI_LLM_MODELS } from './gemini-models'
import { GROK_LLM_MODELS } from './grok-models'
import { OPENAI_IMAGE_MODELS, OPENAI_LLM_MODELS } from './openai-models'
import type {
  GeminiImageGenerationModel,
  GeminiLlmModel,
  GrokLlmModel,
  ImageGenerationModel,
  LlmModel,
  OpenAiImageGenerationModel,
  OpenAiLlmModel,
} from '../types'


export const LLM_MODELS = [...OPENAI_LLM_MODELS, ...GEMINI_LLM_MODELS, ...GROK_LLM_MODELS] as const
export const IMAGE_MODELS = [...OPENAI_IMAGE_MODELS, ...GEMINI_IMAGE_MODELS] as const


export const DEFAULT_LLM_MODEL: LlmModel = 'gpt-5.4'
export const DEFAULT_IMAGE_MODEL: ImageGenerationModel = 'gpt-image-2'

const OPENAI_LLM_MODEL_OPTIONS = new Set<string>(OPENAI_LLM_MODELS)
const GEMINI_LLM_MODEL_OPTIONS = new Set<string>(GEMINI_LLM_MODELS)
const GROK_LLM_MODEL_OPTIONS = new Set<string>(GROK_LLM_MODELS)
const OPENAI_IMAGE_MODEL_OPTIONS = new Set<string>(OPENAI_IMAGE_MODELS)
const GEMINI_IMAGE_MODEL_OPTIONS = new Set<string>(GEMINI_IMAGE_MODELS)

export const isOpenAiLlmModel = (model: LlmModel): model is OpenAiLlmModel => {
  return OPENAI_LLM_MODEL_OPTIONS.has(model)
}

export const isGeminiLlmModel = (model: LlmModel): model is GeminiLlmModel => {
  return GEMINI_LLM_MODEL_OPTIONS.has(model)
}

export const isGrokLlmModel = (model: LlmModel): model is GrokLlmModel => {
  return GROK_LLM_MODEL_OPTIONS.has(model)
}

export const isOpenAiImageModel = (
  model: ImageGenerationModel
): model is OpenAiImageGenerationModel => {
  return OPENAI_IMAGE_MODEL_OPTIONS.has(model)
}

export const isGeminiImageModel = (
  model: ImageGenerationModel
): model is GeminiImageGenerationModel => {
  return GEMINI_IMAGE_MODEL_OPTIONS.has(model)
}
