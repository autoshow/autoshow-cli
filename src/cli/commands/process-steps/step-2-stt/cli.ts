import type { DiarizationOptions, DiarizationFlagOptions, ProviderSpec, RuntimeOptions, SttPolicy, TranscribeEngine, TranscribeEngineCapabilities } from '~/types'

export const STT_ENGINE_CAPABILITIES = {
  reverb: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  elevenlabs: { diarizationByDefault: true, supportsSpeakerCountHint: true },
  deepgram: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  soniox: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  speechmatics: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  rev: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  groq: { diarizationByDefault: false, supportsSpeakerCountHint: false },
  mistral: { diarizationByDefault: true, supportsSpeakerCountHint: false },
  assemblyai: { diarizationByDefault: true, supportsSpeakerCountHint: true },
  gladia: { diarizationByDefault: true, supportsSpeakerCountHint: true },
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
    | 'elevenlabsSttModel'
    | 'deepgramSttModel'
    | 'sonioxSttModel'
    | 'speechmaticsSttModel'
    | 'revSttModel'
    | 'groqSttModel'
    | 'mistralSttModel'
    | 'assemblyaiSttModel'
    | 'gladiaSttModel'
  >
): ProviderSpec[] => {
  const specs: ProviderSpec[] = []

  if (options.useReverb) {
    appendProviderSpec(specs, { provider: 'reverb', model: 'reverb' })
  }
  if (options.elevenlabsSttModel) {
    appendProviderSpec(specs, { provider: 'elevenlabs', model: options.elevenlabsSttModel })
  }
  if (options.deepgramSttModel) {
    appendProviderSpec(specs, { provider: 'deepgram', model: options.deepgramSttModel })
  }
  if (options.sonioxSttModel) {
    appendProviderSpec(specs, { provider: 'soniox', model: options.sonioxSttModel })
  }
  if (options.speechmaticsSttModel) {
    appendProviderSpec(specs, { provider: 'speechmatics', model: options.speechmaticsSttModel })
  }
  if (options.revSttModel) {
    appendProviderSpec(specs, { provider: 'rev', model: options.revSttModel })
  }
  if (options.groqSttModel) {
    appendProviderSpec(specs, { provider: 'groq', model: options.groqSttModel })
  }
  if (options.mistralSttModel) {
    appendProviderSpec(specs, { provider: 'mistral', model: options.mistralSttModel })
  }
  if (options.assemblyaiSttModel) {
    appendProviderSpec(specs, { provider: 'assemblyai', model: options.assemblyaiSttModel })
  }
  if (options.gladiaSttModel) {
    appendProviderSpec(specs, { provider: 'gladia', model: options.gladiaSttModel })
  }

  const whisperRequested = specs.some((entry) => entry.provider === 'whisper')
  if (options.whisperExplicit && !whisperRequested) {
    appendProviderSpec(specs, { provider: 'whisper', model: options.whisperModel })
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
    resume: {
      ...(options.resumeMissing ? { path: options.resumeMissing } : {})
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
