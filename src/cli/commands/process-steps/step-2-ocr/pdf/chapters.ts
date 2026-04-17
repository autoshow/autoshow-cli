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
  printedPage: string
  style: 'arabic' | 'roman'
  numericValue: number
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
  text.replace(/^page\s+\S+\s+\d+\s*\n?/i, '')

const normalizeInlineWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

const normalizeTitle = (value: string): string =>
  normalizeInlineWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

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

const isGenericOutlineTitle = (title: string): boolean => {
  const normalized = normalizeTitle(title)
  if (normalized.length === 0) {
    return true
  }
  return [
    'table of contents',
    'contents',
    'request',
    'response',
    'see also',
    'errors',
    'next step',
    'contents'
  ].includes(normalized)
}

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
    return normalizedLine.includes(normalizedNeedle) || normalizedNeedle.includes(normalizedLine)
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

  return spans.sort((a, b) => a.pdfStartPage - b.pdfStartPage)
}

const isTocLikeLine = (line: string): boolean =>
  /(?:\.{2,}|\s{2,})([0-9]+|[ivxlcdm]+)\s*$/i.test(line) || /^.+\s+([0-9]+|[ivxlcdm]+)\s*$/i.test(line)

export const isTocPage = (page: PageResult): boolean => {
  const lines = cleanExportLines(page.text).map((line) => line.trim()).filter((line) => line.length > 0)
  if (lines.length === 0) {
    return false
  }
  const heading = lines.slice(0, 4).some((line) => TOC_PAGE_TITLE_RE.test(line))
  const tocLikeCount = lines.filter(isTocLikeLine).length
  return heading || tocLikeCount >= 4
}

export const parseTocEntriesFromPage = (page: PageResult): PdfTocEntry[] => {
  const lines = cleanExportLines(page.text).map((line) => line.trim()).filter((line) => line.length > 0)
  const entries: PdfTocEntry[] = []
  let pendingTitle = ''

  for (const line of lines) {
    if (TOC_PAGE_TITLE_RE.test(line)) {
      pendingTitle = ''
      continue
    }

    const match = line.match(/^(.*?)(?:\.{2,}|\s{2,}|\s)\s*([0-9]+|[ivxlcdm]+)\s*$/i)
    if (match) {
      const titlePart = normalizeInlineWhitespace(`${pendingTitle} ${match[1] ?? ''}`)
      pendingTitle = ''
      if (titlePart.length === 0) {
        continue
      }
      const parsed = parsePrintedLabel(match[2] ?? '')
      if (!parsed) {
        continue
      }
      entries.push({
        title: titlePart,
        printedPage: parsed.raw,
        style: parsed.style,
        numericValue: parsed.numericValue,
        tocPdfPage: page.pageNumber
      })
      continue
    }

    if (line.length <= 120 && /[A-Za-z]/.test(line)) {
      pendingTitle = normalizeInlineWhitespace(`${pendingTitle} ${line}`)
    } else {
      pendingTitle = ''
    }
  }

  return entries
}

const mapPrintedToPdfPage = (
  printedPage: string,
  spans: PdfPageMapSpan[],
  totalPages: number
): number | undefined => {
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
  rawEntries: PdfOutlineEntry[]
): ResolvedPdfChapter[] => {
  const byPage = new Map<number, PdfOutlineEntry[]>()
  for (const entry of rawEntries) {
    if (isGenericOutlineTitle(entry.title)) {
      continue
    }
    const list = byPage.get(entry.pdfPage) ?? []
    list.push(entry)
    byPage.set(entry.pdfPage, list)
  }

  const chapters: ResolvedPdfChapter[] = []
  for (const [pdfPage, entries] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    const chosen = [...entries].sort((a, b) =>
      a.depth - b.depth || b.title.length - a.title.length
    )[0]
    if (!chosen) {
      continue
    }
    chapters.push({
      title: chosen.title,
      pdfStartPage: pdfPage,
      source: 'outline',
      confidence: 0.92
    })
  }

  return chapters
}

const findTitleAnchorPage = (
  title: string,
  predictedPage: number,
  pages: PageResult[]
): number => {
  const normalizedNeedle = normalizeTitle(title)
  if (normalizedNeedle.length === 0) {
    return predictedPage
  }

  for (let delta = 0; delta <= 2; delta++) {
    for (const candidatePage of [predictedPage - delta, predictedPage + delta]) {
      const page = pages.find((entry) => entry.pageNumber === candidatePage)
      if (!page) {
        continue
      }
      const normalizedPage = normalizeTitle(cleanPageTextForExport(page.text))
      if (normalizedPage.includes(normalizedNeedle)) {
        return candidatePage
      }
    }
  }

  return predictedPage
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
    if (!mappedPage) {
      continue
    }
    const anchoredPage = findTitleAnchorPage(entry.title, mappedPage, pages)
    if (seenPages.has(anchoredPage)) {
      continue
    }
    seenPages.add(anchoredPage)
    resolved.push({
      title: entry.title,
      pdfStartPage: anchoredPage,
      printedStartPage: entry.printedPage,
      source: anchoredPage === mappedPage ? 'toc-page-map' : 'toc-page-map+anchor',
      confidence: anchoredPage === mappedPage ? 0.76 : 0.86
    })
  }

  return resolved.sort((a, b) => a.pdfStartPage - b.pdfStartPage)
}

const detectHeadingTitle = (page: PageResult): string | undefined => {
  const lines = cleanExportLines(page.text).map((line) => line.trim()).filter((line) => line.length > 0)
  const topLines = lines.slice(0, 12)

  for (const line of topLines) {
    if (/^(chapter|chap\.|part|book|section)\s+([0-9ivxlcdm]+)\b/i.test(line)) {
      return line
    }
    if (/^(prologue|epilogue|introduction|foreword|preface|appendix)\b/i.test(line)) {
      return line
    }
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
  for (const chapter of [...chapters].sort((a, b) => a.pdfStartPage - b.pdfStartPage)) {
    if (seenPages.has(chapter.pdfStartPage)) {
      continue
    }
    seenPages.add(chapter.pdfStartPage)
    deduped.push(chapter)
  }
  return deduped
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
        pdfStartPage: findTitleAnchorPage(title, pdfStartPage, input.pages),
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
  const warnings: string[] = []
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

  const pageTextCandidates = extractPrintedPageCandidates(input.pages)
  const pageMapSpans = [
    ...buildPageLabelSpans(labelEntries, totalPages),
    ...buildTextPageMapSpans(pageTextCandidates, totalPages)
  ]

  const tocPages = input.pages.filter(isTocPage).map((page) => page.pageNumber)
  const tocEntries = input.pages
    .filter((page) => tocPages.includes(page.pageNumber))
    .flatMap(parseTocEntriesFromPage)

  const outlineCandidates = dedupeResolvedChapters(buildOutlineCandidates(outlineEntries))
  const tocCandidates = dedupeResolvedChapters(buildTocCandidates(tocEntries, pageMapSpans, input.pages))
  const headingCandidates = dedupeResolvedChapters(buildHeadingCandidates(input.pages))

  let chapters = outlineCandidates
  let strategyUsed = outlineCandidates.length >= 2 ? 'outline' : 'none'

  if (chapters.length < 2 && tocCandidates.length >= 2) {
    chapters = tocCandidates
    strategyUsed = 'toc-page-map'
  }

  if (chapters.length < 2 && headingCandidates.length >= 2) {
    chapters = headingCandidates
    strategyUsed = 'heading'
  }

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
          localCandidates: dedupeResolvedChapters([
            ...outlineCandidates,
            ...tocCandidates,
            ...headingCandidates
          ]),
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
