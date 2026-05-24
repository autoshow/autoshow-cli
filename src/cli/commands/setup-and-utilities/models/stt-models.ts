import { createModelValidator } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { DeepgramSttModel, DeepinfraSttModel, ElevenlabsSttModel, HappyscribeSttModel, SonioxSttModel, SpeechmaticsSttModel, RevSttModel, GroqSttModel, GrokSttModel, MistralSttModel, AssemblyaiSttModel, GladiaSttModel, SupadataSttModel, ScrapecreatorsSttModel, OpenaiSttModel, GeminiSttModel, GlmSttModel, TogetherSttModel } from '~/types'

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

export const SUPPORTED_DEEPINFRA_STT_MODELS = [
  'openai/whisper-large-v3-turbo',
  'openai/whisper-large-v3'
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

export const SUPPORTED_GROK_STT_MODELS = [
  'speech-to-text'
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
  'auto'
] as const satisfies readonly string[]

export const SUPPORTED_SCRAPECREATORS_STT_MODELS = [
  'youtube-transcript'
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

export const validateWhisperModel = createModelValidator(SUPPORTED_WHISPER_MODELS, 'whisper', 'This flag uses local whisper.cpp models.')
export const validateElevenlabsSttModel = createModelValidator<ElevenlabsSttModel>(SUPPORTED_ELEVENLABS_STT_MODELS, 'elevenlabs-stt')
export const validateDeepgramSttModel = createModelValidator<DeepgramSttModel>(SUPPORTED_DEEPGRAM_STT_MODELS, 'deepgram-stt')
export const validateDeepinfraSttModel = createModelValidator<DeepinfraSttModel>(SUPPORTED_DEEPINFRA_STT_MODELS, 'deepinfra-stt', 'This flag only accepts DeepInfra OpenAI-compatible Whisper models.')
export const validateSonioxSttModel = createModelValidator<SonioxSttModel>(SUPPORTED_SONIOX_STT_MODELS, 'soniox-stt')
export const validateSpeechmaticsSttModel = createModelValidator<SpeechmaticsSttModel>(SUPPORTED_SPEECHMATICS_STT_MODELS, 'speechmatics-stt')
export const validateRevSttModel = createModelValidator<RevSttModel>(SUPPORTED_REV_STT_MODELS, 'rev-stt')
export const validateGroqSttModel = createModelValidator<GroqSttModel>(SUPPORTED_GROQ_STT_MODELS, 'groq-stt', 'This flag only accepts Groq Whisper API models.')
export const validateGrokSttModel = createModelValidator<GrokSttModel>(SUPPORTED_GROK_STT_MODELS, 'grok-stt')
export const validateMistralSttModel = createModelValidator<MistralSttModel>(SUPPORTED_MISTRAL_STT_MODELS, 'mistral-stt')
export const validateAssemblyaiSttModel = createModelValidator<AssemblyaiSttModel>(SUPPORTED_ASSEMBLYAI_STT_MODELS, 'assemblyai-stt')
export const validateGladiaSttModel = createModelValidator<GladiaSttModel>(SUPPORTED_GLADIA_STT_MODELS, 'gladia-stt')
export const validateHappyscribeSttModel = createModelValidator<HappyscribeSttModel>(SUPPORTED_HAPPYSCRIBE_STT_MODELS, 'happyscribe-stt')
export const validateSupadataSttModel = createModelValidator<SupadataSttModel>(SUPPORTED_SUPADATA_STT_MODELS, 'supadata-stt')
export const validateScrapeCreatorsSttModel = createModelValidator<ScrapecreatorsSttModel>(SUPPORTED_SCRAPECREATORS_STT_MODELS, 'scrapecreators-stt')
export const validateOpenaiSttModel = createModelValidator<OpenaiSttModel>(SUPPORTED_OPENAI_STT_MODELS, 'openai-stt')
export const validateGeminiSttModel = createModelValidator<GeminiSttModel>(SUPPORTED_GEMINI_STT_MODELS, 'gemini-stt')
export const validateGlmSttModel = createModelValidator<GlmSttModel>(SUPPORTED_GLM_STT_MODELS, 'glm-stt')
export const validateTogetherSttModel = createModelValidator<TogetherSttModel>(SUPPORTED_TOGETHER_STT_MODELS, 'together-stt', 'This flag only accepts Together OpenAI-compatible Whisper models.')
