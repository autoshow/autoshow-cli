import { GoogleCloudRecognizeResponseSchema, type TranscriptionResult, type TranscriptionSegment } from '~/types'
import {
  appendToken,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/stt-utils'
import { validateData } from '~/utils/validate/validation'

type EvidenceWord = NonNullable<NonNullable<TranscriptionResult['evidence']>['words']>[number]

const parseDurationSeconds = (value: string | undefined): number | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }

  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)s$/)
  if (!match) {
    return undefined
  }

  const parsed = Number.parseFloat(match[1] ?? '')
  return Number.isFinite(parsed) ? parsed : undefined
}

const normalizeSpeakerLabel = (
  value: string | undefined,
  speakerMap: Map<string, string>
): string | undefined => {
  const trimmed = value?.trim()
  if (!trimmed) {
    return undefined
  }

  const existing = speakerMap.get(trimmed)
  if (existing) {
    return existing
  }

  const normalized = `spk_${speakerMap.size + 1}`
  speakerMap.set(trimmed, normalized)
  return normalized
}

const buildTranscriptText = (words: EvidenceWord[]): string => {
  let text = ''
  for (const word of words) {
    text = appendToken(text, word.text)
  }
  return text.trim()
}

const buildSegmentsFromWords = (
  words: EvidenceWord[]
): TranscriptionSegment[] => {
  const segments: TranscriptionSegment[] = []
  const maxWordsPerSegment = 35
  const minWordsForPunctuationBreak = 18

  let currentText = ''
  let currentWordCount = 0
  let currentSpeaker: string | undefined
  let segmentStart: number | undefined
  let segmentEnd: number | undefined

  const flush = (): void => {
    const text = currentText.trim()
    if (text.length === 0 || segmentStart === undefined || segmentEnd === undefined) {
      currentText = ''
      currentWordCount = 0
      currentSpeaker = undefined
      segmentStart = undefined
      segmentEnd = undefined
      return
    }

    segments.push({
      start: toTimestamp(segmentStart),
      end: toTimestamp(segmentEnd),
      text,
      ...(currentSpeaker ? { speaker: currentSpeaker } : {})
    })

    currentText = ''
    currentWordCount = 0
    currentSpeaker = undefined
    segmentStart = undefined
    segmentEnd = undefined
  }

  for (const word of words) {
    const speakerChanged = currentText.length > 0
      && currentSpeaker !== undefined
      && word.speaker !== undefined
      && word.speaker !== currentSpeaker
    if (speakerChanged) {
      flush()
    }

    if (segmentStart === undefined) {
      segmentStart = word.startSeconds
    }
    segmentEnd = word.endSeconds
    currentSpeaker = word.speaker ?? currentSpeaker
    currentText = appendToken(currentText, word.text)
    currentWordCount += 1

    const punctuationBreak = /[.!?]$/.test(word.text) && currentWordCount >= minWordsForPunctuationBreak
    const sizeBreak = currentWordCount >= maxWordsPerSegment
    if (punctuationBreak || sizeBreak) {
      flush()
    }
  }

  flush()
  return segments
}

export const parseGcloudSttResponse = (
  payload: unknown,
  options: {
    offsetSeconds?: number | undefined
  } = {}
): TranscriptionResult => {
  const parsed = validateData(GoogleCloudRecognizeResponseSchema, payload, 'Google Cloud STT recognize response')
  const offsetSeconds = options.offsetSeconds ?? 0
  const results = parsed.results ?? []
  const finalAlternative = results[results.length - 1]?.alternatives?.[0]
  const speakerMap = new Map<string, string>()

  const words: EvidenceWord[] = (finalAlternative?.words ?? [])
    .map((word): EvidenceWord | null => {
      const text = word.word.trim()
      const startSeconds = parseDurationSeconds(word.startOffset)
      const endSeconds = parseDurationSeconds(word.endOffset)
      if (text.length === 0 || startSeconds === undefined || endSeconds === undefined) {
        return null
      }

      const normalizedSpeaker = normalizeSpeakerLabel(word.speakerLabel, speakerMap)
      const confidence = typeof word.confidence === 'number' && word.confidence > 0 ? word.confidence : undefined

      return {
        startSeconds: startSeconds + offsetSeconds,
        endSeconds: endSeconds + offsetSeconds,
        text,
        normalized: text.toLowerCase(),
        ...(normalizedSpeaker ? { speaker: normalizedSpeaker } : {}),
        ...(confidence !== undefined ? { confidence } : {}),
        timingSource: 'native' as const
      }
    })
    .filter((word): word is EvidenceWord => word !== null)

  const transcriptText = words.length > 0
    ? buildTranscriptText(words)
    : results
      .map((result) => result.alternatives?.[0]?.transcript?.trim() ?? '')
      .filter((text) => text.length > 0)
      .join(' ')
      .trim()
  const segments = buildSegmentsFromWords(words)
  const { finalSegments, finalText } = resolveTranscriptionOutput(segments, transcriptText, offsetSeconds)

  return {
    text: finalText,
    segments: finalSegments,
    evidence: {
      ...(words.length > 0 ? { words } : {}),
      capabilities: {
        hasNativeWordTiming: words.length > 0,
        hasConfidence: words.some((word) => typeof word.confidence === 'number'),
        hasSpeakerLabels: words.some((word) => word.speaker !== undefined) || finalSegments.some((segment) => segment.speaker !== undefined)
      },
      timingQuality: words.length > 0 ? 'native_word' : 'coarse',
      rawResponse: parsed
    }
  }
}
