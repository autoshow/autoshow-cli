import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { AwsSttModel, DeepgramSttModel, ElevenlabsSttModel, GcloudSttModel, SonioxSttModel, SpeechmaticsSttModel, RevSttModel, GroqSttModel, MistralSttModel, AssemblyaiSttModel, GladiaSttModel } from '~/types'
export type { AwsSttModel, DeepgramSttModel, ElevenlabsSttModel, GcloudSttModel, SonioxSttModel, SpeechmaticsSttModel, RevSttModel, GroqSttModel, MistralSttModel, AssemblyaiSttModel, GladiaSttModel } from '~/types'

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

export const SUPPORTED_GCLOUD_STT_MODELS = [
  'chirp_3'
] as const satisfies readonly string[]

export const SUPPORTED_AWS_STT_MODELS = [
  'standard'
] as const satisfies readonly string[]

export const SUPPORTED_DEEPGRAM_STT_MODELS = [
  'nova-3'
] as const satisfies readonly string[]

export const SUPPORTED_SONIOX_STT_MODELS = [
  'stt-async-v4'
] as const satisfies readonly string[]

export const SUPPORTED_SPEECHMATICS_STT_MODELS = [
  'standard',
  'enhanced'
] as const satisfies readonly string[]

export const SUPPORTED_REV_STT_MODELS = [
  'machine',
  'low_cost'
] as const satisfies readonly string[]

export const SUPPORTED_GROQ_STT_MODELS = [
  'whisper-large-v3-turbo',
  'whisper-large-v3'
] as const satisfies readonly string[]

export const SUPPORTED_MISTRAL_STT_MODELS = [
  'voxtral-mini-2602'
] as const satisfies readonly string[]

export const SUPPORTED_ASSEMBLYAI_STT_MODELS = [
  'universal-3-pro'
] as const satisfies readonly string[]

export const SUPPORTED_GLADIA_STT_MODELS = [
  'default'
] as const satisfies readonly string[]

export const validateWhisperModel = createModelValidator(SUPPORTED_WHISPER_MODELS, 'whisper', 'This flag uses local whisper.cpp models.')
export const validateGcloudSttModel = createModelValidator<GcloudSttModel>(SUPPORTED_GCLOUD_STT_MODELS, 'gcloud-stt')
export const validateAwsSttModel = createModelValidator<AwsSttModel>(SUPPORTED_AWS_STT_MODELS, 'aws-stt')
export const validateElevenlabsSttModel = createModelValidator<ElevenlabsSttModel>(SUPPORTED_ELEVENLABS_STT_MODELS, 'elevenlabs-stt')
export const validateDeepgramSttModel = createModelValidator<DeepgramSttModel>(SUPPORTED_DEEPGRAM_STT_MODELS, 'deepgram-stt')
export const validateSonioxSttModel = createModelValidator<SonioxSttModel>(SUPPORTED_SONIOX_STT_MODELS, 'soniox-stt')
export const validateSpeechmaticsSttModel = createModelValidator<SpeechmaticsSttModel>(SUPPORTED_SPEECHMATICS_STT_MODELS, 'speechmatics-stt')
export const validateRevSttModel = createModelValidator<RevSttModel>(SUPPORTED_REV_STT_MODELS, 'rev-stt')
export const validateGroqSttModel = createModelValidator<GroqSttModel>(SUPPORTED_GROQ_STT_MODELS, 'groq-stt', 'This flag only accepts Groq Whisper API models.')
export const validateMistralSttModel = createModelValidator<MistralSttModel>(SUPPORTED_MISTRAL_STT_MODELS, 'mistral-stt')
export const validateAssemblyaiSttModel = createModelValidator<AssemblyaiSttModel>(SUPPORTED_ASSEMBLYAI_STT_MODELS, 'assemblyai-stt')
export const validateGladiaSttModel = createModelValidator<GladiaSttModel>(SUPPORTED_GLADIA_STT_MODELS, 'gladia-stt')
