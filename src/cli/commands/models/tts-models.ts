import { CLIUsageError } from '~/utils/error-handler'
import {
  getKittenHfRepo,
  getKittenVoices,
  getGroqTtsVoices
} from '~/cli/commands/models/model-loader'
import type {
  KittenTtsModel,
  ElevenlabsTtsModel,
  MinimaxTtsModel,
  GroqTtsModel,
  OpenAITtsModel,
  GeminiTtsModel
} from '~/types'

export type {
  KittenTtsModel,
  ElevenlabsTtsModel,
  MinimaxTtsModel,
  GroqTtsModel,
  OpenAITtsModel,
  GeminiTtsModel
} from '~/types'

const formatAllowedValues = (values: readonly string[]): string => values.join(', ')

export const SUPPORTED_KITTEN_TTS_MODELS = [
  'kitten-tts-mini',
  'kitten-tts-micro',
  'kitten-tts-nano',
  'kitten-tts-nano-0.8-int8'
] as const satisfies readonly string[]

export const SUPPORTED_KITTEN_TTS_VOICES = getKittenVoices()

export const validateKittenTtsModel = (model: string): KittenTtsModel => {
  if (!SUPPORTED_KITTEN_TTS_MODELS.includes(model as KittenTtsModel)) {
    throw CLIUsageError(
      `Invalid --kitten-tts model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_KITTEN_TTS_MODELS)}`
    )
  }
  return model as KittenTtsModel
}

export const validateKittenTtsSpeaker = (speaker: string): string => {
  if (!SUPPORTED_KITTEN_TTS_VOICES.includes(speaker)) {
    throw CLIUsageError(
      `Invalid --tts-speaker "${speaker}" for Kitten TTS. Allowed values: ${formatAllowedValues(SUPPORTED_KITTEN_TTS_VOICES)}`
    )
  }
  return speaker
}

export const resolveKittenTtsModelId = (model: KittenTtsModel): string => {
  const repo = getKittenHfRepo(model)
  if (!repo) throw new Error(`No HF repo found for Kitten TTS model "${model}"`)
  return repo
}

export const SUPPORTED_ELEVENLABS_TTS_MODELS = [
  'eleven_flash_v2_5',
  'eleven_turbo_v2_5',
  'eleven_v3'
] as const satisfies readonly string[]

export const ELEVENLABS_DEFAULT_VOICE_ID = 'hpp4J3VqNfWAUOO0d1Us'

export const validateElevenlabsTtsModel = (model: string): ElevenlabsTtsModel => {
  if (!SUPPORTED_ELEVENLABS_TTS_MODELS.includes(model as ElevenlabsTtsModel)) {
    throw CLIUsageError(
      `Invalid --elevenlabs-tts model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_ELEVENLABS_TTS_MODELS)}`
    )
  }
  return model as ElevenlabsTtsModel
}

export const SUPPORTED_MINIMAX_TTS_MODELS = [
  'speech-2.8-turbo',
  'speech-2.8-hd'
] as const satisfies readonly string[]

export const validateMinimaxTtsModel = (model: string): MinimaxTtsModel => {
  if (!SUPPORTED_MINIMAX_TTS_MODELS.includes(model as MinimaxTtsModel)) {
    throw CLIUsageError(
      `Invalid --minimax-tts model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_MINIMAX_TTS_MODELS)}`
    )
  }
  return model as MinimaxTtsModel
}

export const SUPPORTED_GROQ_TTS_MODELS = [
  'canopylabs/orpheus-v1-english'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_TTS_VOICES = getGroqTtsVoices()
export const GROQ_DEFAULT_TTS_VOICE = 'troy'

export const validateGroqTtsModel = (model: string): GroqTtsModel => {
  if (!SUPPORTED_GROQ_TTS_MODELS.includes(model as GroqTtsModel)) {
    throw CLIUsageError(
      `Invalid --groq-tts model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_GROQ_TTS_MODELS)}`
    )
  }
  return model as GroqTtsModel
}

export const validateGroqTtsVoice = (voice: string): string => {
  if (!SUPPORTED_GROQ_TTS_VOICES.includes(voice)) {
    throw CLIUsageError(
      `Invalid --groq-voice "${voice}". Allowed values: ${formatAllowedValues(SUPPORTED_GROQ_TTS_VOICES)}`
    )
  }
  return voice
}

export const SUPPORTED_OPENAI_TTS_MODELS = [
  'gpt-4o-mini-tts'
] as const satisfies readonly string[]

export const OPENAI_DEFAULT_TTS_VOICE = 'alloy'

export const validateOpenAITtsModel = (model: string): OpenAITtsModel => {
  if (!SUPPORTED_OPENAI_TTS_MODELS.includes(model as OpenAITtsModel)) {
    throw CLIUsageError(
      `Invalid --openai-tts model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_OPENAI_TTS_MODELS)}`
    )
  }
  return model as OpenAITtsModel
}

export const SUPPORTED_GEMINI_TTS_MODELS = [
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts'
] as const satisfies readonly string[]

export const GEMINI_DEFAULT_TTS_VOICE = 'Kore'

export const validateGeminiTtsModel = (model: string): GeminiTtsModel => {
  if (!SUPPORTED_GEMINI_TTS_MODELS.includes(model as GeminiTtsModel)) {
    throw CLIUsageError(
      `Invalid --gemini-tts model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_GEMINI_TTS_MODELS)}`
    )
  }
  return model as GeminiTtsModel
}
