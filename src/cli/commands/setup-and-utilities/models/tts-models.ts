import { createModelValidator, formatAllowedValues } from '~/cli/commands/setup-and-utilities/models/model-validation'
import { CLIUsageError } from '~/utils/error-handler'
import {
  getKittenHfRepo,
  getKittenVoices,
  getGroqTtsVoices,
  getGrokTtsVoices
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
  'eleven_v3'
] as const satisfies readonly string[]

export const ELEVENLABS_DEFAULT_VOICE_ID = 'hpp4J3VqNfWAUOO0d1Us'
export const SUPPORTED_ELEVENLABS_TTS_TEXT_NORMALIZATIONS = [
  'auto',
  'on',
  'off'
] as const satisfies readonly string[]

export const validateElevenlabsTtsModel = createModelValidator<ElevenlabsTtsModel>(SUPPORTED_ELEVENLABS_TTS_MODELS, 'elevenlabs-tts')

export const validateElevenLabsTtsTextNormalization = (value: string): string => {
  const normalized = normalizeListedValue(value, SUPPORTED_ELEVENLABS_TTS_TEXT_NORMALIZATIONS)
  if (!normalized) {
    throw CLIUsageError(
      `Invalid --elevenlabs-tts-text-normalization "${value}". Allowed values: ${formatAllowedValues(SUPPORTED_ELEVENLABS_TTS_TEXT_NORMALIZATIONS)}`
    )
  }
  return normalized
}

export const SUPPORTED_MINIMAX_TTS_MODELS = [
  'speech-2.8-hd',
  'speech-2.8-turbo'
] as const satisfies readonly string[]

export const validateMinimaxTtsModel = createModelValidator<MinimaxTtsModel>(SUPPORTED_MINIMAX_TTS_MODELS, 'minimax-tts')

export const SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS = [
  'Chinese',
  'Chinese,Yue',
  'English',
  'Arabic',
  'Russian',
  'Spanish',
  'French',
  'Portuguese',
  'German',
  'Turkish',
  'Dutch',
  'Ukrainian',
  'Vietnamese',
  'Indonesian',
  'Japanese',
  'Italian',
  'Korean',
  'Thai',
  'Polish',
  'Romanian',
  'Greek',
  'Czech',
  'Finnish',
  'Hindi',
  'Bulgarian',
  'Danish',
  'Hebrew',
  'Malay',
  'Persian',
  'Slovak',
  'Swedish',
  'Croatian',
  'Filipino',
  'Hungarian',
  'Norwegian',
  'Slovenian',
  'Catalan',
  'Nynorsk',
  'Tamil',
  'Afrikaans',
  'auto'
] as const satisfies readonly string[]

export const SUPPORTED_MINIMAX_TTS_EMOTIONS = [
  'happy',
  'sad',
  'angry',
  'fearful',
  'disgusted',
  'surprised',
  'calm',
  'fluent',
  'whisper'
] as const satisfies readonly string[]

const normalizeListedValue = (value: string, allowedValues: readonly string[]): string | undefined => {
  const normalized = value.trim().toLowerCase()
  return allowedValues.find((candidate) => candidate.toLowerCase() === normalized)
}

export const validateMinimaxTtsLanguageBoost = (value: string): string => {
  const normalized = normalizeListedValue(value, SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS)
  if (!normalized) {
    throw CLIUsageError(
      `Invalid --minimax-tts-language-boost "${value}". Allowed values: ${formatAllowedValues(SUPPORTED_MINIMAX_TTS_LANGUAGE_BOOSTS)}`
    )
  }
  return normalized
}

export const validateMinimaxTtsEmotion = (value: string): string => {
  const normalized = normalizeListedValue(value, SUPPORTED_MINIMAX_TTS_EMOTIONS)
  if (!normalized) {
    throw CLIUsageError(
      `Invalid --minimax-tts-emotion "${value}". Allowed values: ${formatAllowedValues(SUPPORTED_MINIMAX_TTS_EMOTIONS)}`
    )
  }
  return normalized
}

export const SUPPORTED_GROQ_TTS_MODELS = [
  'canopylabs/orpheus-v1-english',
  'canopylabs/orpheus-arabic-saudi'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_ENGLISH_TTS_VOICES = [
  'autumn',
  'diana',
  'hannah',
  'austin',
  'daniel',
  'troy'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_ARABIC_SAUDI_TTS_VOICES = [
  'abdullah',
  'fahad',
  'sultan',
  'lulwa',
  'noura',
  'aisha'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_TTS_VOICES = getGroqTtsVoices()
export const GROQ_DEFAULT_TTS_VOICE = 'troy'
export const GROQ_DEFAULT_ARABIC_SAUDI_TTS_VOICE = 'fahad'

export const validateGroqTtsModel = createModelValidator<GroqTtsModel>(SUPPORTED_GROQ_TTS_MODELS, 'groq-tts')

export const validateGroqTtsVoice = (voice: string): string => {
  const normalized = voice.trim().toLowerCase()
  if (!SUPPORTED_GROQ_TTS_VOICES.includes(normalized)) {
    throw CLIUsageError(
      `Invalid --groq-voice "${voice}". Allowed values: ${formatAllowedValues(SUPPORTED_GROQ_TTS_VOICES)}`
    )
  }
  return normalized
}

export const getGroqTtsVoicesForModel = (model: GroqTtsModel): readonly string[] =>
  model === 'canopylabs/orpheus-arabic-saudi'
    ? SUPPORTED_GROQ_ARABIC_SAUDI_TTS_VOICES
    : SUPPORTED_GROQ_ENGLISH_TTS_VOICES

export const getGroqDefaultTtsVoiceForModel = (model: GroqTtsModel): string =>
  model === 'canopylabs/orpheus-arabic-saudi'
    ? GROQ_DEFAULT_ARABIC_SAUDI_TTS_VOICE
    : GROQ_DEFAULT_TTS_VOICE

export const validateGroqTtsVoiceForModel = (model: GroqTtsModel, voice: string): string => {
  const normalized = voice.trim().toLowerCase()
  const allowedValues = getGroqTtsVoicesForModel(model)
  if (!allowedValues.includes(normalized)) {
    throw CLIUsageError(
      `Invalid --groq-voice "${voice}" for ${model}. Allowed values: ${formatAllowedValues(allowedValues)}`
    )
  }
  return normalized
}

export const SUPPORTED_GROK_TTS_MODELS = [
  'grok-tts'
] as const satisfies readonly string[]

export const SUPPORTED_GROK_TTS_VOICES = getGrokTtsVoices()
export const GROK_DEFAULT_TTS_VOICE = 'eve'
export const SUPPORTED_GROK_TTS_LANGUAGES = [
  'auto',
  'en',
  'ar-EG',
  'ar-SA',
  'ar-AE',
  'bn',
  'zh',
  'fr',
  'de',
  'hi',
  'id',
  'it',
  'ja',
  'ko',
  'pt-BR',
  'pt-PT',
  'ru',
  'es-MX',
  'es-ES',
  'tr',
  'vi'
] as const satisfies readonly string[]

export const validateGrokTtsModel = createModelValidator<GrokTtsModel>(SUPPORTED_GROK_TTS_MODELS, 'grok-tts')

export const validateGrokTtsVoice = (voice: string): string => {
  const normalized = voice.trim().toLowerCase()
  if (!SUPPORTED_GROK_TTS_VOICES.includes(normalized) && !/^[a-z0-9]{8}$/.test(normalized)) {
    throw CLIUsageError(
      `Invalid --grok-tts-voice "${voice}". Allowed values: ${formatAllowedValues(SUPPORTED_GROK_TTS_VOICES)}, or an 8-character custom voice ID.`
    )
  }
  return normalized
}

export const validateGrokTtsLanguage = (language: string): string => {
  const normalized = normalizeListedValue(language, SUPPORTED_GROK_TTS_LANGUAGES)
  if (!normalized) {
    throw CLIUsageError(
      `Invalid --grok-tts-language "${language}". Allowed values: ${formatAllowedValues(SUPPORTED_GROK_TTS_LANGUAGES)}`
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
  'gemini-3.1-flash-tts-preview'
] as const satisfies readonly string[]

export const GEMINI_DEFAULT_TTS_VOICE = 'Kore'

export const validateGeminiTtsModel = createModelValidator<GeminiTtsModel>(SUPPORTED_GEMINI_TTS_MODELS, 'gemini-tts')

export const SUPPORTED_DEEPGRAM_TTS_MODELS = [
  'aura-2-thalia-en',
  'aura-2-amalthea-en',
  'aura-2-andromeda-en',
  'aura-2-apollo-en',
  'aura-2-arcas-en',
  'aura-2-ariadne-en',
  'aura-2-aries-en',
  'aura-2-asteria-en',
  'aura-2-athena-en',
  'aura-2-atlas-en',
  'aura-2-aurora-en',
  'aura-2-callista-en',
  'aura-2-canto-en',
  'aura-2-cassiopeia-en',
  'aura-2-castor-en',
  'aura-2-celeste-en',
  'aura-2-cepheus-en',
  'aura-2-charisma-en',
  'aura-2-clara-en',
  'aura-2-cordelia-en',
  'aura-2-delia-en',
  'aura-2-draco-en',
  'aura-2-electra-en',
  'aura-2-harmonia-en',
  'aura-2-helena-en',
  'aura-2-hera-en',
  'aura-2-hermes-en',
  'aura-2-hyperion-en',
  'aura-2-iris-en',
  'aura-2-janus-en',
  'aura-2-juno-en',
  'aura-2-jupiter-en',
  'aura-2-luna-en',
  'aura-2-mars-en',
  'aura-2-messenger-en',
  'aura-2-moneta-en',
  'aura-2-neptune-en',
  'aura-2-odysseus-en',
  'aura-2-ophelia-en',
  'aura-2-orion-en',
  'aura-2-orpheus-en',
  'aura-2-pandora-en',
  'aura-2-phoebe-en',
  'aura-2-pluto-en',
  'aura-2-saturn-en',
  'aura-2-selene-en',
  'aura-2-theia-en',
  'aura-2-vesta-en',
  'aura-2-zeus-en',
  'aura-2-sirio-es',
  'aura-2-nestor-es',
  'aura-2-carina-es',
  'aura-2-celeste-es',
  'aura-2-alvaro-es',
  'aura-2-gisela-de',
  'aura-2-eva-de',
  'aura-2-katrin-de',
  'aura-2-stefan-de',
  'aura-2-florian-de',
  'aura-2-luna-it',
  'aura-2-bianca-it',
  'aura-2-stella-it',
  'aura-2-luca-it',
  'aura-2-marco-it',
  'aura-2-asteria-ja',
  'aura-2-luna-ja',
  'aura-2-stella-ja',
  'aura-2-athena-ja',
  'aura-2-orion-ja'
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

export const SUPPORTED_SPEECHIFY_TTS_MODELS = [
  'simba-english',
  'simba-multilingual'
] as const satisfies readonly string[]

export const SPEECHIFY_DEFAULT_TTS_VOICE = 'george'
export const SUPPORTED_SPEECHIFY_TTS_AUDIO_FORMATS = [
  'mp3',
  'ogg',
  'aac',
  'wav',
  'pcm'
] as const satisfies readonly string[]

export const validateSpeechifyTtsModel = createModelValidator<SpeechifyTtsModel>(SUPPORTED_SPEECHIFY_TTS_MODELS, 'speechify-tts')

export const validateSpeechifyTtsVoice = (voice: string): string => {
  const normalized = voice.trim()
  if (!normalized) {
    throw CLIUsageError('Invalid --speechify-voice value. Expected a non-empty Speechify voice ID.')
  }
  return normalized
}

export const validateSpeechifyTtsAudioFormat = (value: string): string => {
  const normalized = normalizeListedValue(value, SUPPORTED_SPEECHIFY_TTS_AUDIO_FORMATS)
  if (!normalized) {
    throw CLIUsageError(
      `Invalid --speechify-tts-audio-format "${value}". Allowed values: ${formatAllowedValues(SUPPORTED_SPEECHIFY_TTS_AUDIO_FORMATS)}`
    )
  }
  return normalized
}

export const SUPPORTED_GCLOUD_TTS_MODELS = [
  'chirp3-hd',
  'studio',
  'instant-custom-voice'
] as const satisfies readonly string[]

export const SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS = [
  'chirp3-hd',
  'studio',
] as const satisfies readonly string[]

export const GCLOUD_DEFAULT_TTS_VOICES = {
  'chirp3-hd': 'en-US-Chirp3-HD-Charon',
  studio: 'en-US-Studio-O',
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
