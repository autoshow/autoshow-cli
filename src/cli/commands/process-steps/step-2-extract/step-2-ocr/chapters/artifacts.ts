import { showPdfObject, showPdfOutline } from '~/cli/commands/process-steps/step-1-download/document/mutool-utils'
import { splitWithHardLimit } from '../epub/export'
import type {
  PageResult,
  PdfChapterBuildResult,
  PdfChapterDetectionSummary,
  PdfChapterMode,
  PdfOutlineEntry,
  PdfPageLabelEntry,
  ResolvedPdfChapter,
  TextArtifactFile
} from '~/types'
import * as l from '~/utils/logger'
import {
  dedupeResolvedChapters,
  parsePdfOutline,
  resolveLocalPdfChapterDetection,
  scoreOverallConfidence
} from './detection'
import { resolveLlmCandidates } from './llm'
import { parsePdfPageLabels } from './page-map'
import { buildChapterSlug, cleanPageTextForExport, trimPageTextToHeading } from './text'
import { parseTocEntriesFromPage } from './toc'

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
