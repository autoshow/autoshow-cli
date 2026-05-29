import { writeProviderResult } from '../../../manifest-utils'
import type {
  Step2Metadata,
  TranscriptionEvidence,
  TranscriptionEvidenceCapabilities,
  TranscriptionEvidenceSegment,
  TranscriptionEvidenceTimingQuality,
  TranscriptionEvidenceWord,
  TranscriptionResult
} from '~/types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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
