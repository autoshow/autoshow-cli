const MIN_CHARS = 80
const ALPHA_RATIO = 0.15
const MAX_REPEAT_RUN = 12

// Office quality heuristic thresholds
const OFFICE_MIN_WORDS = 20
const OFFICE_MAX_REPLACEMENT_RATIO = 0.05
const OFFICE_MIN_ALPHA_NUMERIC_RATIO = 0.10
const SPREADSHEET_MIN_TABULAR_LINES = 3
const SPREADSHEET_MIN_NUMERIC_TOKENS = 50
const SPREADSHEET_ALT_MIN_WORDS = 8

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

// Office document quality heuristic
// Returns true if the extracted office text is usable (no OCR fallback needed)
export const isOfficeTextUsable = (text: string, format?: 'xlsx' | 'ods' | 'other'): boolean => {
  const trimmed = text.replace(/\s+/g, ' ').trim()

  // Encoding validation: check for replacement characters and null bytes
  const totalChars = trimmed.length
  if (totalChars === 0) return false

  const replacementCount = (trimmed.match(/\uFFFD/g) || []).length
  const nullCount = (trimmed.match(/\0/g) || []).length
  if ((replacementCount + nullCount) / totalChars > OFFICE_MAX_REPLACEMENT_RATIO) return false

  // Alpha/numeric content ratio (Unicode-aware)
  const alphaNumCount = countAlphaNumericUnicode(trimmed)
  const contentRatio = alphaNumCount / totalChars

  // Word count check
  const words = trimmed.split(/\s+/).filter(Boolean)
  const wordCount = words.length

  // Spreadsheet-aware override for XLSX/ODS
  if (format === 'xlsx' || format === 'ods') {
    const tabularLines = trimmed.split('\n').filter(line => line.includes('\t') || line.split(/\s{2,}/).length >= 2)
    const numericTokens = (trimmed.match(/\b\d+\.?\d*\b/g) || []).length

    if (tabularLines.length >= SPREADSHEET_MIN_TABULAR_LINES &&
        numericTokens >= SPREADSHEET_MIN_NUMERIC_TOKENS) {
      // Tabular data: relaxed word count, just need encoding to pass
      return (wordCount >= SPREADSHEET_ALT_MIN_WORDS || numericTokens >= SPREADSHEET_MIN_NUMERIC_TOKENS)
    }
  }

  if (wordCount < OFFICE_MIN_WORDS) return false
  if (contentRatio < OFFICE_MIN_ALPHA_NUMERIC_RATIO) return false

  return true
}
