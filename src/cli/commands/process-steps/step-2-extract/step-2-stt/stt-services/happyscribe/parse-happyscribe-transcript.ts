import type {
  TranscriptionEvidenceSegment,
  TranscriptionEvidenceWord,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import {
  buildSegmentsFromWords,
  formatSpeakerLabel,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import {
  isRecord,
  parseHappyScribeNumber
} from './happyscribe-utils'

const parseTimestampToSeconds = (value: string): number | undefined => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return undefined
  }

  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const parsed = Number.parseFloat(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  const parts = trimmed.split(':')
  if (parts.length < 2 || parts.length > 3) {
    return undefined
  }

  const numeric = parts.map((part) => Number.parseFloat(part))
  if (numeric.some((part) => !Number.isFinite(part))) {
    return undefined
  }

  if (numeric.length === 3) {
    return (numeric[0] as number) * 3600 + (numeric[1] as number) * 60 + (numeric[2] as number)
  }

  return (numeric[0] as number) * 60 + (numeric[1] as number)
}

const readTimeField = (
  record: Record<string, unknown>,
  candidates: Array<{ key: string, unit: 'seconds' | 'milliseconds' | 'auto' }>
): number | undefined => {
  for (const candidate of candidates) {
    if (!(candidate.key in record)) {
      continue
    }

    const rawValue = record[candidate.key]
    if (candidate.unit === 'milliseconds') {
      const parsed = parseHappyScribeNumber(rawValue)
      if (typeof parsed === 'number') {
        return parsed / 1000
      }
      continue
    }

    if (candidate.unit === 'seconds') {
      const parsed = parseHappyScribeNumber(rawValue)
      if (typeof parsed === 'number') {
        return parsed
      }
      continue
    }

    if (typeof rawValue === 'string') {
      const parsed = parseTimestampToSeconds(rawValue)
      if (typeof parsed === 'number') {
        return parsed
      }
    }

    const parsed = parseHappyScribeNumber(rawValue)
    if (typeof parsed === 'number') {
      return parsed
    }
  }

  return undefined
}

const resolveSpeakerLabel = (value: unknown): string | undefined => {
  if (typeof value === 'string' || typeof value === 'number') {
    return formatSpeakerLabel(value)
  }

  if (!isRecord(value)) {
    return undefined
  }

  for (const key of ['speaker_label', 'speakerLabel', 'speaker_name', 'speakerName', 'name', 'speaker_id', 'speakerId', 'id'] as const) {
    const candidate = value[key]
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      return formatSpeakerLabel(candidate)
    }
  }

  return undefined
}

const extractText = (
  record: Record<string, unknown>
): string | undefined => {
  for (const key of ['text', 'value', 'content', 'transcript', 'full_text', 'fullText', 'sentence'] as const) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim()
    }
  }

  if (Array.isArray(record['words'])) {
    const parts = record['words']
      .map((entry) => {
        if (!isRecord(entry)) {
          return undefined
        }
        const text = entry['text'] ?? entry['word'] ?? entry['value']
        return typeof text === 'string' && text.trim().length > 0 ? text.trim() : undefined
      })
      .filter((value): value is string => typeof value === 'string')
    if (parts.length > 0) {
      return parts.join(' ').trim()
    }
  }

  return undefined
}

const parseWord = (
  value: unknown
): TranscriptionEvidenceWord | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const textCandidate = value['text'] ?? value['word'] ?? value['value'] ?? value['content']
  if (typeof textCandidate !== 'string' || textCandidate.trim().length === 0) {
    return undefined
  }

  const startSeconds = readTimeField(value, [
    { key: 'start_seconds', unit: 'seconds' },
    { key: 'startSeconds', unit: 'seconds' },
    { key: 'start_ms', unit: 'milliseconds' },
    { key: 'startMs', unit: 'milliseconds' },
    { key: 'start_time_ms', unit: 'milliseconds' },
    { key: 'startTimeMs', unit: 'milliseconds' },
    { key: 'data_start', unit: 'seconds' },
    { key: 'dataStart', unit: 'seconds' },
    { key: 'start_time', unit: 'auto' },
    { key: 'startTime', unit: 'auto' },
    { key: 'start', unit: 'auto' }
  ])
  const endSeconds = readTimeField(value, [
    { key: 'end_seconds', unit: 'seconds' },
    { key: 'endSeconds', unit: 'seconds' },
    { key: 'end_ms', unit: 'milliseconds' },
    { key: 'endMs', unit: 'milliseconds' },
    { key: 'end_time_ms', unit: 'milliseconds' },
    { key: 'endTimeMs', unit: 'milliseconds' },
    { key: 'data_end', unit: 'seconds' },
    { key: 'dataEnd', unit: 'seconds' },
    { key: 'end_time', unit: 'auto' },
    { key: 'endTime', unit: 'auto' },
    { key: 'end', unit: 'auto' }
  ])

  if (typeof startSeconds !== 'number' || typeof endSeconds !== 'number') {
    return undefined
  }

  const text = textCandidate.trim()
  const speaker = resolveSpeakerLabel(value['speaker'] ?? value['speaker_id'] ?? value['speakerId'] ?? value['speaker_name'] ?? value['speakerName'])
  const confidence = parseHappyScribeNumber(value['confidence'])
  return {
    startSeconds,
    endSeconds,
    text,
    normalized: text.toLowerCase(),
    ...(speaker ? { speaker } : {}),
    ...(typeof confidence === 'number' ? { confidence } : {}),
    timingSource: 'native'
  }
}

const parseSegment = (
  value: unknown
): TranscriptionEvidenceSegment | undefined => {
  if (!isRecord(value)) {
    return undefined
  }

  const nestedWords = Array.isArray(value['words'])
    ? value['words'].map(parseWord).filter((word): word is TranscriptionEvidenceWord => word !== undefined)
    : []

  const text = extractText(value)
    ?? (nestedWords.length > 0 ? nestedWords.map((word) => word.text).join(' ').trim() : undefined)
  if (!text) {
    return undefined
  }

  const startSeconds = readTimeField(value, [
    { key: 'start_seconds', unit: 'seconds' },
    { key: 'startSeconds', unit: 'seconds' },
    { key: 'start_ms', unit: 'milliseconds' },
    { key: 'startMs', unit: 'milliseconds' },
    { key: 'start_time_ms', unit: 'milliseconds' },
    { key: 'startTimeMs', unit: 'milliseconds' },
    { key: 'data_start', unit: 'seconds' },
    { key: 'dataStart', unit: 'seconds' },
    { key: 'start_time', unit: 'auto' },
    { key: 'startTime', unit: 'auto' },
    { key: 'start', unit: 'auto' }
  ]) ?? nestedWords[0]?.startSeconds
  const endSeconds = readTimeField(value, [
    { key: 'end_seconds', unit: 'seconds' },
    { key: 'endSeconds', unit: 'seconds' },
    { key: 'end_ms', unit: 'milliseconds' },
    { key: 'endMs', unit: 'milliseconds' },
    { key: 'end_time_ms', unit: 'milliseconds' },
    { key: 'endTimeMs', unit: 'milliseconds' },
    { key: 'data_end', unit: 'seconds' },
    { key: 'dataEnd', unit: 'seconds' },
    { key: 'end_time', unit: 'auto' },
    { key: 'endTime', unit: 'auto' },
    { key: 'end', unit: 'auto' }
  ]) ?? nestedWords[nestedWords.length - 1]?.endSeconds

  if (typeof startSeconds !== 'number' || typeof endSeconds !== 'number') {
    return undefined
  }

  const metadata = isRecord(value['metadata']) ? value['metadata'] : undefined
  const speaker = resolveSpeakerLabel(
    value['speaker_number']
      ?? value['speakerNumber']
      ?? value['speaker']
      ?? value['speaker_id']
      ?? value['speakerId']
      ?? value['speaker_name']
      ?? value['speakerName']
      ?? metadata?.['speaker_number']
      ?? metadata?.['speakerNumber']
      ?? metadata?.['speaker']
  )
  const confidence = parseHappyScribeNumber(value['confidence'])
  return {
    startSeconds,
    endSeconds,
    text,
    ...(speaker ? { speaker } : nestedWords[0]?.speaker ? { speaker: nestedWords[0].speaker } : {}),
    ...(typeof confidence === 'number' ? { confidence } : {})
  }
}

const collectStructuredCandidates = (
  value: unknown,
  buckets: { records: Record<string, unknown>[], arrays: unknown[][] } = { records: [], arrays: [] },
  depth = 0,
  seen = new Set<object>()
): { records: Record<string, unknown>[], arrays: unknown[][] } => {
  if (depth > 5) {
    return buckets
  }

  if (Array.isArray(value)) {
    buckets.arrays.push(value)
    for (const entry of value) {
      collectStructuredCandidates(entry, buckets, depth + 1, seen)
    }
    return buckets
  }

  if (!isRecord(value) || seen.has(value)) {
    return buckets
  }

  seen.add(value)
  buckets.records.push(value)
  for (const nested of Object.values(value)) {
    collectStructuredCandidates(nested, buckets, depth + 1, seen)
  }
  return buckets
}

const toEvidenceSegmentsFromWords = (
  words: TranscriptionEvidenceWord[]
): TranscriptionEvidenceSegment[] =>
  buildSegmentsFromWords(words.map((word) => ({
    start: word.startSeconds,
    end: word.endSeconds,
    text: word.text,
    ...(word.speaker ? { speaker: word.speaker } : {})
  })), 0).map((segment) => ({
    startSeconds: parseTimestampToSeconds(segment.start) ?? 0,
    endSeconds: parseTimestampToSeconds(segment.end) ?? (parseTimestampToSeconds(segment.start) ?? 0),
    text: segment.text,
    ...(segment.speaker ? { speaker: segment.speaker } : {})
  }))

const hasRecognizedTiming = (record: Record<string, unknown>): boolean => {
  const timingKeys = [
    'start_seconds',
    'startSeconds',
    'start_ms',
    'startMs',
    'start_time_ms',
    'startTimeMs',
    'data_start',
    'dataStart',
    'start_time',
    'startTime',
    'start',
    'end_seconds',
    'endSeconds',
    'end_ms',
    'endMs',
    'end_time_ms',
    'endTimeMs',
    'data_end',
    'dataEnd',
    'end_time',
    'endTime',
    'end'
  ] as const
  if (timingKeys.some((key) => key in record)) {
    return true
  }

  const metadata = isRecord(record['metadata']) ? record['metadata'] : undefined
  return metadata ? timingKeys.some((key) => key in metadata) : false
}

export const parseHappyScribeTranscriptPayload = (
  payload: unknown,
  options: {
    offsetSeconds?: number | undefined
  } = {}
): TranscriptionResult => {
  const offsetSeconds = options.offsetSeconds ?? 0
  const candidates = collectStructuredCandidates(payload)
  const bestWords = candidates.arrays
    .map((array) => array.map(parseWord).filter((word): word is TranscriptionEvidenceWord => word !== undefined))
    .sort((left, right) => right.length - left.length)[0] ?? []
  const bestSegments = candidates.arrays
    .map((array) => array.map(parseSegment).filter((segment): segment is TranscriptionEvidenceSegment => segment !== undefined))
    .sort((left, right) =>
      right.reduce((sum, segment) => sum + segment.text.length, 0)
      - left.reduce((sum, segment) => sum + segment.text.length, 0)
    )[0] ?? []
  const text = candidates.records
    .filter((record) => !hasRecognizedTiming(record) && !Array.isArray(record['words']))
    .map(extractText)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort((left, right) => right.length - left.length)[0]

  const normalizedSegments = bestSegments.length > 0
    ? bestSegments
    : bestWords.length > 0
      ? toEvidenceSegmentsFromWords(bestWords)
      : []

  if (!text && normalizedSegments.length === 0 && bestWords.length === 0) {
    throw new Error('Happy Scribe transcript payload did not include recognizable structured transcript content')
  }

  const mappedSegments: TranscriptionSegment[] = normalizedSegments.map((segment) => ({
    start: toTimestamp(segment.startSeconds + offsetSeconds),
    end: toTimestamp(segment.endSeconds + offsetSeconds),
    text: segment.text,
    ...(segment.speaker ? { speaker: segment.speaker } : {})
  }))
  const { finalSegments, finalText } = resolveTranscriptionOutput(mappedSegments, text ?? '', offsetSeconds)
  const evidenceSegments = normalizedSegments.map((segment) => ({
    startSeconds: segment.startSeconds + offsetSeconds,
    endSeconds: segment.endSeconds + offsetSeconds,
    text: segment.text,
    ...(segment.speaker ? { speaker: segment.speaker } : {}),
    ...(typeof segment.confidence === 'number' ? { confidence: segment.confidence } : {})
  }))
  const evidenceWords = bestWords.map((word) => ({
    startSeconds: word.startSeconds + offsetSeconds,
    endSeconds: word.endSeconds + offsetSeconds,
    text: word.text,
    normalized: word.normalized,
    ...(word.speaker ? { speaker: word.speaker } : {}),
    ...(typeof word.confidence === 'number' ? { confidence: word.confidence } : {}),
    timingSource: word.timingSource
  }))

  return {
    text: finalText,
    segments: finalSegments,
    evidence: {
      ...(evidenceSegments.length > 0 ? { segments: evidenceSegments } : {}),
      ...(evidenceWords.length > 0 ? { words: evidenceWords } : {}),
      capabilities: {
        hasNativeWordTiming: evidenceWords.length > 0,
        hasConfidence: evidenceWords.some((word) => typeof word.confidence === 'number')
          || evidenceSegments.some((segment) => typeof segment.confidence === 'number'),
        hasSpeakerLabels: evidenceWords.some((word) => word.speaker !== undefined)
          || finalSegments.some((segment) => segment.speaker !== undefined)
      },
      timingQuality: evidenceWords.length > 0 ? 'native_word' : 'segment_interpolated',
      rawResponse: payload
    }
  }
}
