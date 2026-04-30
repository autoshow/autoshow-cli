import { createModelValidator, formatAllowedValues } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { CLIUsageError } from '~/utils/error-handler'
import {
  getKittenHfRepo,
  getKittenVoices,
  getGroqTtsVoices,
  getGrokTtsVoices,
  getRunwayTtsVoices
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import type {
  KittenTtsModel,
  ElevenlabsTtsModel,
  MinimaxTtsModel,
  GroqTtsModel,
  GrokTtsModel,
  MistralTtsModel,
  OpenAITtsModel,
  GeminiTtsModel,
  DeepgramTtsModel,
  RunwayTtsModel,
  SpeechifyTtsModel,
  GcloudTtsModel,
  DeapiTtsModel
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

export const SUPPORTED_GROK_TTS_MODELS = [
  'grok-tts'
] as const satisfies readonly string[]

export const SUPPORTED_GROK_TTS_VOICES = getGrokTtsVoices()
export const GROK_DEFAULT_TTS_VOICE = 'eve'

export const validateGrokTtsModel = createModelValidator<GrokTtsModel>(SUPPORTED_GROK_TTS_MODELS, 'grok-tts')

export const validateGrokTtsVoice = (voice: string): string => {
  const normalized = voice.trim().toLowerCase()
  if (!SUPPORTED_GROK_TTS_VOICES.includes(normalized)) {
    throw CLIUsageError(
      `Invalid --grok-tts-voice "${voice}". Allowed values: ${formatAllowedValues(SUPPORTED_GROK_TTS_VOICES)}`
    )
  }
  return normalized
}

export const SUPPORTED_MISTRAL_TTS_MODELS = [
  'voxtral-mini-tts-2603'
] as const satisfies readonly string[]

export const validateMistralTtsModel = createModelValidator<MistralTtsModel>(SUPPORTED_MISTRAL_TTS_MODELS, 'mistral-tts')

export const SUPPORTED_OPENAI_TTS_MODELS = [
  'gpt-4o-mini-tts'
] as const satisfies readonly string[]

export const OPENAI_DEFAULT_TTS_VOICE = 'alloy'

export const validateOpenAITtsModel = createModelValidator<OpenAITtsModel>(SUPPORTED_OPENAI_TTS_MODELS, 'openai-tts')

export const SUPPORTED_GEMINI_TTS_MODELS = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-preview-tts',
  'gemini-2.5-pro-preview-tts'
] as const satisfies readonly string[]

export const GEMINI_DEFAULT_TTS_VOICE = 'Kore'

export const validateGeminiTtsModel = createModelValidator<GeminiTtsModel>(SUPPORTED_GEMINI_TTS_MODELS, 'gemini-tts')

export const SUPPORTED_DEEPGRAM_TTS_MODELS = [
  'aura-2-thalia-en',
  'aura-2-andromeda-en',
  'aura-2-apollo-en',
  'aura-2-arcas-en',
  'aura-2-asteria-en',
  'aura-2-athena-en',
  'aura-2-helena-en',
  'aura-2-aries-en'
] as const satisfies readonly string[]

export const DEEPGRAM_DEFAULT_VOICE = 'aura-2-thalia-en'

export const validateDeepgramTtsModel = createModelValidator<DeepgramTtsModel>(SUPPORTED_DEEPGRAM_TTS_MODELS, 'deepgram-tts')

export const validateDeepgramTtsVoice = (voice: string): DeepgramTtsModel => {
  if (!SUPPORTED_DEEPGRAM_TTS_MODELS.includes(voice as DeepgramTtsModel)) {
    throw CLIUsageError(
      `Invalid --deepgram-voice "${voice}". Allowed values: ${formatAllowedValues(SUPPORTED_DEEPGRAM_TTS_MODELS)}`
    )
  }
  return voice as DeepgramTtsModel
}

export const SUPPORTED_RUNWAY_TTS_MODELS = [
  'eleven_multilingual_v2'
] as const satisfies readonly string[]

export const SUPPORTED_RUNWAY_TTS_VOICES = getRunwayTtsVoices()
export const RUNWAY_DEFAULT_TTS_VOICE = 'Leslie'

export const validateRunwayTtsModel = createModelValidator<RunwayTtsModel>(SUPPORTED_RUNWAY_TTS_MODELS, 'runway-tts')

export const validateRunwayTtsVoice = (voice: string): string => {
  if (!SUPPORTED_RUNWAY_TTS_VOICES.includes(voice)) {
    throw CLIUsageError(
      `Invalid --runway-tts-voice "${voice}". Allowed values: ${formatAllowedValues(SUPPORTED_RUNWAY_TTS_VOICES)}`
    )
  }
  return voice
}

export const SUPPORTED_SPEECHIFY_TTS_MODELS = [
  'simba-english',
  'simba-multilingual'
] as const satisfies readonly string[]

export const SPEECHIFY_DEFAULT_TTS_VOICE = 'george'

export const validateSpeechifyTtsModel = createModelValidator<SpeechifyTtsModel>(SUPPORTED_SPEECHIFY_TTS_MODELS, 'speechify-tts')

export const validateSpeechifyTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw CLIUsageError('Invalid --speechify-voice value. Expected a non-empty Speechify voice ID.')
  }
  return normalized
}

export const SUPPORTED_GCLOUD_TTS_MODELS = [
  'standard',
  'wavenet',
  'neural2',
  'studio',
  'chirp3-hd',
  'instant-custom-voice'
] as const satisfies readonly string[]

export const SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS = [
  'standard',
  'wavenet',
  'neural2',
  'studio',
  'chirp3-hd'
] as const satisfies readonly string[]

export const GCLOUD_DEFAULT_TTS_VOICES = {
  standard: 'en-US-Standard-J',
  wavenet: 'en-US-Wavenet-D',
  neural2: 'en-US-Neural2-J',
  studio: 'en-US-Studio-O',
  'chirp3-hd': 'en-US-Chirp3-HD-Charon'
} as const satisfies Record<typeof SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS[number], string>

export const GCLOUD_DEFAULT_TTS_LANGUAGE = 'en-US'
export const GCLOUD_DEFAULT_ICV_CONSENT_LANGUAGE = 'en-US'

export const validateGcloudTtsModel = createModelValidator<GcloudTtsModel>(SUPPORTED_GCLOUD_TTS_MODELS, 'gcloud-tts')

export const validateGcloudTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw CLIUsageError('Invalid --gcloud-tts-voice value. Expected a non-empty Google Cloud voice name.')
  }
  return normalized
}

export const SUPPORTED_DEAPI_TTS_MODELS = [
  'Kokoro',
  'Chatterbox',
  'Qwen3_TTS_12Hz_1_7B_CustomVoice',
  'Qwen3_TTS_12Hz_1_7B_Base',
  'Qwen3_TTS_12Hz_1_7B_VoiceDesign'
] as const satisfies readonly string[]

export const SUPPORTED_DEAPI_RUNNABLE_TTS_MODELS = [
  'Kokoro',
  'Chatterbox',
  'Qwen3_TTS_12Hz_1_7B_CustomVoice'
] as const satisfies readonly string[]

export const DEAPI_DEFAULT_TTS_VOICE = 'af_heart'

export const validateDeapiTtsModel = createModelValidator<DeapiTtsModel>(SUPPORTED_DEAPI_TTS_MODELS, 'deapi-tts')
