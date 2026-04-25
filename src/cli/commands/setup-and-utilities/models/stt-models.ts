import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { AwsSttModel, DeapiSttModel, DeepgramSttModel, DeepinfraSttModel, ElevenlabsSttModel, GcloudSttModel, HappyscribeSttModel, SonioxSttModel, SpeechmaticsSttModel, RevSttModel, GroqSttModel, MistralSttModel, AssemblyaiSttModel, GladiaSttModel, SupadataSttModel, OpenaiSttModel, GeminiSttModel, GlmSttModel, TogetherSttModel, FireworksSttModel, CloudflareSttModel } from '~/types'

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

export const SUPPORTED_DEEPINFRA_STT_MODELS = [
  'openai/whisper-large-v3-turbo',
  'openai/whisper-large-v3'
] as const satisfies readonly string[]

export const SUPPORTED_DEAPI_STT_MODELS = [
  'WhisperLargeV3'
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

export const SUPPORTED_HAPPYSCRIBE_STT_MODELS = [
  'auto'
] as const satisfies readonly string[]

export const SUPPORTED_SUPADATA_STT_MODELS = [
  'auto',
  'native',
  'generate'
] as const satisfies readonly string[]

export const SUPPORTED_OPENAI_STT_MODELS = [
  'gpt-4o-mini-transcribe',
  'gpt-4o-transcribe'
] as const satisfies readonly string[]

export const SUPPORTED_GEMINI_STT_MODELS = [
  'gemini-3-flash-preview'
] as const satisfies readonly string[]

export const SUPPORTED_GLM_STT_MODELS = [
  'glm-asr-2512'
] as const satisfies readonly string[]

export const SUPPORTED_TOGETHER_STT_MODELS = [
  'openai/whisper-large-v3'
] as const satisfies readonly string[]

export const SUPPORTED_FIREWORKS_STT_MODELS = [
  'whisper-v3-turbo',
  'whisper-v3'
] as const satisfies readonly string[]

export const SUPPORTED_CLOUDFLARE_STT_MODELS = [
  'whisper-large-v3-turbo',
  'whisper'
] as const satisfies readonly string[]

export const validateWhisperModel = createModelValidator(SUPPORTED_WHISPER_MODELS, 'whisper', 'This flag uses local whisper.cpp models.')
export const validateGcloudSttModel = createModelValidator<GcloudSttModel>(SUPPORTED_GCLOUD_STT_MODELS, 'gcloud-stt')
export const validateAwsSttModel = createModelValidator<AwsSttModel>(SUPPORTED_AWS_STT_MODELS, 'aws-stt')
export const validateElevenlabsSttModel = createModelValidator<ElevenlabsSttModel>(SUPPORTED_ELEVENLABS_STT_MODELS, 'elevenlabs-stt')
export const validateDeepgramSttModel = createModelValidator<DeepgramSttModel>(SUPPORTED_DEEPGRAM_STT_MODELS, 'deepgram-stt')
export const validateDeepinfraSttModel = createModelValidator<DeepinfraSttModel>(SUPPORTED_DEEPINFRA_STT_MODELS, 'deepinfra-stt', 'This flag only accepts DeepInfra OpenAI-compatible Whisper models.')
export const validateDeapiSttModel = createModelValidator<DeapiSttModel>(SUPPORTED_DEAPI_STT_MODELS, 'deapi-stt')
export const validateSonioxSttModel = createModelValidator<SonioxSttModel>(SUPPORTED_SONIOX_STT_MODELS, 'soniox-stt')
export const validateSpeechmaticsSttModel = createModelValidator<SpeechmaticsSttModel>(SUPPORTED_SPEECHMATICS_STT_MODELS, 'speechmatics-stt')
export const validateRevSttModel = createModelValidator<RevSttModel>(SUPPORTED_REV_STT_MODELS, 'rev-stt')
export const validateGroqSttModel = createModelValidator<GroqSttModel>(SUPPORTED_GROQ_STT_MODELS, 'groq-stt', 'This flag only accepts Groq Whisper API models.')
export const validateMistralSttModel = createModelValidator<MistralSttModel>(SUPPORTED_MISTRAL_STT_MODELS, 'mistral-stt')
export const validateAssemblyaiSttModel = createModelValidator<AssemblyaiSttModel>(SUPPORTED_ASSEMBLYAI_STT_MODELS, 'assemblyai-stt')
export const validateGladiaSttModel = createModelValidator<GladiaSttModel>(SUPPORTED_GLADIA_STT_MODELS, 'gladia-stt')
export const validateHappyscribeSttModel = createModelValidator<HappyscribeSttModel>(SUPPORTED_HAPPYSCRIBE_STT_MODELS, 'happyscribe-stt')
export const validateSupadataSttModel = createModelValidator<SupadataSttModel>(SUPPORTED_SUPADATA_STT_MODELS, 'supadata-stt')
export const validateOpenaiSttModel = createModelValidator<OpenaiSttModel>(SUPPORTED_OPENAI_STT_MODELS, 'openai-stt')
export const validateGeminiSttModel = createModelValidator<GeminiSttModel>(SUPPORTED_GEMINI_STT_MODELS, 'gemini-stt')
export const validateGlmSttModel = createModelValidator<GlmSttModel>(SUPPORTED_GLM_STT_MODELS, 'glm-stt')
export const validateTogetherSttModel = createModelValidator<TogetherSttModel>(SUPPORTED_TOGETHER_STT_MODELS, 'together-stt', 'This flag only accepts Together OpenAI-compatible Whisper models.')
export const validateFireworksSttModel = createModelValidator<FireworksSttModel>(SUPPORTED_FIREWORKS_STT_MODELS, 'fireworks-stt', 'This flag only accepts Fireworks Whisper API models.')
export const validateCloudflareSttModel = createModelValidator<CloudflareSttModel>(SUPPORTED_CLOUDFLARE_STT_MODELS, 'cloudflare-stt', 'This flag only accepts Cloudflare Workers AI Whisper models.')
