import type {
  SonioxTranscriptResponse,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import {
  formatSpeakerLabel,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'

const SILENCE_BREAK_MS = 1500
const MIN_SENTENCE_SEGMENT_CHARS = 80
const MAX_SEGMENT_CHARS = 220

const toSegments = (
  tokens: SonioxTranscriptResponse['tokens'],
  offsetSeconds: number
): TranscriptionSegment[] => {
  const segments: TranscriptionSegment[] = []

  let currentText = ''
  let currentSpeaker: string | undefined
  let segmentStartMs: number | null = null
  let segmentEndMs: number | null = null
  let lastEndMs: number | undefined

  const flush = (): void => {
    const text = currentText.trim()
    if (text.length === 0) {
      currentText = ''
      currentSpeaker = undefined
      segmentStartMs = null
      segmentEndMs = null
      return
    }

    const startSeconds = ((segmentStartMs ?? 0) / 1000) + offsetSeconds
    const endSeconds = ((segmentEndMs ?? segmentStartMs ?? 0) / 1000) + offsetSeconds
    segments.push({
      start: toTimestamp(startSeconds),
      end: toTimestamp(endSeconds),
      text,
      ...(currentSpeaker ? { speaker: currentSpeaker } : {})
    })

    currentText = ''
    currentSpeaker = undefined
    segmentStartMs = null
    segmentEndMs = null
  }

  for (const token of tokens) {
    if (token.text.length === 0) {
      continue
    }

    const startMs: number = token.start_ms ?? segmentEndMs ?? 0
    const endMs: number = token.end_ms ?? startMs
    const speaker = formatSpeakerLabel(token.speaker)
    const speakerChanged = currentText.trim().length > 0 && speaker !== currentSpeaker
    const gapBreak = currentText.trim().length > 0 && lastEndMs !== undefined && startMs - lastEndMs > SILENCE_BREAK_MS

    if (speakerChanged || gapBreak) {
      flush()
    }

    if (segmentStartMs === null) {
      segmentStartMs = startMs
    }

    if (currentSpeaker === undefined && speaker !== undefined) {
      currentSpeaker = speaker
    }

    currentText += token.text
    segmentEndMs = endMs
    lastEndMs = endMs

    const trimmed = currentText.trimEnd()
    if ((trimmed.length >= MIN_SENTENCE_SEGMENT_CHARS && /[.!?]["')\]]?$/.test(trimmed)) || trimmed.length >= MAX_SEGMENT_CHARS) {
      flush()
    }
  }

  flush()
  return segments
}

export const normalizeSonioxTranscript = (
  transcript: SonioxTranscriptResponse,
  offsetSeconds: number
): TranscriptionResult => {
  const text = transcript.text.trim().length > 0
    ? transcript.text.trim()
    : transcript.tokens.map((token) => token.text).join('').trim()
  const segments = toSegments(transcript.tokens, offsetSeconds)
  const finalSegments = segments.length > 0
    ? segments
    : [{
        start: toTimestamp(offsetSeconds),
        end: toTimestamp(offsetSeconds),
        text
      }]
  const evidenceWords = transcript.tokens
    .map((token) => {
      const textValue = token.text.trim()
      if (textValue.length === 0 || typeof token.start_ms !== 'number' || typeof token.end_ms !== 'number') {
        return null
      }

      return {
        startSeconds: (token.start_ms / 1000) + offsetSeconds,
        endSeconds: (token.end_ms / 1000) + offsetSeconds,
        text: textValue,
        normalized: textValue.toLowerCase(),
        ...(formatSpeakerLabel(token.speaker) ? { speaker: formatSpeakerLabel(token.speaker) } : {}),
        ...(typeof token.confidence === 'number' ? { confidence: token.confidence } : {}),
        timingSource: 'native' as const
      }
    })
    .filter((word): word is NonNullable<typeof word> => word !== null)

  return {
    text,
    segments: finalSegments,
    evidence: {
      ...(evidenceWords.length > 0 ? {
        words: evidenceWords
      } : {}),
      capabilities: {
        hasNativeWordTiming: evidenceWords.length > 0,
        hasConfidence: evidenceWords.some((word) => typeof word.confidence === 'number'),
        hasSpeakerLabels: evidenceWords.some((word) => word.speaker !== undefined) || finalSegments.some((segment) => segment.speaker !== undefined)
      },
      timingQuality: evidenceWords.length > 0 ? 'native_word' : 'segment_interpolated',
      rawResponse: transcript
    }
  }
}
