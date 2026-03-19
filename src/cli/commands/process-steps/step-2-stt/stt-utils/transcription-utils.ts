/**
 * Shared utilities for transcription engines (steps 2 and 3).
 */

/** Word-count approximation for token counting. */
export const countTokens = (text: string): number => {
  return text.split(/\s+/).filter(word => word.length > 0).length
}

/** Convert seconds to HH:MM:SS timestamp. */
export const toTimestamp = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

/** Safely extract a numeric seconds value from an unknown input. */
export const parseSeconds = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Punctuation-aware word joining for building text from tokens. */
export const appendToken = (current: string, token: string): string => {
  if (!current) {
    return token
  }
  if (/^[,.;:!?]/.test(token) || token.startsWith("'")) {
    return `${current}${token}`
  }
  return `${current} ${token}`
}
