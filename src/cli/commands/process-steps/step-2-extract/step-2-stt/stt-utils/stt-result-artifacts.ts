import { parseStep2RuntimeMetadata } from '../async-lifecycle'
import { writeProviderResult } from '../../../manifest-utils'
import { parseStoredStep2TimingMetadata } from '../stt-timing-metadata'
import { buildPersistedTranscriptionEvidence } from './stt-evidence'
import type {
  PersistedTranscriptionEvidence,
  ProviderResult,
  Step2Metadata,
  TranscriptionEvidence,
  TranscriptionEvidenceCapabilities,
  TranscriptionEvidenceSegment,
  TranscriptionEvidenceTimingQuality,
  TranscriptionEvidenceWord,
  TranscriptionResult
} from '~/types'
import type { SttArtifactIdentity } from '~/types'

const STT_SERVICES = new Set<Step2Metadata['transcriptionService']>([
  'whisper',
  'reverb',
  'gcloud',
  'aws',
  'deepgram',
  'deepinfra',
  'deapi',
  'elevenlabs',
  'soniox',
  'speechmatics',
  'rev',
  'groq',
  'mistral',
  'assemblyai',
  'gladia',
  'happyscribe',
  'supadata',
  'openai-stt',
  'gemini-stt',
  'glm-stt',
  'youtube-captions'
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isSttService = (
  value: unknown
): value is Step2Metadata['transcriptionService'] =>
  typeof value === 'string' && STT_SERVICES.has(value as Step2Metadata['transcriptionService'])

export const parseProviderResultEnvelope = (
  value: unknown
): ProviderResult | undefined => {
  if (
    !isRecord(value)
    || value['schemaVersion'] !== 2
    || value['kind'] !== 'provider-result'
    || typeof value['provider'] !== 'string'
    || !isRecord(value['metadata'])
    || !isRecord(value['result'])
  ) {
    return undefined
  }

  return {
    schemaVersion: 2,
    kind: 'provider-result',
    provider: value['provider'],
    ...(typeof value['model'] === 'string' ? { model: value['model'] } : {}),
    metadata: value['metadata'],
    result: value['result']
  }
}

const parseEvidenceSegment = (
  value: unknown
): TranscriptionEvidenceSegment | undefined => {
  if (
    !isRecord(value)
    || typeof value['startSeconds'] !== 'number'
    || typeof value['endSeconds'] !== 'number'
    || typeof value['text'] !== 'string'
  ) {
    return undefined
  }

  return {
    startSeconds: value['startSeconds'],
    endSeconds: value['endSeconds'],
    text: value['text'],
    ...(typeof value['speaker'] === 'string' && value['speaker'].length > 0
      ? { speaker: value['speaker'] }
      : {}),
    ...(typeof value['confidence'] === 'number' ? { confidence: value['confidence'] } : {})
  }
}

const parseEvidenceWord = (
  value: unknown
): TranscriptionEvidenceWord | undefined => {
  if (
    !isRecord(value)
    || typeof value['startSeconds'] !== 'number'
    || typeof value['endSeconds'] !== 'number'
    || typeof value['text'] !== 'string'
    || typeof value['normalized'] !== 'string'
  ) {
    return undefined
  }

  return {
    startSeconds: value['startSeconds'],
    endSeconds: value['endSeconds'],
    text: value['text'],
    normalized: value['normalized'],
    ...(typeof value['speaker'] === 'string' && value['speaker'].length > 0
      ? { speaker: value['speaker'] }
      : {}),
    ...(typeof value['confidence'] === 'number' ? { confidence: value['confidence'] } : {}),
    timingSource: value['timingSource'] === 'native' ? 'native' : 'interpolated'
  }
}

const parseEvidenceCapabilities = (
  value: unknown
): Partial<TranscriptionEvidenceCapabilities> | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const capabilities: Partial<TranscriptionEvidenceCapabilities> = {
    ...(typeof value['hasNativeWordTiming'] === 'boolean'
      ? { hasNativeWordTiming: value['hasNativeWordTiming'] }
      : {}),
    ...(typeof value['hasConfidence'] === 'boolean'
      ? { hasConfidence: value['hasConfidence'] }
      : {}),
    ...(typeof value['hasSpeakerLabels'] === 'boolean'
      ? { hasSpeakerLabels: value['hasSpeakerLabels'] }
      : {})
  }

  return Object.keys(capabilities).length > 0 ? capabilities : undefined
}

const parseEvidenceTimingQuality = (
  value: unknown
): TranscriptionEvidenceTimingQuality | undefined => {
  if (value === 'native_word' || value === 'segment_interpolated' || value === 'coarse') {
    return value
  }

  return undefined
}

const parseStoredStep2BillingMetadata = (
  value: unknown
): Step2Metadata['billing'] | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const billing: NonNullable<Step2Metadata['billing']> = {}
  if (typeof value['creditsUsed'] === 'number' && Number.isFinite(value['creditsUsed']) && value['creditsUsed'] >= 0) {
    billing.creditsUsed = value['creditsUsed']
  }
  if (typeof value['creditRateCents'] === 'number' && Number.isFinite(value['creditRateCents']) && value['creditRateCents'] >= 0) {
    billing.creditRateCents = value['creditRateCents']
  }
  if (typeof value['totalCost'] === 'number' && Number.isFinite(value['totalCost']) && value['totalCost'] >= 0) {
    billing.totalCost = value['totalCost']
  }
  if (
    value['source'] === 'response-header'
    || value['source'] === 'fallback-estimate'
    || value['source'] === 'provider_quote'
    || value['source'] === 'registry_fallback'
  ) {
    billing.source = value['source']
  }
  if (value['mode'] === 'url' || value['mode'] === 'duration' || value['mode'] === 'order' || value['mode'] === 'segment_sum') {
    billing.mode = value['mode']
  }

  return Object.keys(billing).length > 0 ? billing : undefined
}

const parseTranscriptionEvidence = (
  value: unknown
): TranscriptionEvidence | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const segments = Array.isArray(value['segments'])
    ? value['segments'].map(parseEvidenceSegment).filter((entry): entry is TranscriptionEvidenceSegment => entry !== undefined)
    : []
  const words = Array.isArray(value['words'])
    ? value['words'].map(parseEvidenceWord).filter((entry): entry is TranscriptionEvidenceWord => entry !== undefined)
    : []
  const capabilities = parseEvidenceCapabilities(value['capabilities'])
  const timingQuality = parseEvidenceTimingQuality(value['timingQuality'])

  if (
    segments.length === 0
    && words.length === 0
    && capabilities === undefined
    && timingQuality === undefined
    && !('rawResponse' in value)
  ) {
    return undefined
  }

  return {
    ...(segments.length > 0 ? { segments } : {}),
    ...(words.length > 0 ? { words } : {}),
    ...(capabilities ? { capabilities } : {}),
    ...(timingQuality ? { timingQuality } : {}),
    ...('rawResponse' in value ? { rawResponse: value['rawResponse'] } : {})
  }
}

const parseTranscriptionSegment = (
  value: unknown
): TranscriptionResult['segments'][number] | undefined => {
  if (
    !isRecord(value)
    || typeof value['start'] !== 'string'
    || typeof value['end'] !== 'string'
    || typeof value['text'] !== 'string'
  ) {
    return undefined
  }

  return {
    start: value['start'],
    end: value['end'],
    text: value['text'],
    ...(typeof value['speaker'] === 'string' && value['speaker'].length > 0
      ? { speaker: value['speaker'] }
      : {})
  }
}

export const parseStoredStep2Metadata = (
  value: unknown
): Step2Metadata | undefined => {
  if (
    !isRecord(value)
    || !isSttService(value['transcriptionService'])
    || typeof value['transcriptionModel'] !== 'string'
    || typeof value['processingTime'] !== 'number'
    || typeof value['tokenCount'] !== 'number'
  ) {
    return undefined
  }

  const timings = parseStoredStep2TimingMetadata(value['timings'])
  const runtime = parseStep2RuntimeMetadata(value['runtime'])
  const billing = parseStoredStep2BillingMetadata(value['billing'])

  return {
    transcriptionService: value['transcriptionService'],
    transcriptionModel: value['transcriptionModel'],
    processingTime: value['processingTime'],
    tokenCount: value['tokenCount'],
    ...(value['captionKind'] === 'manual' || value['captionKind'] === 'auto'
      ? { captionKind: value['captionKind'] }
      : {}),
    ...(typeof value['captionLanguage'] === 'string' ? { captionLanguage: value['captionLanguage'] } : {}),
    ...(value['captionFormat'] === 'vtt' ? { captionFormat: value['captionFormat'] } : {}),
    ...(timings ? { timings } : {}),
    ...(runtime ? { runtime } : {}),
    ...(billing ? { billing } : {})
  }
}

export const parseStoredTranscriptionResult = (
  value: unknown
): TranscriptionResult | undefined => {
  if (
    !isRecord(value)
    || typeof value['text'] !== 'string'
    || !Array.isArray(value['segments'])
  ) {
    return undefined
  }

  const segments = value['segments']
    .map(parseTranscriptionSegment)
    .filter((entry): entry is TranscriptionResult['segments'][number] => entry !== undefined)
  if (segments.length !== value['segments'].length) {
    return undefined
  }

  const evidence = parseTranscriptionEvidence(value['evidence'])

  return {
    text: value['text'],
    segments,
    ...(evidence ? { evidence } : {})
  }
}

const resolveSttArtifactIdentity = (
  envelope: ProviderResult
): SttArtifactIdentity | undefined => {
  const metadata = envelope.metadata
  if (
    isRecord(metadata)
    && isSttService(metadata['transcriptionService'])
    && typeof metadata['transcriptionModel'] === 'string'
  ) {
    return {
      transcriptionService: metadata['transcriptionService'],
      transcriptionModel: metadata['transcriptionModel']
    }
  }

  if (isSttService(envelope.provider) && typeof envelope.model === 'string' && envelope.model.length > 0) {
    return {
      transcriptionService: envelope.provider,
      transcriptionModel: envelope.model
    }
  }

  return undefined
}

export const hasSttProviderResultMetadata = (value: unknown): boolean => {
  const envelope = parseProviderResultEnvelope(value)
  if (!envelope) {
    return false
  }

  const metadata = envelope.metadata
  return isRecord(metadata)
    && isSttService(metadata['transcriptionService'])
    && typeof metadata['transcriptionModel'] === 'string'
}

export const derivePersistedTranscriptionEvidenceFromProviderResult = (
  value: unknown
): PersistedTranscriptionEvidence | undefined => {
  const envelope = parseProviderResultEnvelope(value)
  if (!envelope) {
    return undefined
  }

  const identity = resolveSttArtifactIdentity(envelope)
  const result = parseStoredTranscriptionResult(envelope.result)
  if (!identity || !result) {
    return undefined
  }

  return buildPersistedTranscriptionEvidence(result, identity)
}

export const writeSttResultArtifact = async (
  outputDir: string,
  metadata: Step2Metadata,
  result: TranscriptionResult
): Promise<void> => {
  await writeProviderResult(
    outputDir,
    metadata.transcriptionService,
    metadata.transcriptionModel,
    metadata as unknown as Record<string, unknown>,
    result as unknown as Record<string, unknown>
  )
}
