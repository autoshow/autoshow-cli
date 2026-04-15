import { createModelValidator } from '~/cli/commands/models/model-validation'
import type { DeepgramSttModel, ElevenlabsSttModel, SonioxSttModel, SpeechmaticsSttModel, RevSttModel, GroqSttModel, OpenAISttModel, MistralSttModel, AssemblyaiSttModel } from '~/types'
export type { DeepgramSttModel, ElevenlabsSttModel, SonioxSttModel, SpeechmaticsSttModel, RevSttModel, GroqSttModel, OpenAISttModel, MistralSttModel, AssemblyaiSttModel } from '~/types'

export const SUPPORTED_WHISPER_MODELS = [
  'tiny',
  'base',
  'small',
  'medium',
  'large-v3-turbo'
] as const satisfies readonly string[]

export const SUPPORTED_ELEVENLABS_STT_MODELS = [
  'scribe_v2'
] as const satisfies readonly string[]

export const SUPPORTED_DEEPGRAM_STT_MODELS = [
  'nova-3'
] as const satisfies readonly string[]

export const SUPPORTED_SONIOX_STT_MODELS = [
  'stt-async-v4',
  'stt-async-v3'
] as const satisfies readonly string[]

export const SUPPORTED_SPEECHMATICS_STT_MODELS = [
  'standard',
  'enhanced'
] as const satisfies readonly string[]

export const SUPPORTED_REV_STT_MODELS = [
  'machine'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_STT_MODELS = [
  'whisper-large-v3-turbo',
  'whisper-large-v3'
] as const satisfies readonly string[]

export const SUPPORTED_OPENAI_STT_MODELS = [
  'gpt-4o-transcribe-diarize'
] as const satisfies readonly string[]

export const SUPPORTED_MISTRAL_STT_MODELS = [
  'voxtral-mini-latest',
  'voxtral-mini-2602'
] as const satisfies readonly string[]

export const SUPPORTED_ASSEMBLYAI_STT_MODELS = [
  'universal-2',
  'universal-3-pro'
] as const satisfies readonly string[]

export const validateWhisperModel = createModelValidator(SUPPORTED_WHISPER_MODELS, 'whisper', 'This flag uses local whisper.cpp models.')
export const validateElevenlabsSttModel = createModelValidator<ElevenlabsSttModel>(SUPPORTED_ELEVENLABS_STT_MODELS, 'elevenlabs-stt')
export const validateDeepgramSttModel = createModelValidator<DeepgramSttModel>(SUPPORTED_DEEPGRAM_STT_MODELS, 'deepgram-stt')
export const validateSonioxSttModel = createModelValidator<SonioxSttModel>(SUPPORTED_SONIOX_STT_MODELS, 'soniox-stt')
export const validateSpeechmaticsSttModel = createModelValidator<SpeechmaticsSttModel>(SUPPORTED_SPEECHMATICS_STT_MODELS, 'speechmatics-stt')
export const validateRevSttModel = createModelValidator<RevSttModel>(SUPPORTED_REV_STT_MODELS, 'rev-stt')
export const validateGroqSttModel = createModelValidator<GroqSttModel>(SUPPORTED_GROQ_STT_MODELS, 'groq-stt', 'This flag only accepts Groq Whisper API models.')
export const validateOpenAISttModel = createModelValidator<OpenAISttModel>(SUPPORTED_OPENAI_STT_MODELS, 'openai-stt')
export const validateMistralSttModel = createModelValidator<MistralSttModel>(SUPPORTED_MISTRAL_STT_MODELS, 'mistral-stt')
export const validateAssemblyaiSttModel = createModelValidator<AssemblyaiSttModel>(SUPPORTED_ASSEMBLYAI_STT_MODELS, 'assemblyai-stt')
