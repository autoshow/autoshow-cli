import type { DiarizationOptions, DiarizationFlagOptions, ProviderSpec, RuntimeOptions, SttPolicy, TranscribeEngine, TranscribeEngineCapabilities } from '~/types'

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
  whisper: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  'youtube-captions': { diarizationByDefault: false, supportsSpeakerCountHint: false }
} as const satisfies Record<TranscribeEngine, TranscribeEngineCapabilities>

const appendProviderSpec = (
  specs: ProviderSpec[],
  spec: ProviderSpec
): void => {
  const key = `${spec.provider}:${spec.model ?? ''}`
  if (specs.some((entry) => `${entry.provider}:${entry.model ?? ''}` === key)) {
    return
  }
  specs.push(spec)
}

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
    | 'whisperExplicit'
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
  >
): ProviderSpec[] => {
  const specs: ProviderSpec[] = []
  const appendModels = (provider: ProviderSpec['provider'], models: string[] | undefined, fallback?: string): void => {
    for (const model of models ?? (fallback ? [fallback] : [])) {
      appendProviderSpec(specs, { provider, model })
    }
  }

  if (options.useReverb) {
    appendProviderSpec(specs, { provider: 'reverb', model: 'reverb' })
  }
  appendModels('gcloud', options.gcloudSttModels, options.gcloudSttModel)
  appendModels('aws', options.awsSttModels, options.awsSttModel)
  appendModels('deepinfra', options.deepinfraSttModels, options.deepinfraSttModel)
  appendModels('deapi', options.deapiSttModels, options.deapiSttModel)
  appendModels('elevenlabs', options.elevenlabsSttModels, options.elevenlabsSttModel)
  appendModels('deepgram', options.deepgramSttModels, options.deepgramSttModel)
  appendModels('soniox', options.sonioxSttModels, options.sonioxSttModel)
  appendModels('speechmatics', options.speechmaticsSttModels, options.speechmaticsSttModel)
  appendModels('rev', options.revSttModels, options.revSttModel)
  appendModels('groq', options.groqSttModels, options.groqSttModel)
  appendModels('mistral', options.mistralSttModels, options.mistralSttModel)
  appendModels('assemblyai', options.assemblyaiSttModels, options.assemblyaiSttModel)
  appendModels('gladia', options.gladiaSttModels, options.gladiaSttModel)
  appendModels('happyscribe', options.happyscribeSttModels, options.happyscribeSttModel)
  appendModels('supadata', options.supadataSttModels, options.supadataSttModel)

  const whisperRequested = specs.some((entry) => entry.provider === 'whisper')
  if (options.whisperExplicit && !whisperRequested) {
    appendModels('whisper', options.whisperModels, options.whisperModel)
  }

  if (specs.length === 0) {
    appendProviderSpec(specs, { provider: 'whisper', model: options.whisperModel })
  }

  return specs
}

export const buildSttPolicy = (
  options: RuntimeOptions
): SttPolicy => {
  const providers = collectSttProviderSpecs(options)
  return {
    providers,
    batch: {
      limit: options.batchLimit,
      all: options.batchAll,
      order: options.batchOrder,
      concurrency: options.batchConcurrency
    },
    concurrency: {
      provider: options.sttProviderConcurrency,
      local: options.sttLocalConcurrency,
      segment: options.sttSegmentConcurrency
    },
    diarization: {
      ...(options.diarizationSpeakerCount !== undefined ? { speakerCount: options.diarizationSpeakerCount } : {})
    },
    split: options.split
  }
}
