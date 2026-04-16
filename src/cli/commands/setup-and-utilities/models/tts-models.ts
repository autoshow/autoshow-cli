import { createModelValidator, formatAllowedValues } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { CLIUsageError } from '~/utils/error-handler'
import {
  getKittenHfRepo,
  getKittenVoices,
  getGroqTtsVoices
} from '~/cli/commands/setup-and-utilities/models/model-loader'
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

export const SUPPORTED_KITTEN_TTS_MODELS = [
  'kitten-tts-mini',
  'kitten-tts-micro',
  'kitten-tts-nano',
  'kitten-tts-nano-0.8-int8'
] as const satisfies readonly string[]

export const SUPPORTED_KITTEN_TTS_VOICES = getKittenVoices()

export const validateKittenTtsModel = createModelValidator<KittenTtsModel>(SUPPORTED_KITTEN_TTS_MODELS, 'kitten-tts')

export const validateKittenTtsSpeaker = (speaker: string): string => {
  if (!SUPPORTED_KITTEN_TTS_VOICES.includes(speaker)) {
    throw CLIUsageError(
      `Invalid --kitten-voice "${speaker}" for Kitten TTS. Allowed values: ${formatAllowedValues(SUPPORTED_KITTEN_TTS_VOICES)}`
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

export const validateElevenlabsTtsModel = createModelValidator<ElevenlabsTtsModel>(SUPPORTED_ELEVENLABS_TTS_MODELS, 'elevenlabs-tts')

export const SUPPORTED_MINIMAX_TTS_MODELS = [
  'speech-2.8-turbo',
  'speech-2.8-hd'
] as const satisfies readonly string[]

export const validateMinimaxTtsModel = createModelValidator<MinimaxTtsModel>(SUPPORTED_MINIMAX_TTS_MODELS, 'minimax-tts')

export const SUPPORTED_GROQ_TTS_MODELS = [
  'canopylabs/orpheus-v1-english'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_TTS_VOICES = getGroqTtsVoices()
export const GROQ_DEFAULT_TTS_VOICE = 'troy'

export const validateGroqTtsModel = createModelValidator<GroqTtsModel>(SUPPORTED_GROQ_TTS_MODELS, 'groq-tts')

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

export const validateOpenAITtsModel = createModelValidator<OpenAITtsModel>(SUPPORTED_OPENAI_TTS_MODELS, 'openai-tts')

export const SUPPORTED_GEMINI_TTS_MODELS = [
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts'
] as const satisfies readonly string[]

export const GEMINI_DEFAULT_TTS_VOICE = 'Kore'

export const validateGeminiTtsModel = createModelValidator<GeminiTtsModel>(SUPPORTED_GEMINI_TTS_MODELS, 'gemini-tts')
