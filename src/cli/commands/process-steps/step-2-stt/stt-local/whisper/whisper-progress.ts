import type { WhisperProgressLogContext } from '~/types'

const WHISPER_PROGRESS_PATTERN = /whisper_print_progress_callback:\s+progress =\s*(\d+)%/

const clampPercent = (value: number): number => {
  return Math.max(0, Math.min(100, value))
}

export const renderWhisperProgressBar = (percent: number, width: number = 24): string => {
  const clamped = clampPercent(percent)
  const filled = Math.round((clamped / 100) * width)
  if (filled >= width) {
    return `[${'='.repeat(width)}]`
  }
  if (filled <= 0) {
    return `[>${' '.repeat(width - 1)}]`
  }
  return `[${'='.repeat(filled - 1)}>${' '.repeat(width - filled)}]`
}

export const parseWhisperProgressPercent = (line: string): number | null => {
  const match = line.trim().match(WHISPER_PROGRESS_PATTERN)
  if (!match || !match[1]) {
    return null
  }

  const parsed = Number.parseInt(match[1], 10)
  if (!Number.isFinite(parsed)) {
    return null
  }

  return clampPercent(parsed)
}

export const computeWhisperOverallPercent = (
  segmentPercent: number,
  context: WhisperProgressLogContext
): number | null => {
  if (!context.totalSegments || context.totalSegments <= 1) {
    return null
  }

  if (
    typeof context.segmentStartSeconds !== 'number' ||
    typeof context.segmentDurationSeconds !== 'number' ||
    typeof context.totalDurationSeconds !== 'number' ||
    context.segmentDurationSeconds <= 0 ||
    context.totalDurationSeconds <= 0
  ) {
    return null
  }

  const completedSeconds = context.segmentStartSeconds + (context.segmentDurationSeconds * (clampPercent(segmentPercent) / 100))
  return clampPercent((completedSeconds / context.totalDurationSeconds) * 100)
}

export const formatWhisperProgressMessage = (
  segmentPercent: number,
  context: WhisperProgressLogContext = {}
): string => {
  const safeSegmentPercent = clampPercent(segmentPercent)
  const overallPercent = computeWhisperOverallPercent(safeSegmentPercent, context)
  if (overallPercent !== null && context.segmentNumber && context.totalSegments) {
    const roundedOverallPercent = Math.round(overallPercent)
    return `Whisper progress ${renderWhisperProgressBar(roundedOverallPercent)} ${roundedOverallPercent}% overall (segment ${context.segmentNumber}/${context.totalSegments}: ${safeSegmentPercent}%)`
  }

  if (context.segmentNumber && context.totalSegments && context.totalSegments > 1) {
    return `Whisper progress ${renderWhisperProgressBar(safeSegmentPercent)} ${safeSegmentPercent}% (segment ${context.segmentNumber}/${context.totalSegments})`
  }

  return `Whisper progress ${renderWhisperProgressBar(safeSegmentPercent)} ${safeSegmentPercent}%`
}
