import { validateJson } from '~/utils/validate/validation'
import { WhisperJsonOutputSchema, type TranscriptionSegment, type WhisperJsonOutput } from '~/types'

export const parseWhisperJson = (jsonContent: string): { text: string, segments: TranscriptionSegment[] } => {
  const data = validateJson(WhisperJsonOutputSchema, jsonContent, 'Whisper JSON output')
  const wordSegments = data.transcription.filter(seg => seg.text.trim().length > 0)
  const aggregatedSegments = aggregateWordSegments(wordSegments)
  const fullText = aggregatedSegments.map(seg => seg.text).join(' ')
  return { text: fullText, segments: aggregatedSegments }
}

export const extractWhisperWords = (jsonContent: string): Array<{ start: number; end: number; word: string }> => {
  const data = validateJson(WhisperJsonOutputSchema, jsonContent, 'Whisper JSON output words')
  return data.transcription.map(s => {
    const from = parseTimestampMs(s.timestamps.from) / 1000
    const to = parseTimestampMs(s.timestamps.to) / 1000
    return { start: from, end: to, word: s.text }
  }).filter(w => w.word && w.word !== "'")
}

const aggregateWordSegments = (wordSegments: WhisperJsonOutput['transcription']): TranscriptionSegment[] => {
  const segments: TranscriptionSegment[] = []
  const targetWordsPerSegment = 35
  const minWordsPerSegment = 20
  const maxWordsPerSegment = 45
  let currentText = ''
  let segmentStart = ''
  let segmentEnd = ''
  let actualWordCount = 0
  let i = 0
  let isNewSentence = true
  while (i < wordSegments.length) {
    const wordSeg = wordSegments[i]!
    let text = wordSeg.text
    if (!text || text.trim().length === 0) {
      i++
      continue
    }
    if (!segmentStart) {
      segmentStart = formatTimestampForDisplay(wordSeg.timestamps.from)
    }
    const prevSeg = i > 0 ? wordSegments[i - 1] : null
    const nextSeg = i + 1 < wordSegments.length ? wordSegments[i + 1] : null
    const currentStartTime = parseTimestamp(wordSeg.timestamps.from)
    const prevEndTime = prevSeg ? parseTimestamp(prevSeg.timestamps.to) : 0
    const gapFromPrev = prevSeg ? currentStartTime - prevEndTime : 1000
    const needsSpaceBefore = currentText.length > 0 && 
                             !currentText.endsWith("'") && 
                             !text.startsWith("'") &&
                             gapFromPrev > 10
    const needsPunctuationBefore = gapFromPrev > 800 && 
                                   currentText.length > 0 && 
                                   !currentText.match(/[.!?,]$/)
    if (needsPunctuationBefore && currentText.length > 0) {
      if (gapFromPrev > 1500) {
        currentText = currentText.trimEnd() + '.'
        isNewSentence = true
      } else if (gapFromPrev > 800) {
        currentText = currentText.trimEnd() + ','
      }
    }
    if (needsSpaceBefore) {
      currentText += ' '
    }
    if (isNewSentence && text.length > 0 && !text.match(/^[.!?,]/)) {
      text = text.charAt(0).toUpperCase() + text.slice(1)
      isNewSentence = false
    }
    currentText += text
    const currentFullText = currentText.trim()
    actualWordCount = currentFullText.split(/\s+/).filter(w => w.length > 0).length
    segmentEnd = formatTimestampForDisplay(wordSeg.timestamps.to)
    const isLastSegment = i === wordSegments.length - 1
    const nextGap = nextSeg ? parseTimestamp(nextSeg.timestamps.from) - parseTimestamp(wordSeg.timestamps.to) : 0
    const hasVeryLongPause = nextGap > 3000
    const hasModerateBreak = nextGap > 1500 && actualWordCount >= minWordsPerSegment
    const reachedTargetWords = actualWordCount >= targetWordsPerSegment
    const reachedMaxWords = actualWordCount >= maxWordsPerSegment
    const naturalBreak = (text.trim().match(/[.!?]$/) || hasVeryLongPause) && actualWordCount >= minWordsPerSegment
    const shouldBreak = isLastSegment || 
                       reachedMaxWords || 
                       (reachedTargetWords && (hasModerateBreak || naturalBreak)) ||
                       (hasVeryLongPause && actualWordCount >= 10) ||
                       (naturalBreak && hasModerateBreak)
    if (shouldBreak) {
      let cleanedText = currentFullText
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.!?;:])/g, '$1')
        .replace(/([A-Za-z])([,.!?;:])([A-Za-z])/g, '$1$2 $3')
      if (!cleanedText.match(/[.!?]$/) && (isLastSegment || hasVeryLongPause)) {
        cleanedText += '.'
      }
      if (cleanedText.length > 0 && !cleanedText.match(/^[A-Z]/)) {
        cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1)
      }
      if (cleanedText.length > 0) {
        segments.push({
          start: segmentStart,
          end: segmentEnd,
          text: cleanedText
        })
      }
      currentText = ''
      segmentStart = ''
      actualWordCount = 0
      isNewSentence = true
    }
    i++
  }
  if (currentText.trim().length > 0) {
    let cleanedText = currentText
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.!?;:])/g, '$1')
      .replace(/([A-Za-z])([,.!?;:])([A-Za-z])/g, '$1$2 $3')
    if (!cleanedText.match(/[.!?]$/)) {
      cleanedText += '.'
    }
    if (!cleanedText.match(/^[A-Z]/)) {
      cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1)
    }
    segments.push({
      start: segmentStart,
      end: segmentEnd,
      text: cleanedText
    })
  }
  return segments
}

const formatTimestampForDisplay = (timestamp: string): string => {
  const cleaned = timestamp.replace(',', '.')
  const parts = cleaned.split(':')
  if (parts.length === 3) {
    const [hours, minutes, secondsWithMs] = parts
    const [seconds] = secondsWithMs!.split('.')
    return `${hours}:${minutes}:${seconds!.padStart(2, '0')}`
  }
  return cleaned
}

const parseTimestamp = (timestamp: string): number => {
  const cleaned = timestamp.replace(',', '.')
  const match = cleaned.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/)
  if (match) {
    const [, hours, minutes, seconds, ms] = match
    return parseInt(hours!) * 3600000 + 
           parseInt(minutes!) * 60000 + 
           parseInt(seconds!) * 1000 + 
           parseInt(ms!)
  }
  return 0
}

const parseTimestampMs = (timestamp: string): number => {
  const cleaned = timestamp.replace(',', '.')
  const m = cleaned.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/)
  if (!m) return 0
  const [, h, mnt, s, ms] = m
  return parseInt(h!) * 3600000 + parseInt(mnt!) * 60000 + parseInt(s!) * 1000 + parseInt(ms!)
}
