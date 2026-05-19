import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'

export const CHAPTER_SLUG_MAX_LENGTH = 60
export const ROMAN_RE = /^[ivxlcdm]+$/i
export const ISOLATED_LABEL_RE = /^([0-9]+|[ivxlcdm]+)$/i
export const TOC_PAGE_TITLE_RE = /^(table of contents|contents)$/i
export const INDEX_PAGE_TITLE_RE = /^index$/i
export const FILE_EXTENSION_RE = /\.(pdf|epub|docx?|txt|rtf)$/i
export const OUTLINE_ARTIFACT_RE = /\b(?:topaz|scan(?:ned)?|enhance(?:d)?|ocr|djvu|archive|text|output|input)\b/i
export const ISBNISH_OUTLINE_RE = /\b(?:97[89]\d{10}|[0-9]{9}[0-9x])\b/i
export const TOC_ARTIFACT_RE = /\b(?:https?:\/\/|www\.|web\.archive|archive\.org|original page|orignal page|main branch|printing|\d{1,2}\/\d{1,2}\/\d{2,4})\b/i
export const MAX_TOC_TITLE_LENGTH = 120
export const MAX_TOC_ARABIC_PAGE = 1200
export const MAX_TOC_ROMAN_PAGE = 100

export const stripMutoolPageBanner = (text: string): string =>
  text.replace(/^page(?:\s+\S+)?\s+\d+\s*\n?/i, '')

export const normalizeInlineWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

export const normalizeTitle = (value: string): string =>
  normalizeInlineWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const normalizeCompactTitle = (value: string): string =>
  normalizeTitle(value).replace(/\s+/g, '')

export const normalizeDecoratedLabel = (value: string): string =>
  value.trim().replace(/^[\-\[\]()\s]+|[\-\[\]()\s]+$/g, '')

export const extractPageLines = (text: string): string[] =>
  stripMutoolPageBanner(text)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

export const stripLeadingIsolatedLabels = (lines: string[]): string[] => {
  let index = 0
  while (index < lines.length && ISOLATED_LABEL_RE.test(normalizeDecoratedLabel(lines[index] ?? ''))) {
    index += 1
  }
  return lines.slice(index)
}

export const getTocCandidateLines = (text: string): string[] =>
  stripLeadingIsolatedLabels(extractPageLines(text))

export const countAlphaChars = (value: string): number =>
  (value.match(/[A-Za-z]/g) ?? []).length

export const countWords = (value: string): number =>
  normalizeInlineWhitespace(value)
    .split(/\s+/)
    .filter(Boolean)
    .length

export const countNumericTokens = (value: string): number =>
  normalizeInlineWhitespace(value).match(/\b\d+\b/g)?.length ?? 0

export const isMostlyUppercase = (value: string): boolean => {
  const letters = value.match(/[A-Za-z]/g) ?? []
  if (letters.length < 4) {
    return false
  }
  const uppercase = value.match(/[A-Z]/g) ?? []
  return uppercase.length / letters.length >= 0.65
}

export const isLikelyFilenameTitle = (value: string): boolean => {
  const trimmed = normalizeInlineWhitespace(value)
  const normalized = normalizeTitle(trimmed)
  if (trimmed.length === 0) {
    return false
  }
  if (FILE_EXTENSION_RE.test(trimmed)) {
    return true
  }
  if (ISBNISH_OUTLINE_RE.test(trimmed)) {
    return true
  }
  if (OUTLINE_ARTIFACT_RE.test(normalized) && /(?:\.| |-|_)(?:pdf|epub|txt|doc|docx)\b/i.test(trimmed)) {
    return true
  }
  return false
}

export const getOutlineRejectReason = (title: string): string | undefined => {
  const normalized = normalizeTitle(title)
  if (normalized.length === 0) {
    return 'blank title'
  }
  if ([
    'table of contents',
    'contents',
    'request',
    'response',
    'see also',
    'errors',
    'next step'
  ].includes(normalized)) {
    return 'generic title'
  }
  if (isLikelyFilenameTitle(title)) {
    return 'filename bookmark'
  }
  return undefined
}

export const romanToInt = (value: string): number => {
  const roman = value.toUpperCase()
  const lookup: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000
  }
  let total = 0
  let previous = 0
  for (let index = roman.length - 1; index >= 0; index--) {
    const char = roman[index]
    const current = char ? lookup[char] ?? 0 : 0
    if (current < previous) {
      total -= current
    } else {
      total += current
      previous = current
    }
  }
  return total
}

export const intToRoman = (value: number): string => {
  if (!Number.isFinite(value) || value < 1) {
    return String(value)
  }
  const numerals: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I']
  ]
  let remaining = value
  let roman = ''
  for (const [amount, numeral] of numerals) {
    while (remaining >= amount) {
      roman += numeral
      remaining -= amount
    }
  }
  return roman
}

export const parsePrintedLabel = (value: string): { style: 'arabic' | 'roman', raw: string, numericValue: number } | undefined => {
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) {
    return {
      style: 'arabic',
      raw: trimmed,
      numericValue: Number.parseInt(trimmed, 10)
    }
  }
  if (ROMAN_RE.test(trimmed)) {
    return {
      style: 'roman',
      raw: trimmed.toLowerCase(),
      numericValue: romanToInt(trimmed)
    }
  }
  return undefined
}

export const formatPrintedLabel = (style: 'arabic' | 'roman', numericValue: number): string =>
  style === 'roman' ? intToRoman(numericValue).toLowerCase() : String(numericValue)

export const isPlausibleTocPageRef = (parsed: { style: 'arabic' | 'roman', numericValue: number }): boolean =>
  parsed.numericValue > 0
  && (parsed.style === 'roman'
    ? parsed.numericValue <= MAX_TOC_ROMAN_PAGE
    : parsed.numericValue <= MAX_TOC_ARABIC_PAGE)

export const isPlausibleTocTitle = (value: string): boolean => {
  const trimmed = normalizeInlineWhitespace(value)
  if (trimmed.length === 0 || trimmed.length > MAX_TOC_TITLE_LENGTH) {
    return false
  }
  const alphaChars = countAlphaChars(trimmed)
  if (alphaChars < 3) {
    return false
  }
  const normalized = normalizeTitle(trimmed)
  if (normalized.length === 0) {
    return false
  }
  const tokens = normalized.split(' ').filter(Boolean)
  const longishTokens = tokens.filter((token) => token.length >= 2)
  if (longishTokens.length === 0) {
    return false
  }
  if (tokens.length >= 4 && longishTokens.length < Math.ceil(tokens.length / 2)) {
    return false
  }
  const noisyChars = (trimmed.match(/[^A-Za-z0-9\s'".,&!?;:;\/()\-]/g) ?? []).length
  if (noisyChars > Math.max(4, Math.floor(trimmed.length / 6))) {
    return false
  }
  return true
}

export const isStandaloneTocTitle = (value: string): boolean => {
  if (!isPlausibleTocTitle(value)) {
    return false
  }
  const words = normalizeInlineWhitespace(value).split(/\s+/).filter((word) => /[A-Za-z]/.test(word))
  if (words.length === 0 || words.length > 10) {
    return false
  }
  const strongWords = words.filter((word) =>
    /^[A-Z][A-Za-z'’-]*$/.test(word)
    || /^[A-Z]{2,}[A-Za-z'’-]*$/.test(word)
    || /^[A-Za-z]+[!?]$/.test(word)
  )
  return strongWords.length >= Math.ceil(words.length / 2)
}

export const isLikelyArtifactText = (value: string): boolean =>
  TOC_ARTIFACT_RE.test(normalizeInlineWhitespace(value))

export const isLikelyNoisyTocTitle = (
  value: string,
  options: {
    hasPrintedPage: boolean
    allowUnnumbered?: boolean
  }
): boolean => {
  const normalized = normalizeTitle(value)
  if (normalized.length === 0) {
    return true
  }
  if ([
    'page',
    'pages',
    'chapter',
    'chapters',
    'table of contents',
    'contents'
  ].includes(normalized)) {
    return true
  }
  if (isLikelyFilenameTitle(value) || isLikelyArtifactText(value)) {
    return true
  }

  const wordCount = countWords(value)
  const numericTokens = countNumericTokens(value)
  const commaCount = (value.match(/,/g) ?? []).length

  if (options.hasPrintedPage) {
    if (wordCount > 14) {
      return true
    }
    if (numericTokens >= 3) {
      return true
    }
    if (commaCount >= 2 && numericTokens >= 1) {
      return true
    }
  } else if (!options.allowUnnumbered) {
    return true
  }

  return false
}

export const isCompactNumberedTocTitle = (value: string): boolean =>
  countWords(value) <= 12
  && !isLikelyNoisyTocTitle(value, { hasPrintedPage: true })

export const scoreTitleMatchText = (title: string, candidate: string): number => {
  const normalizedNeedle = normalizeTitle(title)
  const compactNeedle = normalizeCompactTitle(title)
  const normalizedCandidate = normalizeTitle(candidate)
  const compactCandidate = normalizeCompactTitle(candidate)
  if (normalizedNeedle.length === 0 || normalizedCandidate.length === 0) {
    return 0
  }
  if (compactCandidate === compactNeedle) {
    return 3
  }
  if (compactCandidate.includes(compactNeedle) || compactNeedle.includes(compactCandidate)) {
    return 2
  }
  if (normalizedCandidate.includes(normalizedNeedle) || normalizedNeedle.includes(normalizedCandidate)) {
    return 1
  }
  return 0
}

export const scoreTitleMatchAgainstLines = (title: string, lines: string[]): number => {
  let best = 0
  for (const line of lines.slice(0, 12)) {
    const lineScore = scoreTitleMatchText(title, line)
    if (lineScore > 0) {
      best = Math.max(best, lineScore + 2)
    }
  }
  if (best > 0) {
    return best
  }
  return scoreTitleMatchText(title, lines.slice(0, 20).join(' '))
}

export const cleanExportLines = (text: string): string[] => {
  const lines = stripMutoolPageBanner(text)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trimEnd())

  while (lines.length > 0 && lines[0]?.trim().length === 0) {
    lines.shift()
  }
  while (lines.length > 0 && lines[lines.length - 1]?.trim().length === 0) {
    lines.pop()
  }

  if (lines.length > 0 && ISOLATED_LABEL_RE.test(normalizeDecoratedLabel(lines[0] ?? ''))) {
    lines.shift()
  }
  if (lines.length > 0 && ISOLATED_LABEL_RE.test(normalizeDecoratedLabel(lines[lines.length - 1] ?? ''))) {
    lines.pop()
  }

  return lines
}

export const cleanPageTextForExport = (text: string): string =>
  cleanExportLines(text).join('\n').trim()

export const trimPageTextToHeading = (text: string, title: string): string => {
  const lines = cleanExportLines(text)
  const normalizedNeedle = normalizeTitle(title)
  if (normalizedNeedle.length === 0) {
    return lines.join('\n').trim()
  }

  const lineIndex = lines.findIndex((line) => {
    const normalizedLine = normalizeTitle(line)
    return normalizedLine.includes(normalizedNeedle)
      || normalizedNeedle.includes(normalizedLine)
      || scoreTitleMatchText(title, line) > 0
  })

  if (lineIndex <= 0) {
    return lines.join('\n').trim()
  }

  return lines.slice(lineIndex).join('\n').trim()
}

export const buildChapterSlug = (title: string, pdfStartPage: number): string => {
  const slug = sanitizeTitleSlug(title, CHAPTER_SLUG_MAX_LENGTH)
  return slug.length > 0 ? slug : `chapter-${pdfStartPage}`
}

export const excerptPageText = (text: string, maxChars: number): string => {
  const cleaned = cleanPageTextForExport(text).replace(/\n{3,}/g, '\n\n').trim()
  if (cleaned.length <= maxChars) {
    return cleaned
  }
  return `${cleaned.slice(0, maxChars).trimEnd()}...`
}
