import { extname } from 'node:path'
import type { CaptionCue } from './lyrics-types'

const normalizeText = (text: string): string =>
  text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').trim()

const reindexCues = (cues: Array<Omit<CaptionCue, 'index'>>): CaptionCue[] =>
  cues.map((cue, index) => ({
    index,
    start: cue.start,
    end: cue.end,
    text: cue.text
  }))

export const parseCaptionTimestamp = (timestamp: string): number => {
  const match = timestamp.trim().match(/^(\d+):(\d{2}):(\d{2})([.,])(\d{3})$/)
  if (!match) {
    return Number.NaN
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  const milliseconds = Number(match[5])

  if (
    !Number.isFinite(hours)
    || !Number.isFinite(minutes)
    || !Number.isFinite(seconds)
    || !Number.isFinite(milliseconds)
    || minutes > 59
    || seconds > 59
  ) {
    return Number.NaN
  }

  return (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 1000)
}

export const formatCaptionTimestamp = (seconds: number, separator: '.' | ','): string => {
  const totalMilliseconds = Math.max(0, Math.round(seconds * 1000))
  const milliseconds = totalMilliseconds % 1000
  const totalSeconds = Math.floor(totalMilliseconds / 1000)
  const secs = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}${separator}${String(milliseconds).padStart(3, '0')}`
}

export const formatVtt = (cues: CaptionCue[]): string => {
  const body = cues.map((cue) =>
    `${formatCaptionTimestamp(cue.start, '.')} --> ${formatCaptionTimestamp(cue.end, '.')}\n${cue.text}`
  ).join('\n\n')

  return body.length > 0 ? `WEBVTT\n\n${body}\n` : 'WEBVTT\n'
}

export const formatSrt = (cues: CaptionCue[]): string => {
  const body = cues.map((cue, index) =>
    `${index + 1}\n${formatCaptionTimestamp(cue.start, ',')} --> ${formatCaptionTimestamp(cue.end, ',')}\n${cue.text}`
  ).join('\n\n')

  return body.length > 0 ? `${body}\n` : ''
}

export const parseVtt = (raw: string): CaptionCue[] => {
  const source = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const blocks = source.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  const cues: Array<Omit<CaptionCue, 'index'>> = []

  for (const block of blocks) {
    if (block === 'WEBVTT' || block.startsWith('WEBVTT\n')) {
      continue
    }
    if (/^NOTE(?:\s|$)/.test(block)) {
      continue
    }

    const lines = block.split('\n')
    const timingLineIndex = lines.findIndex((line) => line.includes('-->'))
    if (timingLineIndex === -1) {
      continue
    }

    const timingLine = lines[timingLineIndex]!.trim()
    const match = timingLine.match(/^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/)
    if (!match) {
      throw new Error(`Invalid VTT cue timing line: ${timingLine}`)
    }

    const start = parseCaptionTimestamp(match[1]!)
    const end = parseCaptionTimestamp(match[2]!)
    const text = normalizeText(lines.slice(timingLineIndex + 1).join('\n'))

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error(`Invalid VTT cue timestamps: ${timingLine}`)
    }
    if (!text) {
      continue
    }

    cues.push({ start, end, text })
  }

  return reindexCues(cues)
}

export const parseSrt = (raw: string): CaptionCue[] => {
  const source = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const blocks = source.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  const cues: Array<Omit<CaptionCue, 'index'>> = []

  for (const block of blocks) {
    const lines = block.split('\n')
    const timingLineIndex = lines.findIndex((line) => line.includes('-->'))
    if (timingLineIndex === -1) {
      continue
    }

    const timingLine = lines[timingLineIndex]!.trim()
    const match = timingLine.match(/^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/)
    if (!match) {
      throw new Error(`Invalid SRT cue timing line: ${timingLine}`)
    }

    const start = parseCaptionTimestamp(match[1]!)
    const end = parseCaptionTimestamp(match[2]!)
    const text = normalizeText(lines.slice(timingLineIndex + 1).join('\n'))

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error(`Invalid SRT cue timestamps: ${timingLine}`)
    }
    if (!text) {
      continue
    }

    cues.push({ start, end, text })
  }

  return reindexCues(cues)
}

export const loadCaptionFile = async (filePath: string): Promise<CaptionCue[]> => {
  const raw = await Bun.file(filePath).text()
  const extension = extname(filePath).toLowerCase()

  if (extension === '.vtt') {
    return parseVtt(raw)
  }
  if (extension === '.srt') {
    return parseSrt(raw)
  }
  if (raw.replace(/^\uFEFF/, '').startsWith('WEBVTT')) {
    return parseVtt(raw)
  }

  return parseSrt(raw)
}
