import type {
  PageResult,
  PdfPageLabelCandidate,
  PdfPageLabelEntry,
  PdfPageMapSpan
} from '~/types'
import {
  formatPrintedLabel,
  ISOLATED_LABEL_RE,
  normalizeDecoratedLabel,
  parsePrintedLabel,
  stripMutoolPageBanner
} from './text'

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

export const buildPageLabelSpans = (
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
