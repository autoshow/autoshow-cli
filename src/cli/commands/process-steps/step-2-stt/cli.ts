import type { DiarizationOptions, DiarizationFlagOptions, ProviderSpec, RuntimeOptions, SttPolicy, TranscribeEngine, TranscribeEngineCapabilities } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

export const STT_ENGINE_CAPABILITIES = {
  reverb: { diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  elevenlabs: { diarizationByDefault: true, supportsSpeakerCountHint: true, supportsKnownSpeakerReferences: false },
  deepgram: { diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  soniox: { diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  speechmatics: { diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  rev: { diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  groq: { diarizationByDefault: false, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  openai: { diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: true },
  mistral: { diarizationByDefault: true, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false },
  assemblyai: { diarizationByDefault: true, supportsSpeakerCountHint: true, supportsKnownSpeakerReferences: false },
  gladia: { diarizationByDefault: true, supportsSpeakerCountHint: true, supportsKnownSpeakerReferences: false },
  whisper: { diarizationByDefault: false, supportsSpeakerCountHint: false, supportsKnownSpeakerReferences: false }
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
  const speakerNames = options.diarizationSpeakerNames
  const speakerReferences = options.diarizationSpeakerReferences
  const hasKnownSpeakerNames = speakerNames !== undefined && speakerNames.length > 0
  const hasKnownSpeakerReferences = speakerReferences !== undefined && speakerReferences.length > 0

  if (hasKnownSpeakerNames !== hasKnownSpeakerReferences) {
    throw CLIUsageError('OpenAI diarization requires matching --speaker-name and --speaker-reference values.')
  }

  if (speakerNames && speakerReferences) {
    if (speakerNames.length !== speakerReferences.length) {
      throw CLIUsageError(`OpenAI diarization requires the same number of --speaker-name and --speaker-reference values (received ${speakerNames.length} names and ${speakerReferences.length} references).`)
    }

    if (speakerNames.length > 4) {
      throw CLIUsageError(`OpenAI diarization supports at most 4 known speakers (received ${speakerNames.length}).`)
    }
  }

  const capabilities = STT_ENGINE_CAPABILITIES[engine]
  const diarizationOptions: DiarizationOptions = capabilities.diarizationByDefault
    ? { enabled: true }
    : {}

  if (speakerNames && speakerReferences) {
    if (!capabilities.supportsKnownSpeakerReferences) {
      throw CLIUsageError(`--speaker-name and --speaker-reference are only supported with OpenAI diarization right now; received ${engine}.`)
    }

    diarizationOptions.knownSpeakerNames = speakerNames
    diarizationOptions.knownSpeakerReferencePaths = speakerReferences
  }

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
    | 'openaiSttModel'
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
  if (options.openaiSttModel) {
    appendProviderSpec(specs, { provider: 'openai', model: options.openaiSttModel })
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
      ...(options.diarizationSpeakerCount !== undefined ? { speakerCount: options.diarizationSpeakerCount } : {}),
      ...(options.diarizationSpeakerNames ? { speakerNames: options.diarizationSpeakerNames } : {}),
      ...(options.diarizationSpeakerReferences ? { speakerReferences: options.diarizationSpeakerReferences } : {})
    },
    split: options.split
  }
}
