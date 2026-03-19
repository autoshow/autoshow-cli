import { CLIUsageError } from '~/utils/error-handler'
import type { ElevenlabsSttModel, GroqSttModel, OpenAISttModel, MistralSttModel, AssemblyaiSttModel } from '~/types'
export type { ElevenlabsSttModel, GroqSttModel, OpenAISttModel, MistralSttModel, AssemblyaiSttModel } from '~/types'

const formatAllowedValues = (values: readonly string[]): string => values.join(', ')

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

export const validateWhisperModel = (model: string): string => {
  if (!SUPPORTED_WHISPER_MODELS.includes(model as typeof SUPPORTED_WHISPER_MODELS[number])) {
    throw CLIUsageError(
      `Invalid --whisper model "${model}". This flag uses local whisper.cpp models. Allowed values: ${formatAllowedValues(SUPPORTED_WHISPER_MODELS)}`
    )
  }

  return model
}

export const validateElevenlabsSttModel = (model: string): ElevenlabsSttModel => {
  if (!SUPPORTED_ELEVENLABS_STT_MODELS.includes(model as ElevenlabsSttModel)) {
    throw CLIUsageError(
      `Invalid --elevenlabs-stt model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_ELEVENLABS_STT_MODELS)}`
    )
  }
  return model as ElevenlabsSttModel
}

export const validateGroqSttModel = (model: string): GroqSttModel => {
  if (!SUPPORTED_GROQ_STT_MODELS.includes(model as GroqSttModel)) {
    throw CLIUsageError(
      `Invalid --groq-stt model "${model}". This flag only accepts Groq Whisper API models. Allowed values: ${formatAllowedValues(SUPPORTED_GROQ_STT_MODELS)}`
    )
  }
  return model as GroqSttModel
}

export const validateOpenAISttModel = (model: string): OpenAISttModel => {
  if (!SUPPORTED_OPENAI_STT_MODELS.includes(model as OpenAISttModel)) {
    throw CLIUsageError(
      `Invalid --openai-stt model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_OPENAI_STT_MODELS)}`
    )
  }
  return model as OpenAISttModel
}

export const validateMistralSttModel = (model: string): MistralSttModel => {
  if (!SUPPORTED_MISTRAL_STT_MODELS.includes(model as MistralSttModel)) {
    throw CLIUsageError(
      `Invalid --mistral-stt model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_MISTRAL_STT_MODELS)}`
    )
  }
  return model as MistralSttModel
}

export const validateAssemblyaiSttModel = (model: string): AssemblyaiSttModel => {
  if (!SUPPORTED_ASSEMBLYAI_STT_MODELS.includes(model as AssemblyaiSttModel)) {
    throw CLIUsageError(
      `Invalid --assemblyai-stt model "${model}". Allowed values: ${formatAllowedValues(SUPPORTED_ASSEMBLYAI_STT_MODELS)}`
    )
  }
  return model as AssemblyaiSttModel
}
