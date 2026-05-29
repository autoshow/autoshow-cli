import type { TranscriptionSegment } from '~/types'
import { toTimestamp } from './stt-utils'

type TimingCoverageAssessment = {
  compressed: boolean
  coverageRatio: number
  latestEndSeconds: number
  knownEndSeconds: number
}

const EPSILON_SECONDS = 0.001

const isFiniteNonNegativeNumber = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const timestampToSeconds = (timestamp: string): number | null => {
  const parts = timestamp.trim().replace(',', '.').split(':')
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

export const repairZeroDurationMonotonicSegments = (
  segments: readonly TranscriptionSegment[],
  options: {
    knownEndSeconds?: number | undefined
  } = {}
): { segments: TranscriptionSegment[], repaired: boolean, repairedCount: number } => {
  if (segments.length < 2) {
    return { segments: [...segments], repaired: false, repairedCount: 0 }
  }

  const parsed = segments.map((segment) => ({
    segment,
    startSeconds: timestampToSeconds(segment.start),
    endSeconds: timestampToSeconds(segment.end)
  }))
  if (parsed.some((entry) => entry.startSeconds === null || entry.endSeconds === null)) {
    return { segments: [...segments], repaired: false, repairedCount: 0 }
  }

  const starts = parsed.map((entry) => entry.startSeconds as number)
  const ends = parsed.map((entry) => entry.endSeconds as number)
  const monotonicStarts = starts.every((start, index) => index === 0 || start + EPSILON_SECONDS >= starts[index - 1]!)
  const allZeroDuration = parsed.every((entry) => Math.abs((entry.endSeconds as number) - (entry.startSeconds as number)) <= EPSILON_SECONDS)
  if (!monotonicStarts || !allZeroDuration) {
    return { segments: [...segments], repaired: false, repairedCount: 0 }
  }

  let repairedCount = 0
  const repairedSegments = parsed.map((entry, index) => {
    const startSeconds = entry.startSeconds as number
    const nextStartSeconds = starts[index + 1]
    let endSeconds = isFiniteNonNegativeNumber(nextStartSeconds) && nextStartSeconds > startSeconds
      ? nextStartSeconds
      : ends[index]!

    if (index === parsed.length - 1 && isFiniteNonNegativeNumber(options.knownEndSeconds) && options.knownEndSeconds > startSeconds) {
      endSeconds = options.knownEndSeconds
    }
    if (isFiniteNonNegativeNumber(options.knownEndSeconds)) {
      endSeconds = Math.min(endSeconds, options.knownEndSeconds)
    }
    endSeconds = Math.max(startSeconds, endSeconds)

    if (Math.abs(endSeconds - ends[index]!) > EPSILON_SECONDS) {
      repairedCount += 1
    }

    return {
      ...entry.segment,
      end: toTimestamp(endSeconds)
    }
  })

  return {
    segments: repairedSegments,
    repaired: repairedCount > 0,
    repairedCount
  }
}

export const clampSegmentsToKnownEnd = (
  segments: readonly TranscriptionSegment[],
  knownEndSeconds: number | undefined
): { segments: TranscriptionSegment[], clampedCount: number } => {
  if (!isFiniteNonNegativeNumber(knownEndSeconds)) {
    return { segments: [...segments], clampedCount: 0 }
  }

  let clampedCount = 0
  const clampedSegments = segments.map((segment) => {
    const startSeconds = timestampToSeconds(segment.start)
    const endSeconds = timestampToSeconds(segment.end)
    if (startSeconds === null || endSeconds === null || endSeconds <= knownEndSeconds + EPSILON_SECONDS) {
      return { ...segment }
    }

    const nextStartSeconds = Math.min(startSeconds, knownEndSeconds)
    const nextEndSeconds = Math.max(nextStartSeconds, Math.min(endSeconds, knownEndSeconds))
    clampedCount += 1
    return {
      ...segment,
      start: toTimestamp(nextStartSeconds),
      end: toTimestamp(nextEndSeconds)
    }
  })

  return { segments: clampedSegments, clampedCount }
}

export const clampWordTimingsToKnownEnd = <T extends { start: number, end: number }>(
  words: readonly T[],
  knownEndSeconds: number | undefined
): { words: T[], clampedCount: number } => {
  if (!isFiniteNonNegativeNumber(knownEndSeconds)) {
    return { words: words.map((word) => ({ ...word })), clampedCount: 0 }
  }

  let clampedCount = 0
  const clampedWords = words.map((word) => {
    if (word.end <= knownEndSeconds + EPSILON_SECONDS) {
      return { ...word }
    }

    const start = Math.min(word.start, knownEndSeconds)
    const end = Math.max(start, Math.min(word.end, knownEndSeconds))
    clampedCount += 1
    return {
      ...word,
      start,
      end
    }
  })

  return { words: clampedWords, clampedCount }
}

export const detectCompressedTimingCoverage = (
  segments: readonly TranscriptionSegment[],
  options: {
    knownStartSeconds?: number | undefined
    knownEndSeconds?: number | undefined
    thresholdRatio?: number | undefined
    minimumKnownDurationSeconds?: number | undefined
  }
): TimingCoverageAssessment | undefined => {
  const knownStartSeconds = options.knownStartSeconds ?? 0
  const knownEndSeconds = options.knownEndSeconds
  if (!isFiniteNonNegativeNumber(knownEndSeconds) || knownEndSeconds <= knownStartSeconds) {
    return undefined
  }

  const knownDurationSeconds = knownEndSeconds - knownStartSeconds
  const minimumKnownDurationSeconds = options.minimumKnownDurationSeconds ?? 60
  if (knownDurationSeconds < minimumKnownDurationSeconds || segments.length < 3) {
    return undefined
  }

  const latestEndSeconds = segments.reduce((latest, segment) => {
    const endSeconds = timestampToSeconds(segment.end)
    return endSeconds === null ? latest : Math.max(latest, endSeconds)
  }, 0)
  if (latestEndSeconds <= knownStartSeconds) {
    return undefined
  }

  const coverageRatio = (latestEndSeconds - knownStartSeconds) / knownDurationSeconds
  const thresholdRatio = options.thresholdRatio ?? 0.75
  return {
    compressed: coverageRatio < thresholdRatio,
    coverageRatio,
    latestEndSeconds,
    knownEndSeconds
  }
}
