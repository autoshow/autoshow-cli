import type {
  TranscriptionEvidence,
  TranscriptionEvidenceCapabilities,
  TranscriptionEvidenceTimingQuality
} from '~/types'

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
