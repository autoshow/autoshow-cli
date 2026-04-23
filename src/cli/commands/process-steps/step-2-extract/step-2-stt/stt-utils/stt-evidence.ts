import type {
  PersistedTranscriptionEvidence,
  TokenizedWord,
  TranscriptionEvidence,
  TranscriptionEvidenceCapabilities,
  TranscriptionEvidenceSegment,
  TranscriptionEvidenceTimingQuality,
  TranscriptionEvidenceWord,
  TranscriptionResult
} from '~/types'

const WORD_PATTERN = /[A-Za-z0-9]+(?:[/'’-][A-Za-z0-9]+)*/g

const normalizeText = (text: string): string => text
  .normalize('NFKC')
  .replace(/[‘’]/g, '\'')
  .replace(/[“”]/g, '"')
  .replace(/[—–]/g, '-')

export const parseTranscriptTimestampToSeconds = (timestamp: string): number => {
  const match = timestamp.match(/^(\d{2}):(\d{2}):(\d{2})$/)
  if (!match) {
    return 0
  }

  const hours = match[1] ?? '0'
  const minutes = match[2] ?? '0'
  const seconds = match[3] ?? '0'
  return (Number.parseInt(hours, 10) * 3600)
    + (Number.parseInt(minutes, 10) * 60)
    + Number.parseInt(seconds, 10)
}

const normalizeEvidenceWord = (text: string): string => normalizeText(text).toLowerCase()

const tokenizeEvidenceWords = (text: string): TokenizedWord[] => {
  const normalized = normalizeText(text)
  return [...normalized.matchAll(WORD_PATTERN)].map((match) => ({
    text: match[0],
    normalized: normalizeEvidenceWord(match[0])
  }))
}

const sortByTime = <T extends { startSeconds: number, endSeconds: number }>(values: T[]): T[] =>
  [...values].sort((left, right) => {
    if (left.startSeconds !== right.startSeconds) {
      return left.startSeconds - right.startSeconds
    }
    if (left.endSeconds !== right.endSeconds) {
      return left.endSeconds - right.endSeconds
    }
    return 0
  })

const toEvidenceSegmentsFromTranscriptSegments = (
  result: TranscriptionResult
): TranscriptionEvidenceSegment[] => {
  if (result.segments.length === 0 && result.text.trim().length > 0) {
    return [{
      startSeconds: 0,
      endSeconds: 0,
      text: result.text.trim()
    }]
  }

  return result.segments
    .map((segment) => ({
      startSeconds: parseTranscriptTimestampToSeconds(segment.start),
      endSeconds: parseTranscriptTimestampToSeconds(segment.end),
      text: segment.text.trim(),
      ...(segment.speaker ? { speaker: segment.speaker } : {})
    }))
    .filter((segment) => segment.text.length > 0)
}

const deriveWordsFromSegments = (
  segments: TranscriptionEvidenceSegment[]
): TranscriptionEvidenceWord[] => {
  const words: TranscriptionEvidenceWord[] = []

  for (const segment of segments) {
    const tokens = tokenizeEvidenceWords(segment.text)
    if (tokens.length === 0) {
      continue
    }

    const nominalDuration = Math.max(
      0.28 * tokens.length,
      segment.endSeconds - segment.startSeconds,
      0.4
    )
    const syntheticEnd = Math.max(segment.endSeconds, segment.startSeconds + nominalDuration)
    const step = (syntheticEnd - segment.startSeconds) / tokens.length

    tokens.forEach((token, index) => {
      const startSeconds = segment.startSeconds + (step * index)
      const endSeconds = index === tokens.length - 1
        ? syntheticEnd
        : segment.startSeconds + (step * (index + 1))
      words.push({
        startSeconds,
        endSeconds: Math.max(startSeconds, endSeconds),
        text: token.text,
        normalized: token.normalized,
        ...(segment.speaker ? { speaker: segment.speaker } : {}),
        ...(segment.confidence !== undefined ? { confidence: segment.confidence } : {}),
        timingSource: 'interpolated'
      })
    })
  }

  return words
}

const mergeCapabilities = (
  evidence: TranscriptionEvidence | undefined,
  segments: TranscriptionEvidenceSegment[],
  words: TranscriptionEvidenceWord[]
): TranscriptionEvidenceCapabilities => ({
  hasNativeWordTiming: evidence?.capabilities?.hasNativeWordTiming === true
    || words.some((word) => word.timingSource === 'native'),
  hasConfidence: evidence?.capabilities?.hasConfidence === true
    || words.some((word) => typeof word.confidence === 'number')
    || segments.some((segment) => typeof segment.confidence === 'number'),
  hasSpeakerLabels: evidence?.capabilities?.hasSpeakerLabels === true
    || words.some((word) => typeof word.speaker === 'string' && word.speaker.length > 0)
    || segments.some((segment) => typeof segment.speaker === 'string' && segment.speaker.length > 0)
})

const inferTimingQuality = (
  evidence: TranscriptionEvidence | undefined,
  words: TranscriptionEvidenceWord[]
): TranscriptionEvidenceTimingQuality => {
  if (evidence?.timingQuality) {
    return evidence.timingQuality
  }
  if (words.some((word) => word.timingSource === 'native')) {
    return 'native_word'
  }
  if (words.length > 0) {
    return 'segment_interpolated'
  }
  return 'coarse'
}

const collectSpeakerInventory = (
  segments: TranscriptionEvidenceSegment[],
  words: TranscriptionEvidenceWord[]
): string[] => {
  const ordered: string[] = []
  const seen = new Set<string>()

  for (const speaker of [
    ...segments.map((segment) => segment.speaker),
    ...words.map((word) => word.speaker)
  ]) {
    if (!speaker || seen.has(speaker)) {
      continue
    }
    seen.add(speaker)
    ordered.push(speaker)
  }

  return ordered
}

export const buildPersistedTranscriptionEvidence = (
  result: TranscriptionResult,
  metadata: { transcriptionService: string, transcriptionModel: string }
): PersistedTranscriptionEvidence => {
  const evidence = result.evidence
  const segments = sortByTime(
    (evidence?.segments && evidence.segments.length > 0
      ? evidence.segments
      : toEvidenceSegmentsFromTranscriptSegments(result)
    )
      .map((segment) => ({
        startSeconds: Number.isFinite(segment.startSeconds) ? segment.startSeconds : 0,
        endSeconds: Number.isFinite(segment.endSeconds) ? segment.endSeconds : segment.startSeconds,
        text: segment.text.trim(),
        ...(segment.speaker ? { speaker: segment.speaker } : {}),
        ...(typeof segment.confidence === 'number' ? { confidence: segment.confidence } : {})
      }))
      .filter((segment) => segment.text.length > 0)
  )

  const words = sortByTime(
    (evidence?.words && evidence.words.length > 0
      ? evidence.words
      : deriveWordsFromSegments(segments)
    )
      .map((word) => ({
        startSeconds: Number.isFinite(word.startSeconds) ? word.startSeconds : 0,
        endSeconds: Number.isFinite(word.endSeconds) ? word.endSeconds : word.startSeconds,
        text: word.text.trim(),
        normalized: word.normalized.trim().length > 0
          ? word.normalized.trim().toLowerCase()
          : normalizeEvidenceWord(word.text),
        ...(word.speaker ? { speaker: word.speaker } : {}),
        ...(typeof word.confidence === 'number' ? { confidence: word.confidence } : {}),
        timingSource: word.timingSource
      }))
      .filter((word) => word.text.length > 0)
  )

  const capabilities = mergeCapabilities(evidence, segments, words)
  const transcriptText = result.text.trim().length > 0
    ? result.text.trim()
    : segments.map((segment) => segment.text).join(' ').trim()

  return {
    service: metadata.transcriptionService,
    model: metadata.transcriptionModel,
    label: `${metadata.transcriptionService}/${metadata.transcriptionModel}`,
    transcriptText,
    segments,
    words,
    capabilities,
    timingQuality: inferTimingQuality(evidence, words),
    speakerInventory: collectSpeakerInventory(segments, words)
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
