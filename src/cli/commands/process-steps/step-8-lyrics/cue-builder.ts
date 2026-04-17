import type { TranscriptionEvidenceWord, TranscriptionResult, TranscriptionSegment } from '~/types'
import type { CaptionCue, LyricsCueSource } from './lyrics-types'

const MAX_WORDS_PER_CUE = 7
const MAX_CHARACTERS_PER_CUE = 42
const MAX_CUE_DURATION_SECONDS = 4.5
const HARD_BREAK_GAP_SECONDS = 0.65

const normalizeCueText = (text: string): string =>
  text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim()

const shouldInsertSpace = (currentText: string, nextToken: string): boolean => {
  if (currentText.length === 0 || nextToken.length === 0) {
    return false
  }

  const first = nextToken[0]!
  if (',.;:!?)]}'.includes(first) || first === '\'') {
    return false
  }

  const last = currentText[currentText.length - 1]
  if (last === undefined) {
    return false
  }
  if (last === '\'' || '([{'.includes(last)) {
    return false
  }

  return true
}

const appendCueToken = (currentText: string, token: string): string => {
  const trimmed = token.trim()
  if (trimmed.length === 0) {
    return currentText
  }

  return shouldInsertSpace(currentText, trimmed) ? `${currentText} ${trimmed}` : `${currentText}${trimmed}`
}

const flushWordCue = (
  cues: CaptionCue[],
  words: TranscriptionEvidenceWord[],
  text: string
): void => {
  const normalizedText = normalizeCueText(text)
  if (words.length === 0 || normalizedText.length === 0) {
    return
  }

  const start = words[0]!.startSeconds
  const end = Math.max(words[words.length - 1]!.endSeconds, start + 0.1)
  if (end <= start) {
    return
  }

  cues.push({
    index: cues.length,
    start,
    end,
    text: normalizedText
  })
}

const buildFromWords = (words: TranscriptionEvidenceWord[]): CaptionCue[] => {
  const cues: CaptionCue[] = []
  let currentWords: TranscriptionEvidenceWord[] = []
  let currentText = ''

  const flushCurrentCue = (): void => {
    flushWordCue(cues, currentWords, currentText)
    currentWords = []
    currentText = ''
  }

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!
    const token = word.text.trim()
    if (token.length === 0) {
      continue
    }

    const projectedText = appendCueToken(currentText, token)
    const previousWord = currentWords[currentWords.length - 1]
    const gapFromPrevious = previousWord ? word.startSeconds - previousWord.endSeconds : 0
    const currentDuration = previousWord && currentWords[0]
      ? previousWord.endSeconds - currentWords[0]!.startSeconds
      : 0

    if (
      currentWords.length > 0
      && (
        gapFromPrevious >= HARD_BREAK_GAP_SECONDS
        || currentWords.length >= MAX_WORDS_PER_CUE
        || projectedText.length > MAX_CHARACTERS_PER_CUE
        || currentDuration >= MAX_CUE_DURATION_SECONDS
      )
    ) {
      flushCurrentCue()
    }

    currentWords.push(word)
    currentText = appendCueToken(currentText, token)

    const nextWord = words[index + 1]
    const gapToNext = nextWord ? nextWord.startSeconds - word.endSeconds : Number.POSITIVE_INFINITY
    const cueDuration = word.endSeconds - currentWords[0]!.startSeconds

    if (
      currentWords.length >= MAX_WORDS_PER_CUE
      || currentText.length >= MAX_CHARACTERS_PER_CUE
      || cueDuration >= MAX_CUE_DURATION_SECONDS
      || gapToNext >= HARD_BREAK_GAP_SECONDS
      || (/[.!?]$/.test(currentText) && currentWords.length >= 3)
      || (/[,:;]$/.test(currentText) && currentWords.length >= 2 && gapToNext >= 0.25)
    ) {
      flushCurrentCue()
    }
  }

  flushCurrentCue()
  return cues
}

export const parseWhisperSegmentTimestamp = (timestamp: string): number => {
  const match = timestamp.match(/^(\d{2}):(\d{2}):(\d{2})$/)
  if (!match) {
    return Number.NaN
  }

  return (Number(match[1]) * 3600) + (Number(match[2]) * 60) + Number(match[3])
}

const buildFromSegments = (segments: TranscriptionSegment[]): CaptionCue[] => {
  const cues: CaptionCue[] = []

  for (const segment of segments) {
    const start = parseWhisperSegmentTimestamp(segment.start)
    const end = parseWhisperSegmentTimestamp(segment.end)
    const text = normalizeCueText(segment.text)

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || text.length === 0) {
      continue
    }

    cues.push({
      index: cues.length,
      start,
      end,
      text
    })
  }

  return cues
}

export const buildLyricsCues = (
  transcription: TranscriptionResult
): { cues: CaptionCue[], source: LyricsCueSource } => {
  const words = transcription.evidence?.words ?? []
  const wordCues = buildFromWords(words)
  if (wordCues.length > 0) {
    return { cues: wordCues, source: 'whisper-words' }
  }

  return {
    cues: buildFromSegments(transcription.segments),
    source: 'whisper-segments'
  }
}
