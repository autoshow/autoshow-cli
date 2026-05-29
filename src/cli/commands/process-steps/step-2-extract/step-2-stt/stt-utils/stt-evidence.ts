import type {
  TranscriptionEvidence,
  TranscriptionEvidenceCapabilities,
  TranscriptionEvidenceSegment,
  TranscriptionEvidenceWord,
  TranscriptionEvidenceTimingQuality
} from '~/types'
import type { TranscriptionSegment } from '~/types'

export const buildTranscriptionWordEvidence = (options: {
  words: TranscriptionEvidenceWord[]
  segments?: TranscriptionSegment[] | undefined
  evidenceSegments?: TranscriptionEvidenceSegment[] | undefined
  emptyTimingQuality?: TranscriptionEvidenceTimingQuality | undefined
  rawResponse?: unknown
}): TranscriptionEvidence => {
  const segments = options.segments ?? []
  const evidenceSegments = options.evidenceSegments ?? []
  const words = options.words

  return {
    ...(evidenceSegments.length > 0 ? { segments: evidenceSegments } : {}),
    ...(words.length > 0 ? { words } : {}),
    capabilities: {
      hasNativeWordTiming: words.length > 0,
      hasConfidence: words.some((word) => typeof word.confidence === 'number')
        || evidenceSegments.some((segment) => typeof segment.confidence === 'number'),
      hasSpeakerLabels: words.some((word) => word.speaker !== undefined)
        || evidenceSegments.some((segment) => segment.speaker !== undefined)
        || segments.some((segment) => segment.speaker !== undefined)
    },
    timingQuality: words.length > 0 ? 'native_word' : options.emptyTimingQuality ?? 'segment_interpolated',
    ...(options.rawResponse !== undefined ? { rawResponse: options.rawResponse } : {})
  }
}

export const mergeTranscriptionEvidence = (
  evidences: Array<TranscriptionEvidence | undefined>
): TranscriptionEvidence | undefined => {
  const defined = evidences.filter((value): value is TranscriptionEvidence => value !== undefined)
  if (defined.length === 0) {
    return undefined
  }

  const segments = defined.flatMap((evidence) => evidence.segments ?? [])
  const words = defined.flatMap((evidence) => evidence.words ?? [])
  const mergedCapabilities: Partial<TranscriptionEvidenceCapabilities> = {
    hasNativeWordTiming: defined.some((evidence) => evidence.capabilities?.hasNativeWordTiming === true || evidence.words?.some((word) => word.timingSource === 'native')),
    hasConfidence: defined.some((evidence) => evidence.capabilities?.hasConfidence === true || evidence.words?.some((word) => typeof word.confidence === 'number') || evidence.segments?.some((segment) => typeof segment.confidence === 'number')),
    hasSpeakerLabels: defined.some((evidence) => evidence.capabilities?.hasSpeakerLabels === true || evidence.words?.some((word) => typeof word.speaker === 'string') || evidence.segments?.some((segment) => typeof segment.speaker === 'string'))
  }

  const timingQuality: TranscriptionEvidenceTimingQuality = defined.some((evidence) => evidence.timingQuality === 'native_word')
    ? 'native_word'
    : defined.some((evidence) => evidence.timingQuality === 'segment_interpolated' || (evidence.words?.length ?? 0) > 0)
      ? 'segment_interpolated'
      : 'coarse'

  return {
    ...(segments.length > 0 ? { segments } : {}),
    ...(words.length > 0 ? { words } : {}),
    capabilities: mergedCapabilities,
    timingQuality
  }
}
