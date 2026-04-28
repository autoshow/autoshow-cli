import type { DiarizationOptions, DiarizationFlagOptions, ProviderSpec, RuntimeOptions, Step2ProviderSelectionFilter, TranscribeEngine, TranscribeEngineCapabilities } from '~/types'
import { collectStep2ProviderSpecs } from '../step-2-shared/provider-registry'

export const STT_ENGINE_CAPABILITIES = {
  reverb: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  gcloud: { diarizationByDefault: true, supportsSpeakerCountHint: true },
  aws: { diarizationByDefault: true, supportsSpeakerCountHint: true },
  deepinfra: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  deapi: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  elevenlabs: { diarizationByDefault: true, supportsSpeakerCountHint: true },
  deepgram: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  soniox: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  speechmatics: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  rev: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  groq: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  mistral: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  assemblyai: { diarizationByDefault: true, supportsSpeakerCountHint: true },
  gladia: { diarizationByDefault: true, supportsSpeakerCountHint: true },
  happyscribe: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  supadata: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  'openai-stt': { diarizationByDefault: false, supportsSpeakerCountHint: false },
  'gemini-stt': { diarizationByDefault: false, supportsSpeakerCountHint: false },
  'glm-stt': { diarizationByDefault: false, supportsSpeakerCountHint: false },
  together: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  fireworks: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  cloudflare: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  whisper: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  'youtube-captions': { diarizationByDefault: false, supportsSpeakerCountHint: false }
} as const satisfies Record<TranscribeEngine, TranscribeEngineCapabilities>

export const getSttEngineCapabilities = (
  engine: TranscribeEngine
): TranscribeEngineCapabilities => STT_ENGINE_CAPABILITIES[engine]

export const resolveDiarizationOptions = (
  options: DiarizationFlagOptions,
  engine: TranscribeEngine
): DiarizationOptions | undefined => {
  const speakerCount = options.diarizationSpeakerCount
  const capabilities = STT_ENGINE_CAPABILITIES[engine]
  const diarizationOptions: DiarizationOptions = capabilities.diarizationByDefault
    ? { enabled: true }
    : {}

  if (speakerCount === undefined) {
    return Object.keys(diarizationOptions).length > 0 ? diarizationOptions : undefined
  }

  if (!capabilities.supportsSpeakerCountHint) {
    return Object.keys(diarizationOptions).length > 0 ? diarizationOptions : undefined
  }

  diarizationOptions.speakerCount = speakerCount
  return diarizationOptions
}

export const collectSttProviderSpecs = (
  options: Pick<
    RuntimeOptions,
    | 'useReverb'
    | 'step2SelectionOrigins'
    | 'whisperModel'
    | 'whisperModels'
    | 'gcloudSttModel'
    | 'gcloudSttModels'
    | 'awsSttModel'
    | 'awsSttModels'
    | 'deepinfraSttModel'
    | 'deepinfraSttModels'
    | 'deapiSttModel'
    | 'deapiSttModels'
    | 'elevenlabsSttModel'
    | 'elevenlabsSttModels'
    | 'deepgramSttModel'
    | 'deepgramSttModels'
    | 'sonioxSttModel'
    | 'sonioxSttModels'
    | 'speechmaticsSttModel'
    | 'speechmaticsSttModels'
    | 'revSttModel'
    | 'revSttModels'
    | 'groqSttModel'
    | 'groqSttModels'
    | 'mistralSttModel'
    | 'mistralSttModels'
    | 'assemblyaiSttModel'
    | 'assemblyaiSttModels'
    | 'gladiaSttModel'
    | 'gladiaSttModels'
    | 'happyscribeSttModel'
    | 'happyscribeSttModels'
    | 'supadataSttModel'
    | 'supadataSttModels'
    | 'openaiSttModel'
    | 'openaiSttModels'
    | 'geminiSttModel'
    | 'geminiSttModels'
    | 'glmSttModel'
    | 'glmSttModels'
    | 'togetherSttModel'
    | 'togetherSttModels'
    | 'fireworksSttModel'
    | 'fireworksSttModels'
    | 'cloudflareSttModel'
    | 'cloudflareSttModels'
  >,
  filter?: Step2ProviderSelectionFilter
): ProviderSpec[] => {
  const specs = collectStep2ProviderSpecs('stt', options as Record<string, unknown>, filter)

  if (specs.length === 0 && !filter?.includeOrigins) {
    specs.push({ provider: 'whisper', model: options.whisperModel })
  }

  return specs
}
