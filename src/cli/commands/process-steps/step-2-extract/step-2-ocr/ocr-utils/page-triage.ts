const MIN_CHARS = 80
const ALPHA_RATIO = 0.15
const MAX_REPEAT_RUN = 12

const hasRepeatedGarbage = (text: string): boolean => {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length === 0) return true
  const runs = compact.match(/(.)\1{11,}/g)
  if (runs && runs.length > 0) return true
  const symbols = compact.match(/[^a-zA-Z0-9\s]/g) || []
  return symbols.length / compact.length > 0.65
}

// Unicode-aware alpha/numeric counter using \p{L} and \p{N}
const countAlphaNumericUnicode = (text: string): number => {
  // Use Unicode property escapes for letter and numeric category matching
  // This handles CJK, Arabic, Cyrillic, etc.
  const matches = text.match(/[\p{L}\p{N}]/gu)
  return matches ? matches.length : 0
}

export const isTextUsable = (rawText: string): boolean => {
  const trimmed = rawText.replace(/\s+/g, ' ').trim()
  if (trimmed.length < MIN_CHARS) return false

  // Unicode-aware alpha ratio check
  const alphaCount = countAlphaNumericUnicode(trimmed)
  if (alphaCount / trimmed.length < ALPHA_RATIO) return false

  if (hasRepeatedGarbage(trimmed)) return false
  const repeated = trimmed.match(/(.)\1{11,}/g)
  if (repeated && repeated.some(chunk => chunk.length >= MAX_REPEAT_RUN)) return false
  return true
}
