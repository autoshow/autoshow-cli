import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as l from '~/logger'
import { showPdfObject, showPdfOutline } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { splitWithHardLimit, type ChapterExportSummary, type TextArtifactFile } from '../epub/export'
import { runLLM } from '~/cli/commands/process-steps/step-3-write/run-llm'
import type { PageResult, TranscriptionResult, VideoMetadata } from '~/types'

const CHAPTER_SLUG_MAX_LENGTH = 60
const ROMAN_RE = /^[ivxlcdm]+$/i
const ISOLATED_LABEL_RE = /^([0-9]+|[ivxlcdm]+)$/i
const TOC_PAGE_TITLE_RE = /^(table of contents|contents)$/i
const INDEX_PAGE_TITLE_RE = /^index$/i
const FILE_EXTENSION_RE = /\.(pdf|epub|docx?|txt|rtf)$/i
const OUTLINE_ARTIFACT_RE = /\b(?:topaz|scan(?:ned)?|enhance(?:d)?|ocr|djvu|archive|text|output|input)\b/i
const ISBNISH_OUTLINE_RE = /\b(?:97[89]\d{10}|[0-9]{9}[0-9x])\b/i
const TOC_ARTIFACT_RE = /\b(?:https?:\/\/|www\.|web\.archive|archive\.org|original page|orignal page|main branch|printing|\d{1,2}\/\d{1,2}\/\d{2,4})\b/i
const MAX_TOC_TITLE_LENGTH = 120
const MAX_TOC_ARABIC_PAGE = 1200
const MAX_TOC_ROMAN_PAGE = 100

type TocScanOptions = {
  allowUnnumbered?: boolean
}

type TocPageAnalysis = {
  pageNumber: number
  hasTocHeading: boolean
  entries: PdfTocEntry[]
  tocLikeCount: number
  isToc: boolean
}

export type PdfChapterMode = 'local' | 'auto' | 'llm'

export type PdfOutlineEntry = {
  title: string
  pdfPage: number
  depth: number
}

export type PdfPageLabelEntry = {
  pageIndex: number
  style: 'arabic' | 'roman'
  prefix?: string
  startAt: number
}

export type PdfPageLabelCandidate = {
  pdfPage: number
  style: 'arabic' | 'roman'
  raw: string
  value: number
  location: 'top' | 'bottom'
}

export type PdfPageMapSpan = {
  style: 'arabic' | 'roman'
  pdfStartPage: number
  pdfEndPage: number
  printedStartPage: string
  printedEndPage: string
  offset: number
  source: 'page-labels' | 'page-text'
}

export type PdfTocEntry = {
  title: string
  printedPage?: string
  style?: 'arabic' | 'roman'
  numericValue?: number
  tocPdfPage: number
}

export type ResolvedPdfChapter = {
  title: string
  pdfStartPage: number
  printedStartPage?: string
  source: string
  confidence: number
}

export type PdfChapterDetectionSummary = {
  mode: PdfChapterMode
  strategyUsed: string
  overallConfidence: number
  warnings: string[]
  tocPages: number[]
  pageMapSpans: PdfPageMapSpan[]
  chapters: ResolvedPdfChapter[]
  llm?: {
    service: string
    model: string
  }
}

export type PdfChapterBuildResult = {
  files?: TextArtifactFile[]
  summary?: ChapterExportSummary
  detection: PdfChapterDetectionSummary
}

const stripMutoolPageBanner = (text: string): string =>
  text.replace(/^page(?:\s+\S+)?\s+\d+\s*\n?/i, '')

const normalizeInlineWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

const normalizeTitle = (value: string): string =>
  normalizeInlineWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeCompactTitle = (value: string): string =>
  normalizeTitle(value).replace(/\s+/g, '')

const extractPageLines = (text: string): string[] =>
  stripMutoolPageBanner(text)
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

const stripLeadingIsolatedLabels = (lines: string[]): string[] => {
  let index = 0
  while (index < lines.length && ISOLATED_LABEL_RE.test(normalizeDecoratedLabel(lines[index] ?? ''))) {
    index += 1
  }
  return lines.slice(index)
}

const getTocCandidateLines = (text: string): string[] =>
  stripLeadingIsolatedLabels(extractPageLines(text))

const countAlphaChars = (value: string): number =>
  (value.match(/[A-Za-z]/g) ?? []).length

const countWords = (value: string): number =>
  normalizeInlineWhitespace(value)
    .split(/\s+/)
    .filter(Boolean)
    .length

const countNumericTokens = (value: string): number =>
  normalizeInlineWhitespace(value).match(/\b\d+\b/g)?.length ?? 0

const isMostlyUppercase = (value: string): boolean => {
  const letters = value.match(/[A-Za-z]/g) ?? []
  if (letters.length < 4) {
    return false
  }
  const uppercase = value.match(/[A-Z]/g) ?? []
  return uppercase.length / letters.length >= 0.65
}

const isLikelyFilenameTitle = (value: string): boolean => {
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

const getOutlineRejectReason = (title: string): string | undefined => {
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

const isPlausibleTocPageRef = (parsed: { style: 'arabic' | 'roman', numericValue: number }): boolean =>
  parsed.numericValue > 0
  && (parsed.style === 'roman'
    ? parsed.numericValue <= MAX_TOC_ROMAN_PAGE
    : parsed.numericValue <= MAX_TOC_ARABIC_PAGE)

const isPlausibleTocTitle = (value: string): boolean => {
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

const isStandaloneTocTitle = (value: string): boolean => {
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

const isLikelyArtifactText = (value: string): boolean =>
  TOC_ARTIFACT_RE.test(normalizeInlineWhitespace(value))

const isLikelyNoisyTocTitle = (
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

const isCompactNumberedTocTitle = (value: string): boolean =>
  countWords(value) <= 12
  && !isLikelyNoisyTocTitle(value, { hasPrintedPage: true })

const scoreTitleMatchText = (title: string, candidate: string): number => {
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

const scoreTitleMatchAgainstLines = (title: string, lines: string[]): number => {
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

const buildTocEntry = (
  title: string,
  tocPdfPage: number,
  parsed?: { style: 'arabic' | 'roman', raw: string, numericValue: number },
  options?: TocScanOptions
): PdfTocEntry | undefined => {
  const normalizedTitle = normalizeInlineWhitespace(title)
  if (!isPlausibleTocTitle(normalizedTitle)) {
    return undefined
  }
  if (isLikelyNoisyTocTitle(normalizedTitle, {
    hasPrintedPage: typeof parsed !== 'undefined',
    ...(options?.allowUnnumbered !== undefined ? { allowUnnumbered: options.allowUnnumbered } : {})
  })) {
    return undefined
  }
  if (!parsed) {
    return {
      title: normalizedTitle,
      tocPdfPage
    }
  }
  if (!isPlausibleTocPageRef(parsed)) {
    return undefined
  }
  return {
    title: normalizedTitle,
    printedPage: parsed.raw,
    style: parsed.style,
    numericValue: parsed.numericValue,
    tocPdfPage
  }
}

const scanTocEntries = (lines: string[], tocPdfPage: number, options?: TocScanOptions): PdfTocEntry[] => {
  const entries: PdfTocEntry[] = []
  let pendingTitle = ''

  for (const rawLine of lines) {
    const line = normalizeInlineWhitespace(rawLine)
    if (line.length === 0) {
      continue
    }
    if (TOC_PAGE_TITLE_RE.test(line)) {
      pendingTitle = ''
      continue
    }
    if (/^(chapter|chapters|page|pages)$/i.test(line)) {
      continue
    }

    const inlineMatch = line.match(/^(.*?)(?:\.{2,}|\s{2,}|\s)\s*([0-9]+|[ivxlcdm]+)\s*$/i)
    if (inlineMatch) {
      const parsed = parsePrintedLabel(inlineMatch[2] ?? '')
      const titlePart = normalizeInlineWhitespace(`${pendingTitle} ${inlineMatch[1] ?? ''}`)
      pendingTitle = ''
      const entry = parsed ? buildTocEntry(titlePart, tocPdfPage, parsed, options) : undefined
      if (entry) {
        entries.push(entry)
      }
      continue
    }

    const isolatedLine = normalizeDecoratedLabel(line)
    const isolatedPageRef = parsePrintedLabel(isolatedLine)
    if (isolatedPageRef && isPlausibleTocPageRef(isolatedPageRef)) {
      if (pendingTitle.length > 0) {
        const entry = buildTocEntry(pendingTitle, tocPdfPage, isolatedPageRef, options)
        if (entry) {
          entries.push(entry)
        }
      }
      pendingTitle = ''
      continue
    }

    if (!isPlausibleTocTitle(line)) {
      pendingTitle = ''
      continue
    }

    if (pendingTitle.length === 0) {
      pendingTitle = line
      continue
    }

    const combinedTitle = normalizeInlineWhitespace(`${pendingTitle} ${line}`)
    if (isStandaloneTocTitle(pendingTitle) && isStandaloneTocTitle(line)) {
      const entry = buildTocEntry(pendingTitle, tocPdfPage, undefined, options)
      if (entry) {
        entries.push(entry)
      }
      pendingTitle = line
      continue
    }

    if (combinedTitle.length <= MAX_TOC_TITLE_LENGTH) {
      pendingTitle = combinedTitle
      continue
    }

    const entry = buildTocEntry(pendingTitle, tocPdfPage, undefined, options)
    if (entry) {
      entries.push(entry)
    }
    pendingTitle = line
  }

  if (pendingTitle.length > 0) {
    const entry = buildTocEntry(pendingTitle, tocPdfPage, undefined, options)
    if (entry) {
      entries.push(entry)
    }
  }

  return entries
}

const romanToInt = (value: string): number => {
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

const intToRoman = (value: number): string => {
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

const parsePrintedLabel = (value: string): { style: 'arabic' | 'roman', raw: string, numericValue: number } | undefined => {
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

const formatPrintedLabel = (style: 'arabic' | 'roman', numericValue: number): string =>
  style === 'roman' ? intToRoman(numericValue).toLowerCase() : String(numericValue)

const normalizeDecoratedLabel = (value: string): string =>
  value.trim().replace(/^[\-\[\]()\s]+|[\-\[\]()\s]+$/g, '')

const cleanExportLines = (text: string): string[] => {
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

const cleanPageTextForExport = (text: string): string =>
  cleanExportLines(text).join('\n').trim()

const trimPageTextToHeading = (text: string, title: string): string => {
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

const buildChapterSlug = (title: string, pdfStartPage: number): string => {
  const slug = sanitizeTitleSlug(title, CHAPTER_SLUG_MAX_LENGTH)
  return slug.length > 0 ? slug : `chapter-${pdfStartPage}`
}

const excerptPageText = (text: string, maxChars: number): string => {
  const cleaned = cleanPageTextForExport(text).replace(/\n{3,}/g, '\n\n').trim()
  if (cleaned.length <= maxChars) {
    return cleaned
  }
  return `${cleaned.slice(0, maxChars).trimEnd()}...`
}

export const parsePdfOutline = (raw: string): PdfOutlineEntry[] => {
  const entries: PdfOutlineEntry[] = []
  const lines = raw.split('\n')
  for (const line of lines) {
    const match = line.match(/^([^\"]*)\"([^\"]*)\"\s+#page=(\d+)/)
    if (!match) {
      continue
    }
    const prefix = match[1] ?? ''
    const title = (match[2] ?? '').trim()
    const pdfPage = Number.parseInt(match[3] ?? '0', 10)
    if (!title || !Number.isFinite(pdfPage) || pdfPage < 1) {
      continue
    }
    const depth = (prefix.match(/\t/g) ?? []).length
    entries.push({ title, pdfPage, depth })
  }
  return entries
}

export const parsePdfPageLabels = (raw: string): PdfPageLabelEntry[] => {
  const entries: PdfPageLabelEntry[] = []
  const normalized = raw.replace(/\s+/g, ' ')
  const regex = /(\d+)\s*<</g
  let match: RegExpExecArray | null

  while ((match = regex.exec(normalized)) !== null) {
    const pageIndex = Number.parseInt(match[1] ?? '0', 10)
    const start = match.index + match[0].length - 2
    const tail = normalized.slice(start)
    const objectMatch = tail.match(/^<<([^>]+)>>/)
    if (!objectMatch) {
      continue
    }
    const objectText = objectMatch[1] ?? ''
    const styleCode = objectText.match(/\/S\s*\/([DRr])/i)?.[1]
    const prefix = objectText.match(/\/P\s*\(([^)]*)\)/)?.[1]
    const startAt = Number.parseInt(objectText.match(/\/St\s+(\d+)/)?.[1] ?? '1', 10)
    if (!Number.isFinite(pageIndex) || pageIndex < 0 || !styleCode) {
      continue
    }
    const style = styleCode.toLowerCase() === 'd' ? 'arabic' : 'roman'
    entries.push({
      pageIndex,
      style,
      ...(typeof prefix === 'string' && prefix.length > 0 ? { prefix } : {}),
      startAt: Number.isFinite(startAt) && startAt > 0 ? startAt : 1
    })
  }

  return entries.sort((a, b) => a.pageIndex - b.pageIndex)
}

const buildPageLabelSpans = (
  entries: PdfPageLabelEntry[],
  totalPages: number
): PdfPageMapSpan[] =>
  entries.map((entry, index) => {
    const next = entries[index + 1]
    const pdfStartPage = entry.pageIndex + 1
    const pdfEndPage = Math.max(pdfStartPage, (next?.pageIndex ?? totalPages) || totalPages)
    const printedStartPage = `${entry.prefix ?? ''}${formatPrintedLabel(entry.style, entry.startAt)}`
    const printedEndValue = entry.startAt + Math.max(0, pdfEndPage - pdfStartPage)
    const printedEndPage = `${entry.prefix ?? ''}${formatPrintedLabel(entry.style, printedEndValue)}`
    return {
      style: entry.style,
      pdfStartPage,
      pdfEndPage,
      printedStartPage,
      printedEndPage,
      offset: pdfStartPage - entry.startAt,
      source: 'page-labels'
    }
  })

const canMergePageMapSpans = (previous: PdfPageMapSpan, current: PdfPageMapSpan): boolean => {
  if (previous.style !== current.style || previous.offset !== current.offset) {
    return false
  }
  const previousPrinted = parsePrintedLabel(previous.printedEndPage)
  const currentPrinted = parsePrintedLabel(current.printedStartPage)
  if (!previousPrinted || !currentPrinted || previousPrinted.style !== currentPrinted.style) {
    return false
  }
  const gapPages = current.pdfStartPage - previous.pdfEndPage - 1
  if (gapPages < 0) {
    return false
  }
  return previousPrinted.numericValue + gapPages + 1 === currentPrinted.numericValue
}

export const mergePageMapSpans = (spans: PdfPageMapSpan[]): PdfPageMapSpan[] => {
  const merged: PdfPageMapSpan[] = []
  for (const span of [...spans].sort((a, b) => a.pdfStartPage - b.pdfStartPage)) {
    const previous = merged[merged.length - 1]
    if (previous && canMergePageMapSpans(previous, span)) {
      previous.pdfEndPage = Math.max(previous.pdfEndPage, span.pdfEndPage)
      previous.printedEndPage = span.printedEndPage
      previous.source = previous.source === 'page-labels' || span.source === 'page-labels'
        ? 'page-labels'
        : 'page-text'
      continue
    }
    merged.push({ ...span })
  }
  return merged
}

const extractIsolatedPageLabel = (lines: string[]): { raw: string, value: number, style: 'arabic' | 'roman' } | undefined => {
  for (const line of lines) {
    const trimmed = normalizeDecoratedLabel(line)
    if (!ISOLATED_LABEL_RE.test(trimmed)) {
      continue
    }
    const parsed = parsePrintedLabel(trimmed)
    if (parsed && parsed.numericValue > 0) {
      return {
        raw: parsed.raw,
        value: parsed.numericValue,
        style: parsed.style
      }
    }
  }
  return undefined
}

export const extractPrintedPageCandidates = (pages: PageResult[]): PdfPageLabelCandidate[] => {
  const candidates: PdfPageLabelCandidate[] = []
  for (const page of pages) {
    const lines = stripMutoolPageBanner(page.text)
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    const top = extractIsolatedPageLabel(lines.slice(0, 4))
    if (top) {
      candidates.push({
        pdfPage: page.pageNumber,
        style: top.style,
        raw: top.raw,
        value: top.value,
        location: 'top'
      })
    }
    const bottom = extractIsolatedPageLabel(lines.slice(-4))
    if (bottom && (!top || bottom.raw !== top.raw || bottom.style !== top.style || bottom.value !== top.value)) {
      candidates.push({
        pdfPage: page.pageNumber,
        style: bottom.style,
        raw: bottom.raw,
        value: bottom.value,
        location: 'bottom'
      })
    }
  }
  return candidates
}

export const buildTextPageMapSpans = (
  candidates: PdfPageLabelCandidate[],
  totalPages: number
): PdfPageMapSpan[] => {
  const spans: PdfPageMapSpan[] = []
  const grouped = new Map<string, PdfPageLabelCandidate[]>()
  for (const candidate of candidates) {
    const key = `${candidate.style}:${candidate.location}`
    const list = grouped.get(key) ?? []
    list.push(candidate)
    grouped.set(key, list)
  }

  for (const group of grouped.values()) {
    const ordered = [...group].sort((a, b) => a.pdfPage - b.pdfPage)
    let runStart = 0
    for (let index = 1; index <= ordered.length; index++) {
      const previous = ordered[index - 1]
      const current = ordered[index]
      const consecutive = previous && current
        ? current.pdfPage === previous.pdfPage + 1 && current.value === previous.value + 1
        : false

      if (consecutive) {
        continue
      }

      const run = ordered.slice(runStart, index)
      runStart = index
      if (run.length < 2) {
        continue
      }

      const first = run[0]
      const last = run[run.length - 1]
      if (!first || !last) {
        continue
      }

      spans.push({
        style: first.style,
        pdfStartPage: first.pdfPage,
        pdfEndPage: Math.min(totalPages, last.pdfPage),
        printedStartPage: first.raw,
        printedEndPage: last.raw,
        offset: first.pdfPage - first.value,
        source: 'page-text'
      })
    }
  }

  return mergePageMapSpans(spans)
}

const isTocLikeLine = (line: string): boolean =>
  /(?:\.{2,}|\s{2,})([0-9]+|[ivxlcdm]+)\s*$/i.test(line) || /^.+\s+([0-9]+|[ivxlcdm]+)\s*$/i.test(line)

const isLikelyIndexEntryLine = (line: string): boolean => {
  const normalized = normalizeInlineWhitespace(line)
  if (normalized.length === 0 || countWords(normalized) > 18) {
    return false
  }
  const inlineRefs = normalized.match(/,\s*\d+(?:\s*-\s*\d+)?/g) ?? []
  if (inlineRefs.length === 0) {
    return false
  }
  return /^[A-Za-z][A-Za-z'’(). -]{0,48},/.test(normalized) || inlineRefs.length >= 2
}

const isLikelyIndexPage = (lines: string[]): boolean => {
  const scanLines = lines.slice(0, 40)
  const headingInTopLines = lines.slice(0, 6).some((line) => INDEX_PAGE_TITLE_RE.test(line))
  const dividerCount = scanLines.filter((line) => /^-\s*[A-Za-z]\s*-$/.test(normalizeInlineWhitespace(line))).length
  const indexEntryCount = scanLines.filter(isLikelyIndexEntryLine).length
  if (headingInTopLines) {
    return indexEntryCount >= 2
  }
  return indexEntryCount >= 8 || (dividerCount >= 1 && indexEntryCount >= 4)
}

const isLikelyArtifactPage = (lines: string[]): boolean => {
  const scanLines = lines.slice(0, 12)
  const artifactLines = scanLines.filter(isLikelyArtifactText)
  return artifactLines.length >= 2 || (artifactLines.length >= 1 && scanLines.some((line) => /\b(?:printing|main branch)\b/i.test(line)))
}

const analyzeTocPage = (page: PageResult): TocPageAnalysis => {
  const lines = getTocCandidateLines(page.text)
  if (lines.length === 0) {
    return {
      pageNumber: page.pageNumber,
      hasTocHeading: false,
      entries: [],
      tocLikeCount: 0,
      isToc: false
    }
  }
  const hasTocHeading = lines.slice(0, 24).some((line) => TOC_PAGE_TITLE_RE.test(line))
  if (isLikelyIndexPage(lines) || isLikelyArtifactPage(lines)) {
    return {
      pageNumber: page.pageNumber,
      hasTocHeading,
      entries: [],
      tocLikeCount: 0,
      isToc: false
    }
  }
  const entries = scanTocEntries(lines, page.pageNumber, { allowUnnumbered: hasTocHeading })
  const numberedEntries = entries.filter((entry) => typeof entry.printedPage === 'string')
  const tocLikeCount = lines.filter(isTocLikeLine).length
  const compactNumberedEntries = numberedEntries.filter((entry) => isCompactNumberedTocTitle(entry.title))
  const isToc = hasTocHeading
    ? entries.length >= 2
    : numberedEntries.length >= 3 && compactNumberedEntries.length >= 3 && tocLikeCount >= 3

  return {
    pageNumber: page.pageNumber,
    hasTocHeading,
    entries,
    tocLikeCount,
    isToc
  }
}

export const isTocPage = (page: PageResult): boolean => {
  return analyzeTocPage(page).isToc
}

export const parseTocEntriesFromPage = (page: PageResult): PdfTocEntry[] => {
  const analysis = analyzeTocPage(page)
  return analysis.isToc ? analysis.entries : []
}

const mapPrintedToPdfPage = (
  printedPage: string | undefined,
  spans: PdfPageMapSpan[],
  totalPages: number
): number | undefined => {
  if (typeof printedPage !== 'string') {
    return undefined
  }
  const parsed = parsePrintedLabel(printedPage)
  if (!parsed) {
    return undefined
  }

  for (const span of spans) {
    if (span.style !== parsed.style) {
      continue
    }

    const pdfPage = parsed.numericValue + span.offset
    if (pdfPage < span.pdfStartPage || pdfPage > span.pdfEndPage) {
      continue
    }
    if (pdfPage >= 1 && pdfPage <= totalPages) {
      return pdfPage
    }
  }

  return undefined
}

const buildOutlineCandidates = (
  rawEntries: PdfOutlineEntry[],
  pages: PageResult[]
): { chapters: ResolvedPdfChapter[], rejectedTitles: string[] } => {
  const byPage = new Map<number, PdfOutlineEntry[]>()
  const rejectedTitles: string[] = []
  for (const entry of rawEntries) {
    const rejectReason = getOutlineRejectReason(entry.title)
    if (rejectReason) {
      rejectedTitles.push(`${entry.title} (${rejectReason})`)
      continue
    }
    const list = byPage.get(entry.pdfPage) ?? []
    list.push(entry)
    byPage.set(entry.pdfPage, list)
  }

  const chapters: ResolvedPdfChapter[] = []
  for (const [, entries] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    const chosen = [...entries].sort((a, b) =>
      a.depth - b.depth || b.title.length - a.title.length
    )[0]
    if (!chosen) {
      continue
    }
    const anchoredPage = findDetectedHeadingAnchorPage(chosen.title, chosen.pdfPage, pages, { radius: 6 })
      ?? findTitleAnchorPage(chosen.title, chosen.pdfPage, pages, { radius: 6 })
    const resolvedPage = anchoredPage ?? chosen.pdfPage
    const confidence = anchoredPage
      ? (anchoredPage === chosen.pdfPage ? 0.84 : 0.78)
      : (resolvedPage <= 5 ? 0.34 : 0.58)
    chapters.push({
      title: chosen.title,
      pdfStartPage: resolvedPage,
      source: anchoredPage
        ? (anchoredPage === chosen.pdfPage ? 'outline+anchor' : 'outline+retarget')
        : 'outline',
      confidence
    })
  }

  return { chapters, rejectedTitles }
}

const buildAnchorCandidatePages = (
  predictedPage: number | undefined,
  pages: PageResult[],
  options?: {
    radius?: number
    allowGlobal?: boolean
  }
): number[] => {
  const candidatePages: number[] = []
  const seen = new Set<number>()
  const radius = options?.radius ?? 2
  if (typeof predictedPage === 'number' && Number.isFinite(predictedPage)) {
    for (let delta = 0; delta <= radius; delta++) {
      for (const candidatePage of [predictedPage - delta, predictedPage + delta]) {
        if (seen.has(candidatePage)) {
          continue
        }
        seen.add(candidatePage)
        candidatePages.push(candidatePage)
      }
    }
  }
  if (options?.allowGlobal || candidatePages.length === 0) {
    for (const page of pages) {
      if (seen.has(page.pageNumber)) {
        continue
      }
      seen.add(page.pageNumber)
      candidatePages.push(page.pageNumber)
    }
  }

  return candidatePages
}

const findDetectedHeadingAnchorPage = (
  title: string,
  predictedPage: number | undefined,
  pages: PageResult[],
  options?: {
    radius?: number
    allowGlobal?: boolean
  }
): number | undefined => {
  const normalizedNeedle = normalizeTitle(title)
  if (normalizedNeedle.length === 0) {
    return predictedPage
  }
  const pageLookup = new Map(pages.map((page) => [page.pageNumber, page]))
  const candidatePages = buildAnchorCandidatePages(predictedPage, pages, options)

  let bestMatch: { pageNumber: number, score: number, distance: number } | undefined
  for (const candidatePage of candidatePages) {
    const page = pageLookup.get(candidatePage)
    if (!page) {
      continue
    }
    const heading = detectHeadingTitle(page)
    if (!heading) {
      continue
    }
    const headingScore = scoreTitleMatchText(title, heading)
    if (headingScore <= 0) {
      continue
    }
    const score = headingScore + 4
    const distance = typeof predictedPage === 'number' && Number.isFinite(predictedPage)
      ? Math.abs(candidatePage - predictedPage)
      : candidatePage
    if (!bestMatch
      || score > bestMatch.score
      || (score === bestMatch.score && distance < bestMatch.distance)
      || (score === bestMatch.score && distance === bestMatch.distance && candidatePage < bestMatch.pageNumber)) {
      bestMatch = { pageNumber: candidatePage, score, distance }
    }
  }

  return bestMatch?.pageNumber
}

const findTitleAnchorPage = (
  title: string,
  predictedPage: number | undefined,
  pages: PageResult[],
  options?: {
    radius?: number
    allowGlobal?: boolean
  }
): number | undefined => {
  const normalizedNeedle = normalizeTitle(title)
  if (normalizedNeedle.length === 0) {
    return predictedPage
  }
  const pageLookup = new Map(pages.map((page) => [page.pageNumber, page]))
  const candidatePages = buildAnchorCandidatePages(predictedPage, pages, options)

  let bestMatch: { pageNumber: number, score: number, distance: number } | undefined
  for (const candidatePage of candidatePages) {
    const page = pageLookup.get(candidatePage)
    if (!page) {
      continue
    }
    const score = scoreTitleMatchAgainstLines(title, cleanExportLines(page.text))
    if (score <= 0) {
      continue
    }
    const distance = typeof predictedPage === 'number' && Number.isFinite(predictedPage)
      ? Math.abs(candidatePage - predictedPage)
      : candidatePage
    if (!bestMatch
      || score > bestMatch.score
      || (score === bestMatch.score && distance < bestMatch.distance)
      || (score === bestMatch.score && distance === bestMatch.distance && candidatePage < bestMatch.pageNumber)) {
      bestMatch = { pageNumber: candidatePage, score, distance }
    }
  }

  return bestMatch?.pageNumber
}

const buildTocCandidates = (
  tocEntries: PdfTocEntry[],
  pageMapSpans: PdfPageMapSpan[],
  pages: PageResult[]
): ResolvedPdfChapter[] => {
  const totalPages = pages.length > 0 ? Math.max(...pages.map((page) => page.pageNumber)) : 0
  const resolved: ResolvedPdfChapter[] = []
  const seenPages = new Set<number>()

  for (const entry of tocEntries) {
    const mappedPage = mapPrintedToPdfPage(entry.printedPage, pageMapSpans, totalPages)
    const nearbyAnchor = typeof mappedPage === 'number'
      ? findDetectedHeadingAnchorPage(entry.title, mappedPage, pages, { radius: 10 })
        ?? findTitleAnchorPage(entry.title, mappedPage, pages, { radius: 10 })
      : undefined
    const titleSearchPage = findDetectedHeadingAnchorPage(entry.title, mappedPage, pages, {
      radius: 10,
      allowGlobal: true
    })
    const resolvedPage = nearbyAnchor ?? mappedPage ?? titleSearchPage
    if (!resolvedPage || seenPages.has(resolvedPage)) {
      continue
    }
    seenPages.add(resolvedPage)
    const hasPrintedPage = typeof entry.printedPage === 'string'
    const source = nearbyAnchor
      ? (nearbyAnchor === mappedPage ? 'toc-page-map+anchor' : 'toc-page-map+retarget')
      : mappedPage
        ? 'toc-page-map'
        : titleSearchPage
          ? 'toc-title-search'
          : 'toc'
    const confidence = nearbyAnchor
      ? (nearbyAnchor === mappedPage ? 0.84 : 0.88)
      : mappedPage
        ? 0.76
        : hasPrintedPage
          ? 0.74
          : 0.81
    resolved.push({
      title: entry.title,
      pdfStartPage: resolvedPage,
      ...(entry.printedPage ? { printedStartPage: entry.printedPage } : {}),
      source,
      confidence
    })
  }

  return resolved.sort((a, b) => a.pdfStartPage - b.pdfStartPage)
}

const detectHeadingTitle = (page: PageResult): string | undefined => {
  const lines = cleanExportLines(page.text).map((line) => line.trim()).filter((line) => line.length > 0)
  const topLines = lines.slice(0, 12)
  const first = topLines[0]
  const second = topLines[1]
  const third = topLines[2]

  if (first && /^(acknowledg(?:e)?ment|prologue|epilogue|introduction|foreword|preface|appendix|footnotes?|selected bibliography|bibliography|index)\b/i.test(first)) {
    return first
  }
  for (const line of topLines) {
    if (countWords(line) <= 4 && /^(acknowledg(?:e)?ment|prologue|epilogue|introduction|foreword|preface|appendix|footnotes?|selected bibliography|bibliography|index)\b/i.test(line)) {
      return line
    }
  }
  if (first && ROMAN_RE.test(normalizeDecoratedLabel(first)) && second && isPlausibleTocTitle(second) && isMostlyUppercase(second)) {
    return second
  }
  if (first && /^\d+$/.test(normalizeDecoratedLabel(first)) && second && ROMAN_RE.test(normalizeDecoratedLabel(second)) && third && isPlausibleTocTitle(third) && isMostlyUppercase(third)) {
    return third
  }
  if (first && /^\d+$/.test(normalizeDecoratedLabel(first)) && second && isPlausibleTocTitle(second) && isMostlyUppercase(second)) {
    return second
  }

  for (const line of topLines) {
    if (/^(chapter|chap\.|part|book|section)\s+([0-9ivxlcdm]+)\b/i.test(line)) {
      const lineIndex = topLines.indexOf(line)
      const next = topLines[lineIndex + 1]
      if (next && isPlausibleTocTitle(next) && isMostlyUppercase(next)) {
        return next
      }
      return line
    }
    if (/^(prologue|epilogue|introduction|foreword|preface|appendix)\b/i.test(line)) {
      return line
    }
  }

  if (first && isPlausibleTocTitle(first) && isMostlyUppercase(first)) {
    return first
  }

  return undefined
}

const buildHeadingCandidates = (
  pages: PageResult[]
): ResolvedPdfChapter[] => {
  const chapters: ResolvedPdfChapter[] = []
  for (const page of pages) {
    const heading = detectHeadingTitle(page)
    if (!heading) {
      continue
    }
    chapters.push({
      title: heading,
      pdfStartPage: page.pageNumber,
      source: 'heading',
      confidence: 0.58
    })
  }
  return chapters
}

const dedupeResolvedChapters = (chapters: ResolvedPdfChapter[]): ResolvedPdfChapter[] => {
  const deduped: ResolvedPdfChapter[] = []
  const seenPages = new Set<number>()
  for (const chapter of [...chapters].sort((a, b) =>
    a.pdfStartPage - b.pdfStartPage
    || b.confidence - a.confidence
    || b.title.length - a.title.length
  )) {
    if (seenPages.has(chapter.pdfStartPage)) {
      continue
    }
    seenPages.add(chapter.pdfStartPage)
    deduped.push(chapter)
  }
  return deduped
}

const inferStrategyUsed = (strategyName: 'outline' | 'toc' | 'heading', chapters: ResolvedPdfChapter[]): string => {
  if (chapters.length === 0) {
    return 'none'
  }
  if (strategyName === 'toc') {
    const usedTitleSearch = chapters.some((chapter) => chapter.source.includes('title-search') || chapter.source.includes('retarget') || chapter.source.includes('anchor'))
    return usedTitleSearch ? 'toc+title-search' : 'toc-page-map'
  }
  return strategyName
}

const scoreChapterStrategy = (
  chapters: ResolvedPdfChapter[],
  totalPages: number,
  strategyName: 'outline' | 'toc' | 'heading'
): number => {
  if (chapters.length === 0) {
    return 0
  }
  const averageConfidence = scoreOverallConfidence(chapters)
  const countScore = chapters.length <= 1 ? 0.15 : Math.min(chapters.length / 8, 1)
  const spanPages = chapters.length > 1
    ? chapters[chapters.length - 1]!.pdfStartPage - chapters[0]!.pdfStartPage
    : 0
  const spreadScore = totalPages > 1 ? Math.min(spanPages / Math.max(totalPages * 0.65, 1), 1) : 0
  const gaps = chapters.slice(1).map((chapter, index) => chapter.pdfStartPage - chapters[index]!.pdfStartPage)
  const tightGapRatio = gaps.length > 0
    ? gaps.filter((gap) => gap <= 3).length / gaps.length
    : 0
  const chapterDensity = chapters.length / Math.max(totalPages, 1)
  const frontMatterOnlyPenalty = chapters.length <= 2 && chapters.every((chapter) => chapter.pdfStartPage <= Math.max(10, Math.ceil(totalPages * 0.05)))
    ? 0.45
    : 0
  const denseGapPenalty = tightGapRatio > 0.4 ? Math.min((tightGapRatio - 0.4) * 0.9, 0.32) : 0
  const chapterDensityPenalty = chapterDensity > 0.06 ? Math.min((chapterDensity - 0.06) * 1.6, 0.26) : 0
  const strategyBonus = strategyName === 'toc'
    ? 0.06
    : strategyName === 'heading'
      ? -0.02
      : 0
  return averageConfidence * 0.55
    + countScore * 0.25
    + spreadScore * 0.2
    + strategyBonus
    - frontMatterOnlyPenalty
    - denseGapPenalty
    - chapterDensityPenalty
}

const selectPrimaryTocAnalyses = (
  analyses: TocPageAnalysis[],
  totalPages: number
): TocPageAnalysis[] => {
  if (analyses.length <= 1) {
    return analyses
  }

  const ordered = [...analyses].sort((a, b) => a.pageNumber - b.pageNumber)
  const clusters: TocPageAnalysis[][] = []
  let currentCluster: TocPageAnalysis[] = []

  for (const analysis of ordered) {
    const previous = currentCluster[currentCluster.length - 1]
    if (previous && analysis.pageNumber - previous.pageNumber > 2) {
      clusters.push(currentCluster)
      currentCluster = []
    }
    currentCluster.push(analysis)
  }

  if (currentCluster.length > 0) {
    clusters.push(currentCluster)
  }

  const frontMatterLimit = Math.max(20, Math.ceil(totalPages * 0.18))
  const frontMatterClusters = clusters.filter((cluster) => (cluster[0]?.pageNumber ?? Number.POSITIVE_INFINITY) <= frontMatterLimit)
  const clusterPool = frontMatterClusters.length > 0 ? frontMatterClusters : clusters

  return clusterPool.find((cluster) => cluster.some((analysis) => analysis.hasTocHeading))
    ?? clusterPool[0]
    ?? []
}

export const resolveLocalPdfChapterDetection = (input: {
  pages: PageResult[]
  outlineEntries?: PdfOutlineEntry[]
  labelEntries?: PdfPageLabelEntry[]
}): {
  chapters: ResolvedPdfChapter[]
  pageMapSpans: PdfPageMapSpan[]
  tocPages: number[]
  warnings: string[]
  strategyUsed: string
} => {
  const warnings: string[] = []
  const totalPages = input.pages.length > 0 ? Math.max(...input.pages.map((page) => page.pageNumber)) : 0
  const pageTextCandidates = extractPrintedPageCandidates(input.pages)
  const pageMapSpans = mergePageMapSpans([
    ...buildPageLabelSpans(input.labelEntries ?? [], totalPages),
    ...buildTextPageMapSpans(pageTextCandidates, totalPages)
  ])

  const rawTocAnalyses = input.pages.map(analyzeTocPage).filter((analysis) => analysis.isToc)
  const selectedTocAnalyses = selectPrimaryTocAnalyses(rawTocAnalyses, totalPages)
  const tocPages = selectedTocAnalyses.map((analysis) => analysis.pageNumber)
  const tocEntries = selectedTocAnalyses.flatMap((analysis) => analysis.entries)
  const droppedTocPages = rawTocAnalyses
    .map((analysis) => analysis.pageNumber)
    .filter((pageNumber) => !tocPages.includes(pageNumber))
  if (droppedTocPages.length > 0) {
    warnings.push(`Ignored ${droppedTocPages.length} TOC-like PDF page${droppedTocPages.length === 1 ? '' : 's'} outside the primary front-matter cluster.`)
  }

  const outlineResult = buildOutlineCandidates(input.outlineEntries ?? [], input.pages)
  if (outlineResult.rejectedTitles.length > 0) {
    warnings.push(`Ignored ${outlineResult.rejectedTitles.length} low-quality PDF outline entr${outlineResult.rejectedTitles.length === 1 ? 'y' : 'ies'} while resolving chapters.`)
  }

  const outlineCandidates = dedupeResolvedChapters(outlineResult.chapters)
  const tocCandidates = dedupeResolvedChapters(buildTocCandidates(tocEntries, pageMapSpans, input.pages))
  const headingCandidates = dedupeResolvedChapters(buildHeadingCandidates(input.pages))

  const strategyOptions = [
    {
      name: 'outline' as const,
      chapters: outlineCandidates
    },
    {
      name: 'toc' as const,
      chapters: tocCandidates
    },
    {
      name: 'heading' as const,
      chapters: headingCandidates
    }
  ].map((option) => ({
    ...option,
    score: scoreChapterStrategy(option.chapters, totalPages, option.name),
    strategyUsed: inferStrategyUsed(option.name, option.chapters)
  }))

  const chosen = strategyOptions.sort((a, b) =>
    b.score - a.score
    || b.chapters.length - a.chapters.length
    || (b.name === 'toc' ? 1 : 0) - (a.name === 'toc' ? 1 : 0)
  )[0]

  return {
    chapters: chosen?.chapters ?? [],
    pageMapSpans,
    tocPages,
    warnings,
    strategyUsed: chosen?.strategyUsed ?? 'none'
  }
}

const buildPdfChapterFiles = (
  pages: PageResult[],
  chapters: ResolvedPdfChapter[],
  chunkLimitChars?: number
): TextArtifactFile[] => {
  const files: TextArtifactFile[] = []

  for (let index = 0; index < chapters.length; index++) {
    const chapter = chapters[index]
    if (!chapter) {
      continue
    }
    const next = chapters[index + 1]
    const pageRange = pages.filter((page) =>
      page.pageNumber >= chapter.pdfStartPage && page.pageNumber < (next?.pdfStartPage ?? Number.POSITIVE_INFINITY)
    )
    if (pageRange.length === 0) {
      continue
    }

    const text = pageRange
      .map((page, pageIndex) =>
        pageIndex === 0 ? trimPageTextToHeading(page.text, chapter.title) : cleanPageTextForExport(page.text)
      )
      .filter((value) => value.length > 0)
      .join('\n\n')
      .trim()

    if (text.length === 0) {
      continue
    }

    const baseName = `${String(chapter.pdfStartPage).padStart(3, '0')}-${buildChapterSlug(chapter.title, chapter.pdfStartPage)}`
    const parts = typeof chunkLimitChars === 'number'
      ? splitWithHardLimit(text, chunkLimitChars)
      : [text]

    if (parts.length <= 1) {
      const only = parts[0]
      if (typeof only === 'string' && only.length > 0) {
        files.push({
          relativePath: `chapters/${baseName}.txt`,
          text: only
        })
      }
      continue
    }

    for (let partIndex = 0; partIndex < parts.length; partIndex++) {
      const part = parts[partIndex]
      if (!part) {
        continue
      }
      files.push({
        relativePath: `chapters/${baseName}-part-${String(partIndex + 1).padStart(3, '0')}.txt`,
        text: part
      })
    }
  }

  return files
}

const scoreOverallConfidence = (chapters: ResolvedPdfChapter[]): number => {
  if (chapters.length === 0) {
    return 0
  }
  return chapters.reduce((sum, chapter) => sum + chapter.confidence, 0) / chapters.length
}

const selectPagesForLlmDossier = (
  pages: PageResult[],
  tocPages: number[],
  localCandidates: ResolvedPdfChapter[]
): Array<{ pdfPage: number, excerpt: string }> => {
  const selected = new Set<number>()
  for (const tocPage of tocPages.slice(0, 4)) {
    selected.add(tocPage)
  }
  for (const chapter of localCandidates.slice(0, 20)) {
    selected.add(chapter.pdfStartPage)
  }
  for (let pageNumber = 1; pageNumber <= Math.min(10, pages.length); pageNumber++) {
    selected.add(pageNumber)
  }

  return [...selected]
    .sort((a, b) => a - b)
    .map((pdfPage) => ({
      pdfPage,
      excerpt: excerptPageText(pages.find((page) => page.pageNumber === pdfPage)?.text ?? '', 1200)
    }))
    .filter((entry) => entry.excerpt.length > 0)
}

const buildPdfChapterPrompt = (
  instruction: string,
  dossier: Record<string, unknown>
): string => `${instruction}

Use the dossier below to resolve major PDF chapter starts. Return JSON only.

PDF chapter dossier:
${JSON.stringify(dossier, null, 2)}`

const buildLlmOptions = (
  service: string,
  model: string,
  outputDir: string,
  promptBuilder: (instruction: string) => string
): Parameters<typeof runLLM>[2] => ({
  outputDir,
  prompts: ['pdfChapterBoundaries'],
  promptBuilder,
  ...(service === 'openai' ? { openaiModel: model } : {}),
  ...(service === 'groq' ? { groqModel: model } : {}),
  ...(service === 'gemini' ? { geminiModel: model } : {}),
  ...(service === 'anthropic' ? { anthropicModel: model } : {}),
  ...(service === 'minimax' ? { minimaxModel: model } : {}),
  ...(service === 'grok' ? { grokModel: model } : {}),
  ...(service === 'llama.cpp' ? { llamaModel: model } : {})
})

const resolveLlmCandidates = async (input: {
  title?: string
  author?: string
  pages: PageResult[]
  tocPages: number[]
  tocEntries: PdfTocEntry[]
  pageMapSpans: PdfPageMapSpan[]
  localCandidates: ResolvedPdfChapter[]
  llmService: string
  llmModel: string
}): Promise<ResolvedPdfChapter[] | undefined> => {
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-pdf-chapters-llm-'))
  try {
    const metadata: VideoMetadata = {
      title: input.title ?? 'Document',
      duration: `${input.pages.length} pages`,
      author: input.author ?? 'Unknown',
      description: 'PDF chapter boundary resolution',
      url: 'file://pdf-chapter-detection.local'
    }
    const transcription: TranscriptionResult = {
      text: '',
      segments: []
    }

    const dossier = {
      title: input.title,
      author: input.author,
      totalPages: input.pages.length,
      localCandidates: input.localCandidates.slice(0, 40),
      tocPages: input.tocPages,
      tocEntries: input.tocEntries.slice(0, 80),
      pageMapSpans: input.pageMapSpans,
      pageSnippets: selectPagesForLlmDossier(input.pages, input.tocPages, input.localCandidates)
    }

    const options = buildLlmOptions(
      input.llmService,
      input.llmModel,
      tempDir,
      (instruction) => buildPdfChapterPrompt(instruction, dossier)
    )
    const results = await runLLM(metadata, transcription, options)
    const parsed = results[0]?.parsedJson as { chapters?: Array<Record<string, unknown>> } | undefined
    const chapters = parsed?.chapters
    if (!Array.isArray(chapters)) {
      return undefined
    }

    const resolved: ResolvedPdfChapter[] = []
    for (const chapter of chapters) {
      const title = typeof chapter['title'] === 'string' ? chapter['title'].trim() : ''
      const pdfStartPage = typeof chapter['pdfStartPage'] === 'number' ? Math.trunc(chapter['pdfStartPage']) : NaN
      const printedStartPage = typeof chapter['printedStartPage'] === 'string' ? chapter['printedStartPage'].trim() : undefined
      const confidenceValue = typeof chapter['confidence'] === 'string' ? chapter['confidence'].trim().toLowerCase() : 'medium'
      if (!title || !Number.isFinite(pdfStartPage) || pdfStartPage < 1) {
        continue
      }
      resolved.push({
        title,
        pdfStartPage: findDetectedHeadingAnchorPage(title, pdfStartPage, input.pages, {
          radius: 10,
          allowGlobal: true
        }) ?? findTitleAnchorPage(title, pdfStartPage, input.pages, { radius: 10 }) ?? pdfStartPage,
        ...(printedStartPage ? { printedStartPage } : {}),
        source: 'llm',
        confidence: confidenceValue === 'high' ? 0.88 : confidenceValue === 'low' ? 0.55 : 0.72
      })
    }

    return dedupeResolvedChapters(resolved)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export const buildPdfChapterArtifacts = async (input: {
  filePath: string
  pages: PageResult[]
  title?: string
  author?: string
  password?: string
  mode: PdfChapterMode
  chunkLimitChars?: number
  llmService?: string
  llmModel?: string
}): Promise<PdfChapterBuildResult> => {
  const totalPages = input.pages.length > 0 ? Math.max(...input.pages.map((page) => page.pageNumber)) : 0

  let outlineEntries: PdfOutlineEntry[] = []
  const outlineResult = await showPdfOutline(input.filePath, input.password)
  if (outlineResult.exitCode === 0) {
    outlineEntries = parsePdfOutline(outlineResult.stdout)
  }

  let labelEntries: PdfPageLabelEntry[] = []
  const pageLabelsResult = await showPdfObject(input.filePath, 'trailer/Root/PageLabels', input.password)
  if (pageLabelsResult.exitCode === 0 && pageLabelsResult.stdout.trim() !== 'null') {
    labelEntries = parsePdfPageLabels(pageLabelsResult.stdout)
  }

  const localDetection = resolveLocalPdfChapterDetection({
    pages: input.pages,
    outlineEntries,
    labelEntries
  })
  const warnings = [...localDetection.warnings]
  const tocEntries = input.pages
    .filter((page) => localDetection.tocPages.includes(page.pageNumber))
    .flatMap(parseTocEntriesFromPage)
  const pageMapSpans = localDetection.pageMapSpans
  const tocPages = localDetection.tocPages

  let chapters = localDetection.chapters
  let strategyUsed = localDetection.strategyUsed

  const localConfidence = scoreOverallConfidence(chapters)
  const shouldUseLlm = input.mode === 'llm'
    || (input.mode === 'auto' && (chapters.length < 2 || localConfidence < 0.72))

  let llmUsed = false
  if (shouldUseLlm) {
    if (typeof input.llmService === 'string' && typeof input.llmModel === 'string') {
      try {
        const llmCandidates = await resolveLlmCandidates({
          pages: input.pages,
          tocPages,
          tocEntries,
          pageMapSpans,
          localCandidates: chapters,
          ...(typeof input.title === 'string' ? { title: input.title } : {}),
          ...(typeof input.author === 'string' ? { author: input.author } : {}),
          llmService: input.llmService,
          llmModel: input.llmModel
        })

        if (llmCandidates && llmCandidates.length >= Math.max(chapters.length, 2)) {
          chapters = llmCandidates
          strategyUsed = strategyUsed === 'none' ? 'llm' : `${strategyUsed}+llm`
          llmUsed = true
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        warnings.push(`LLM chapter fallback failed: ${message}`)
        l.warn(`PDF chapter LLM fallback failed: ${message}`)
      }
    } else {
      warnings.push('PDF chapter LLM assistance was requested, but no default LLM is configured.')
    }
  }

  chapters = dedupeResolvedChapters(chapters).filter((chapter) => chapter.pdfStartPage >= 1 && chapter.pdfStartPage <= totalPages)

  if (chapters.length === 0) {
    warnings.push('No PDF chapter boundaries were resolved from outline, TOC, or heading detection.')
  }

  const detection: PdfChapterDetectionSummary = {
    mode: input.mode,
    strategyUsed,
    overallConfidence: scoreOverallConfidence(chapters),
    warnings,
    tocPages,
    pageMapSpans,
    chapters,
    ...(llmUsed && typeof input.llmService === 'string' && typeof input.llmModel === 'string'
      ? {
          llm: {
            service: input.llmService,
            model: input.llmModel
          }
        }
      : {})
  }

  if (chapters.length === 0) {
    return { detection }
  }

  const files = buildPdfChapterFiles(input.pages, chapters, input.chunkLimitChars)
  if (files.length === 0) {
    warnings.push('PDF chapter boundaries resolved, but no chapter files were written.')
    return { detection }
  }

  return {
    files,
    summary: {
      sourceFormat: 'pdf',
      mode: 'chapters',
      ...(typeof input.chunkLimitChars === 'number' ? { chunkLimitChars: input.chunkLimitChars } : {}),
      sectionsKept: chapters.length,
      sectionsDropped: 0,
      dividerSectionsMerged: 0,
      filesWritten: files.length,
      chapterFilesWritten: files.length,
      directories: ['chapters']
    },
    detection
  }
}
