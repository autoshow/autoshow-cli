import type { SplitPolicyTarget } from '~/types'
import {
  SPLIT_DURATION_SAFETY_SECONDS,
  resolveSttSplitPolicy
} from '../stt-split-policy'

const SPLIT_RETRY_ON_TOO_LARGE_ENGINES = new Set<string>([
  'elevenlabs',
  'deepgram',
  'deepinfra',
  'speechmatics',
  'rev',
  'groq',
  'grok',
  'mistral',
  'assemblyai',
  'gladia',
  'happyscribe',
  'openai-stt',
  'glm-stt',
  'together'
])

const MIN_ADAPTIVE_SPLIT_SEGMENT_SECONDS = 60

type SplitRetryReason = 'attachment_cap' | 'duration_cap' | 'request_budget'
export type SplitLimitClassification = {
  reason: SplitRetryReason
  durationCapSeconds?: number | undefined
}

const toErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return undefined
}

export const extractSttSplitDurationCapSecondsFromError = (error: unknown): number | undefined => {
  const message = toErrorMessage(error)
  if (!message) {
    return undefined
  }

  const patterns = [
    /audio duration\s+[\d.]+\s+seconds is longer than\s+([\d.]+)\s+seconds which is the maximum for this model/i,
    /audio duration\s+[\d.]+\s+seconds is longer than\s+([\d.]+)\s+seconds/i,
    /maximum(?: audio)? duration(?: is| of)?\s+([\d.]+)\s*seconds/i
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (!match) {
      continue
    }
    const capFromError = Number.parseFloat(match[1] ?? '')
    if (Number.isFinite(capFromError) && capFromError > 0) {
      return capFromError
    }
  }

  return undefined
}

const isRequestBudgetTranscriptionError = (error: unknown): boolean => {
  const message = toErrorMessage(error)
  if (!message) {
    return false
  }

  return /\binput_too_large\b|input too large|maximum context length|context length|too many input tokens|exceeds? .*token/i.test(message)
}

export const isPayloadTooLargeTranscriptionError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return error.message.includes('(413)') || /payload too large|request size limit exceeded|file too large|maximum file size|max file size|file size exceeds|\binput_too_large\b|input too large/i.test(error.message)
  }

  if (typeof error === 'string') {
    return error.includes('(413)') || /payload too large|request size limit exceeded|file too large|maximum file size|max file size|file size exceeds|\binput_too_large\b|input too large/i.test(error)
  }

  return false
}

export const classifySttSplitLimitError = (
  target: SplitPolicyTarget,
  error: unknown
): SplitLimitClassification | undefined => {
  const durationCapSeconds = extractSttSplitDurationCapSecondsFromError(error)
  if (durationCapSeconds !== undefined) {
    return {
      reason: 'duration_cap',
      durationCapSeconds
    }
  }

  const policy = resolveSttSplitPolicy(target)
  if (policy.requestBudgetSeconds !== undefined && isRequestBudgetTranscriptionError(error)) {
    return { reason: 'request_budget' }
  }

  if (SPLIT_RETRY_ON_TOO_LARGE_ENGINES.has(target.service) && isPayloadTooLargeTranscriptionError(error)) {
    return { reason: 'attachment_cap' }
  }

  return undefined
}

export const shouldRetrySplitTranscriptionAfterError = (
  target: SplitPolicyTarget,
  _splitRequested: boolean,
  error: unknown
): boolean => {
  return classifySttSplitLimitError(target, error) !== undefined
}

export const resolveAdaptiveSplitSegmentDurationMinutes = (
  previousSegmentDurationMinutes: number,
  error: unknown
): number | undefined => {
  const previousSegmentSeconds = Math.floor(previousSegmentDurationMinutes * 60)
  if (!Number.isFinite(previousSegmentSeconds) || previousSegmentSeconds <= MIN_ADAPTIVE_SPLIT_SEGMENT_SECONDS) {
    return undefined
  }

  const parsedDurationCapSeconds = extractSttSplitDurationCapSecondsFromError(error)
  const proposedSeconds = parsedDurationCapSeconds !== undefined
    ? Math.min(previousSegmentSeconds - 1, Math.floor(parsedDurationCapSeconds) - SPLIT_DURATION_SAFETY_SECONDS)
    : Math.floor(previousSegmentSeconds / 2)
  const nextSegmentSeconds = Math.max(MIN_ADAPTIVE_SPLIT_SEGMENT_SECONDS, proposedSeconds)

  if (nextSegmentSeconds >= previousSegmentSeconds) {
    return undefined
  }

  return Number((nextSegmentSeconds / 60).toFixed(3))
}
