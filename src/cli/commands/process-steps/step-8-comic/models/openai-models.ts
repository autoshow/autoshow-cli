import type {
  ImageEditInputFidelity,
  ImageModelPricing,
  OpenAiImageGenerationModel,
  OpenAiLlmModel,
  TokenPricing,
} from '../types/comic-types'

export const GPT_IMAGE_2_MODEL = 'gpt-image-2'
const GPT_IMAGE_1_5_MODEL = 'gpt-image-1.5'
export const OPENAI_IMAGE_MODELS = [GPT_IMAGE_2_MODEL, GPT_IMAGE_1_5_MODEL] as const
export const OPENAI_LLM_MODELS = ['gpt-5.5', 'gpt-5.4-pro', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'] as const





export const LLM_MODEL_PRICING: Record<OpenAiLlmModel, TokenPricing> = {
  'gpt-5.5': {
    input: 5.0,
    cachedInput: 0.5,
    output: 30.0,
  },
  'gpt-5.4-pro': {
    input: 30.0,
    cachedInput: 30.0,
    output: 180.0,
  },
  'gpt-5.4': {
    input: 2.5,
    cachedInput: 0.25,
    output: 15.0,
  },
  'gpt-5.4-mini': {
    input: 0.75,
    cachedInput: 0.075,
    output: 4.5,
  },
  'gpt-5.4-nano': {
    input: 0.2,
    cachedInput: 0.02,
    output: 1.25,
  },
}

export const IMAGE_MODEL_PRICING: Record<OpenAiImageGenerationModel, ImageModelPricing> = {
  'gpt-image-2': {
    textTokens: { input: 5.0, cachedInput: 1.25, output: 0.0 },
    imageTokens: { input: 8.0, cachedInput: 2.0, output: 30.0 },
    perImageOutput: {
      low: { '1024x1024': 0.006, '1024x1536': 0.005, '1536x1024': 0.005 },
      medium: { '1024x1024': 0.053, '1024x1536': 0.041, '1536x1024': 0.041 },
      high: { '1024x1024': 0.211, '1024x1536': 0.165, '1536x1024': 0.165 },
    },
  },
  'gpt-image-1.5': {
    textTokens: { input: 5.0, cachedInput: 1.25, output: 10.0 },
    imageTokens: { input: 8.0, cachedInput: 2.0, output: 32.0 },
    perImageOutput: {
      low: { '1024x1024': 0.009, '1024x1536': 0.013, '1536x1024': 0.013 },
      medium: { '1024x1024': 0.034, '1024x1536': 0.05, '1536x1024': 0.05 },
      high: { '1024x1024': 0.133, '1024x1536': 0.2, '1536x1024': 0.2 },
    },
  },
}

const OPENAI_IMAGE_MODEL_EDIT_INPUT_FIDELITY: Partial<Record<OpenAiImageGenerationModel, ImageEditInputFidelity>> = {
  'gpt-image-1.5': 'high',
}

export const openAiLlmSupportsStructuredOutputs = (model: OpenAiLlmModel): boolean => {
  return model !== 'gpt-5.4-pro'
}

export const getImageEditInputFidelity = (
  model: OpenAiImageGenerationModel
): ImageEditInputFidelity | undefined => {
  return OPENAI_IMAGE_MODEL_EDIT_INPUT_FIDELITY[model]
}
