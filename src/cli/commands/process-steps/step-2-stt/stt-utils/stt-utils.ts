/**
 * Shared utilities for transcription engines (steps 2 and 3).
 */
import type { TranscriptionSegment } from '~/types'

/** Word-count approximation for token counting. */
export const countTokens = (text: string): number => {
  return text.split(/\s+/).filter(word => word.length > 0).length
}

/** Convert seconds to HH:MM:SS timestamp. */
export const toTimestamp = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

/** Safely extract a numeric seconds value from an unknown input. */
export const parseSeconds = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Punctuation-aware word joining for building text from tokens. */
export const appendToken = (current: string, token: string): string => {
  if (!current) {
    return token
  }
  if (/^[,.;:!?]/.test(token) || token.startsWith("'")) {
    return `${current}${token}`
  }
  return `${current} ${token}`
}

/** Build transcription output base path from outputDir and optional segment number. */
export const buildTranscriptionOutputBase = (outputDir: string, segmentNumber: number | undefined): string => {
  const suffix = segmentNumber ? `_segment_${String(segmentNumber).padStart(3, '0')}` : ''
  return `${outputDir}/transcription${suffix}`
}

/** Format transcript segments to the standard [HH:MM:SS] [speaker] text line format. */
export const formatTranscriptText = (segments: TranscriptionSegment[]): string => {
  return segments.map(seg => {
    const speakerPrefix = seg.speaker ? `[${seg.speaker}] ` : ''
    return `[${seg.start}] ${speakerPrefix}${seg.text}`
  }).join('\n')
}

/** Resolve final segments and final text, creating a single-segment fallback when needed. */
export const resolveTranscriptionOutput = (
  segments: TranscriptionSegment[],
  text: string,
  offsetSeconds: number
): { finalSegments: TranscriptionSegment[], finalText: string } => {
  const finalSegments = segments.length > 0
    ? segments
    : [{ start: toTimestamp(offsetSeconds), end: toTimestamp(offsetSeconds), text }]
  const finalText = text.length > 0 ? text : finalSegments.map(seg => seg.text).join(' ').trim()
  return { finalSegments, finalText }
}

/** Format a speaker id (string or number) to a display label. */
export const formatSpeakerLabel = (speakerId: string | number | null | undefined): string | undefined => {
  if (speakerId === undefined || speakerId === null) return undefined
  if (typeof speakerId === 'number') return `speaker-${speakerId}`
  const trimmed = speakerId.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/** Build TranscriptionSegment[] from a normalized word list using the standard flush-on-punctuation algorithm. */
export const buildSegmentsFromWords = (
  words: ReadonlyArray<{ start: number, end: number, text: string, speaker?: string | undefined }>,
  offsetSeconds: number
): TranscriptionSegment[] => {
  const segments: TranscriptionSegment[] = []
  const maxWordsPerSegment = 35
  const minWordsForPunctuationBreak = 18

  let currentText = ''
  let currentWordCount = 0
  let segmentStart: number | null = null
  let segmentEnd: number | null = null
  let currentSpeaker: string | undefined

  const flush = (): void => {
    const text = currentText.trim()
    if (text.length === 0) {
      currentText = ''
      currentWordCount = 0
      segmentStart = null
      segmentEnd = null
      currentSpeaker = undefined
      return
    }

    const start = segmentStart ?? 0
    const end = segmentEnd ?? start
    segments.push({
      start: toTimestamp(start + offsetSeconds),
      end: toTimestamp(end + offsetSeconds),
      text,
      ...(currentSpeaker ? { speaker: currentSpeaker } : {})
    })

    currentText = ''
    currentWordCount = 0
    segmentStart = null
    segmentEnd = null
    currentSpeaker = undefined
  }

  for (const word of words) {
    const token = word.text
    if (token.length === 0) continue

    if (segmentStart === null) segmentStart = word.start
    segmentEnd = word.end

    currentText = appendToken(currentText, token)
    currentWordCount += 1

    if (currentSpeaker === undefined && word.speaker !== undefined) {
      currentSpeaker = word.speaker
    }

    const punctuationBreak = /[.!?]$/.test(token) && currentWordCount >= minWordsForPunctuationBreak
    const sizeBreak = currentWordCount >= maxWordsPerSegment

    if (punctuationBreak || sizeBreak) flush()
  }

  flush()
  return segments
}
