import type { TranscriptionSegment } from '~/types'
import { toTimestamp } from '../../stt-utils/stt-utils'

const DEAPI_TIMESTAMP_BLOCK_RE = /\[\s*(?<start>\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?)\s*-\s*(?<end>\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?)\s*\]/g

export type ParsedDeapiTimestampBlock = {
  startSeconds: number
  endSeconds: number
  text: string
  rawStart: string
  rawEnd: string
}

export type ParsedDeapiTimestampedTranscript = {
  text: string
  segments: TranscriptionSegment[]
  markerCount: number
  parsedMarkerCount: number
  repairedRangeCount: number
}

const parseDeapiClock = (value: string): number | null => {
  const parts = value.trim().replace(',', '.').split(':')
  if (parts.length !== 2 && parts.length !== 3) {
    return null
  }

  const seconds = Number.parseFloat(parts[parts.length - 1] ?? '')
  const minutes = Number.parseInt(parts[parts.length - 2] ?? '', 10)
  const hours = parts.length === 3 ? Number.parseInt(parts[0] ?? '', 10) : 0
  if (!Number.isFinite(seconds) || !Number.isFinite(minutes) || !Number.isFinite(hours)) {
    return null
  }

  return (hours * 3600) + (minutes * 60) + seconds
}

const cleanDeapiTranscriptText = (value: string): string =>
  value
    .replace(DEAPI_TIMESTAMP_BLOCK_RE, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()

export const stripDeapiTimestampMarkers = (value: string): string =>
  cleanDeapiTranscriptText(value)

const collectTimestampBlocks = (value: string): ParsedDeapiTimestampBlock[] => {
  const matches = [...value.matchAll(DEAPI_TIMESTAMP_BLOCK_RE)]
  const parsed = matches.map((match, index) => {
    const startRaw = match.groups?.['start']
    const endRaw = match.groups?.['end']
    const startSeconds = startRaw === undefined ? null : parseDeapiClock(startRaw)
    const endSeconds = endRaw === undefined ? null : parseDeapiClock(endRaw)
    if (startRaw === undefined || endRaw === undefined || startSeconds === null || endSeconds === null) {
      return undefined
    }

    const blockEndIndex = match.index + match[0].length
    const nextMatch = matches[index + 1]
    const nextBlockIndex = nextMatch?.index ?? value.length
    const text = cleanDeapiTranscriptText(value.slice(blockEndIndex, nextBlockIndex))
    return {
      startSeconds,
      endSeconds,
      text,
      rawStart: startRaw,
      rawEnd: endRaw
    } satisfies ParsedDeapiTimestampBlock
  })

  return parsed.filter((entry): entry is ParsedDeapiTimestampBlock => entry !== undefined)
}

const nextValidStartAfter = (
  blocks: readonly ParsedDeapiTimestampBlock[],
  startIndex: number,
  currentStartSeconds: number
): number | undefined => {
  for (const block of blocks.slice(startIndex + 1)) {
    if (block.startSeconds > currentStartSeconds) {
      return block.startSeconds
    }
  }
  return undefined
}

export const parseDeapiTimestampedTranscript = (
  value: string,
  options: {
    offsetSeconds?: number | undefined
    audioDurationSeconds?: number | undefined
  } = {}
): ParsedDeapiTimestampedTranscript => {
  const markerCount = [...value.matchAll(DEAPI_TIMESTAMP_BLOCK_RE)].length
  const cleanedText = cleanDeapiTranscriptText(value)
  if (markerCount === 0) {
    return {
      text: cleanedText,
      segments: [],
      markerCount: 0,
      parsedMarkerCount: 0,
      repairedRangeCount: 0
    }
  }

  const offsetSeconds = options.offsetSeconds ?? 0
  const knownEndSeconds = typeof options.audioDurationSeconds === 'number' && Number.isFinite(options.audioDurationSeconds)
    ? offsetSeconds + options.audioDurationSeconds
    : undefined
  const blocks = collectTimestampBlocks(value)
  let repairedRangeCount = 0
  const segments = blocks.flatMap((block, index) => {
    if (block.text.length === 0) {
      return []
    }

    const startSeconds = block.startSeconds + offsetSeconds
    let endSeconds = block.endSeconds + offsetSeconds
    if (endSeconds <= startSeconds) {
      const nextStart = nextValidStartAfter(blocks, index, block.startSeconds)
      if (nextStart !== undefined) {
        endSeconds = nextStart + offsetSeconds
      } else if (knownEndSeconds !== undefined && knownEndSeconds > startSeconds) {
        endSeconds = knownEndSeconds
      }
      repairedRangeCount += 1
    }
    if (knownEndSeconds !== undefined) {
      endSeconds = Math.min(endSeconds, knownEndSeconds)
    }
    endSeconds = Math.max(startSeconds, endSeconds)

    return [{
      start: toTimestamp(startSeconds),
      end: toTimestamp(endSeconds),
      text: block.text
    }]
  })

  const strongEnough = segments.length > 0 && blocks.length >= Math.min(2, markerCount)
  return {
    text: strongEnough ? segments.map((segment) => segment.text).join(' ').trim() : cleanedText,
    segments: strongEnough ? segments : [],
    markerCount,
    parsedMarkerCount: blocks.length,
    repairedRangeCount
  }
}
