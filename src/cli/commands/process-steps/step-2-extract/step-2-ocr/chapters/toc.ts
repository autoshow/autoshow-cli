import type { PageResult, PdfTocEntry, TocPageAnalysis, TocScanOptions } from '~/types'
import {
  countWords,
  getTocCandidateLines,
  INDEX_PAGE_TITLE_RE,
  isCompactNumberedTocTitle,
  isLikelyArtifactText,
  isLikelyNoisyTocTitle,
  isPlausibleTocPageRef,
  isPlausibleTocTitle,
  isStandaloneTocTitle,
  MAX_TOC_TITLE_LENGTH,
  normalizeDecoratedLabel,
  normalizeInlineWhitespace,
  parsePrintedLabel,
  TOC_PAGE_TITLE_RE
} from './text'

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

export const analyzeTocPage = (page: PageResult): TocPageAnalysis => {
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

export const parseTocEntriesFromPage = (page: PageResult): PdfTocEntry[] => {
  const analysis = analyzeTocPage(page)
  return analysis.isToc ? analysis.entries : []
}

export const selectPrimaryTocAnalyses = (
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
