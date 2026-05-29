import { validateDataSafe } from '~/utils/validate/validation'
import { ReverbOutputSchema, type TranscriptionResult, type TranscriptionSegment } from '~/types'
import { toTimestamp } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import type { EmbeddedJson } from '~/types'

const formatTimestamp = toTimestamp

const adjustTimestampByOffset = (timestamp: string, offsetMinutes: number): string => {
  const parts = timestamp.split(':')
  const hours = parseInt(parts[0]!)
  const minutes = parseInt(parts[1]!)
  const seconds = parseInt(parts[2]!)
  const totalSeconds = hours * 3600 + minutes * 60 + seconds + offsetMinutes * 60
  const newHours = Math.floor(totalSeconds / 3600)
  const newMinutes = Math.floor((totalSeconds % 3600) / 60)
  const newSeconds = totalSeconds % 60
  return `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}:${String(newSeconds).padStart(2, '0')}`
}

export const parseReverbWithSpeakers = (data: unknown, offsetMinutes: number = 0): TranscriptionResult => {
  const validated = validateDataSafe(ReverbOutputSchema, data)
  if (!validated) {

    const raw = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
    const rawSegs = Array.isArray(raw['segments']) ? raw['segments'] : []
    const segments: TranscriptionSegment[] = rawSegs.map(seg => {
      const s = typeof seg === 'object' && seg !== null ? seg as Record<string, unknown> : {}
      const start = typeof s['start'] === 'number' ? s['start'] : 0
      const end = typeof s['end'] === 'number' ? s['end'] : 0
      const text = typeof s['text'] === 'string' ? s['text'] : ''
      const rawSpeaker = typeof s['speaker'] === 'string' ? s['speaker'] : undefined
      const startTimestamp = formatTimestamp(start)
      const endTimestamp = formatTimestamp(end)
      return {
        start: offsetMinutes > 0 ? adjustTimestampByOffset(startTimestamp, offsetMinutes) : startTimestamp,
        end: offsetMinutes > 0 ? adjustTimestampByOffset(endTimestamp, offsetMinutes) : endTimestamp,
        text,
        speaker: rawSpeaker !== 'UNKNOWN' ? rawSpeaker : undefined
      }
    })
    return {
      text: typeof raw['text'] === 'string' ? raw['text'] : '',
      segments
    }
  }
  const segments: TranscriptionSegment[] = validated.segments.map(seg => {
    const startTimestamp = formatTimestamp(seg.start)
    const endTimestamp = formatTimestamp(seg.end)
    return {
      start: offsetMinutes > 0 ? adjustTimestampByOffset(startTimestamp, offsetMinutes) : startTimestamp,
      end: offsetMinutes > 0 ? adjustTimestampByOffset(endTimestamp, offsetMinutes) : endTimestamp,
      text: seg.text,
      speaker: seg.speaker !== 'UNKNOWN' ? seg.speaker : undefined
    }
  })
  return {
    text: validated.text,
    segments
  }
}

const tryParseEmbeddedJson = (textContent: string): EmbeddedJson | null => {
  try {
    const j = JSON.parse(textContent)
    if (j && typeof j === 'object' && ('text' in j || 'segments' in j)) return j as EmbeddedJson
    return null
  } catch {
    return null
  }
}

export const parseReverbTextOutput = (textContent: string, offsetMinutes: number = 0): TranscriptionResult => {
  if (!textContent || textContent.trim().length === 0) {
    return {
      text: '',
      segments: [{
        start: '00:00:00',
        end: '00:00:00',
        text: 'No transcription generated'
      }]
    }
  }
  const maybeJson = tryParseEmbeddedJson(textContent.trim())
  if (maybeJson) {
    const text = typeof maybeJson.text === 'string' ? maybeJson.text : ''
    const segs = Array.isArray(maybeJson.segments) ? maybeJson.segments : []
    if (text === '' && segs.length === 0) {
      return {
        text: '',
        segments: [{
          start: '00:00:00',
          end: '00:00:00',
          text: 'No transcription generated'
        }]
      }
    }
    if (segs.length > 0) {
      const segments: TranscriptionSegment[] = segs.map(s => {
        const startTimestamp = formatTimestamp(Math.max(0, Math.floor((s.start || 0))))
        const endTimestamp = formatTimestamp(Math.max(0, Math.floor((s.end || 0))))
        return {
          start: offsetMinutes > 0 ? adjustTimestampByOffset(startTimestamp, offsetMinutes) : startTimestamp,
          end: offsetMinutes > 0 ? adjustTimestampByOffset(endTimestamp, offsetMinutes) : endTimestamp,
          text: s.text || '',
          speaker: s.speaker && s.speaker !== 'UNKNOWN' ? s.speaker : undefined
        }
      })
      return { text: text || segments.map(s => s.text).join(' '), segments }
    }
    const cleanedText = (text || '').trim()
    if (cleanedText.length > 0) {
      const words = cleanedText.split(/\s+/).filter(w => w.length > 0)
      const segments: TranscriptionSegment[] = []
      const wordsPerSegment = 100
      let currentSegmentWords: string[] = []
      let segmentIndex = 0
      words.forEach((word, idx) => {
        currentSegmentWords.push(word)
        if (currentSegmentWords.length >= wordsPerSegment || idx === words.length - 1) {
          const segmentText = currentSegmentWords.join(' ')
          const segmentStartSeconds = segmentIndex * 30 + offsetMinutes * 60
          const segmentEndSeconds = segmentStartSeconds + 30
          segments.push({
            start: formatTimestamp(segmentStartSeconds),
            end: formatTimestamp(segmentEndSeconds),
            text: segmentText
          })
          currentSegmentWords = []
          segmentIndex++
        }
      })
      return { text: cleanedText, segments }
    }
  }
  const cleanedText = textContent.trim()
  const words = cleanedText.split(/\s+/).filter(w => w.length > 0)
  const segments: TranscriptionSegment[] = []
  const wordsPerSegment = 100
  let currentSegmentWords: string[] = []
  let segmentIndex = 0
  words.forEach((word, idx) => {
    currentSegmentWords.push(word)
    if (currentSegmentWords.length >= wordsPerSegment || idx === words.length - 1) {
      const segmentText = currentSegmentWords.join(' ')
      const segmentStartSeconds = segmentIndex * 30 + offsetMinutes * 60
      const segmentEndSeconds = segmentStartSeconds + 30
      segments.push({
        start: formatTimestamp(segmentStartSeconds),
        end: formatTimestamp(segmentEndSeconds),
        text: segmentText
      })
      currentSegmentWords = []
      segmentIndex++
    }
  })
  if (segments.length === 0) {
    const startTime = formatTimestamp(offsetMinutes * 60)
    const endTime = formatTimestamp(offsetMinutes * 60)
    segments.push({
      start: startTime,
      end: endTime,
      text: cleanedText
    })
  }
  return { text: cleanedText, segments }
}
