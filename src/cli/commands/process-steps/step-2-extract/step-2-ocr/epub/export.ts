import { basename, extname } from 'node:path'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import type { EpubChapter, PageResult } from '~/types'
import { finalizeEpubText } from './cleanup'
import type {
  EpubArtifactFile,
  EpubTextOutput,
  EpubTextSection,
  TextArtifactFile
} from '~/types'

const CHAPTER_SLUG_MAX_LENGTH = 60

const normalizeInlineWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

const stripFinalExtension = (value: string): string =>
  value.slice(0, value.length - extname(value).length)

const hrefBasename = (href: string): string => {
  const withoutFragment = href.split(/[?#]/, 1)[0] ?? ''
  const fileName = basename(withoutFragment)
  return fileName.length > 0 ? stripFinalExtension(fileName) : ''
}

const buildSectionSlug = (section: Pick<EpubTextSection, 'index' | 'title' | 'id' | 'href'>): string => {
  const candidates = [
    sanitizeTitleSlug(section.title, CHAPTER_SLUG_MAX_LENGTH),
    sanitizeTitleSlug(section.id, CHAPTER_SLUG_MAX_LENGTH),
    sanitizeTitleSlug(hrefBasename(section.href), CHAPTER_SLUG_MAX_LENGTH)
  ].filter((value) => value.length > 0)

  return candidates[0] ?? `section-${section.index}`
}

export const splitWithHardLimit = (text: string, maxChars: number): string[] => {
  const chunks: string[] = []
  const paragraphs = text.split(/\n\n+/)
  let current = ''

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim()
    if (trimmed.length === 0) {
      continue
    }

    const candidate = current.length > 0 ? `${current}\n\n${trimmed}` : trimmed
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }

    if (current.length > 0) {
      chunks.push(current)
      current = ''
    }

    if (trimmed.length <= maxChars) {
      current = trimmed
      continue
    }

    const words = trimmed.split(/\s+/)
    let wordChunk = ''
    for (const word of words) {
      const next = wordChunk.length > 0 ? `${wordChunk} ${word}` : word
      if (next.length <= maxChars) {
        wordChunk = next
        continue
      }

      if (wordChunk.length > 0) {
        chunks.push(wordChunk)
        wordChunk = ''
      }

      if (word.length <= maxChars) {
        wordChunk = word
        continue
      }

      for (let index = 0; index < word.length; index += maxChars) {
        chunks.push(word.slice(index, index + maxChars))
      }
    }

    if (wordChunk.length > 0) {
      current = wordChunk
    }
  }

  if (current.length > 0) {
    chunks.push(current)
  }

  return chunks
}

const buildSections = (chapters: EpubChapter[]): EpubTextSection[] =>
  chapters.map((chapter) => ({
    index: chapter.index,
    id: chapter.idref,
    title: chapter.title ?? '',
    href: chapter.href,
    text: finalizeEpubText(chapter.text),
    ...(chapter.isTocStart === true ? { isTocStart: true } : {}),
    sourceIndexes: [chapter.index]
  }))

const normalizeSectionKey = (value: string): string =>
  sanitizeTitleSlug(value, CHAPTER_SLUG_MAX_LENGTH)

type LogicalChapterSource = 'toc' | 'spine' | 'heading'

const PAGE_LIKE_TOC_RATIO = 0.8

const normalizePageLikeKey = (value: string): string =>
  normalizeInlineWhitespace(value).toLowerCase().replace(/[\s_.-]+/g, '')

const isPageLikeTocTitle = (value: string): boolean =>
  /^page(?:\d+|[ivxlcdm]+)$/.test(normalizePageLikeKey(value))

const stripTrailingHeadingPunctuation = (value: string): string =>
  value.replace(/\s*[:.;-]\s*$/g, '').trim()

const chapterNumberPattern = '(?:\\d+|[ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)'
const chapterHeadingRegex = new RegExp(`^(chapter|chatper)\\s+(${chapterNumberPattern})(?:\\s*[:.;-]\\s*(.*))?$`, 'i')
const namedHeadingRegex = /^(introduction|prologue|preface|foreword|afterword|epilogue|conclusion|finality)(?:\s*[:.;-]\s*(.*))?$/i

const extractSemanticHeadingTitle = (line: string): string | undefined => {
  const normalized = normalizeInlineWhitespace(line)
  if (normalized.length === 0 || normalized.length > 140 || isPageLikeTocTitle(normalized)) {
    return undefined
  }

  const chapterMatch = normalized.match(chapterHeadingRegex)
  if (chapterMatch) {
    const prefix = `${chapterMatch[1] ?? 'Chapter'} ${chapterMatch[2] ?? ''}`.trim()
    const subtitle = normalizeInlineWhitespace(chapterMatch[3] ?? '')
    return subtitle.length > 0 ? `${prefix}: ${subtitle}` : stripTrailingHeadingPunctuation(prefix)
  }

  const namedMatch = normalized.match(namedHeadingRegex)
  if (namedMatch) {
    const title = stripTrailingHeadingPunctuation(namedMatch[1] ?? normalized)
    const subtitle = normalizeInlineWhitespace(namedMatch[2] ?? '')
    return subtitle.length > 0 ? `${title}: ${subtitle}` : title
  }

  return undefined
}

const findSectionHeadingTitle = (section: EpubTextSection): string | undefined => {
  const candidateLines = section.text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 6)

  const looksLikeContentsPage = candidateLines.some((line) => /^(?:table of )?contents$/i.test(line))
    && candidateLines.some((line) => /^chapter\s+/i.test(line))
  if (looksLikeContentsPage) {
    return undefined
  }

  for (const line of candidateLines) {
    const headingTitle = extractSemanticHeadingTitle(line)
    if (headingTitle) {
      return headingTitle
    }
  }

  return undefined
}

const isStandalonePartDivider = (section: EpubTextSection): boolean => {
  const normalizedText = normalizeInlineWhitespace(section.text)
  const normalizedTitle = normalizeInlineWhitespace(section.title)
  if (normalizedText.length === 0 || normalizedTitle.length === 0 || normalizedText !== normalizedTitle) {
    return false
  }

  const keys = [
    normalizeSectionKey(section.title),
    normalizeSectionKey(section.id),
    normalizeSectionKey(hrefBasename(section.href))
  ]

  return keys.some((key) => /^part(?:[0-9]+|-[a-z0-9-]+)?$/.test(key))
}

const mergeDividerSections = (
  sections: EpubTextSection[]
): { sections: EpubTextSection[], dividerSectionsMerged: number } => {
  const merged: EpubTextSection[] = []
  const pendingDividers: EpubTextSection[] = []
  let dividerSectionsMerged = 0

  for (const section of sections) {
    if (isStandalonePartDivider(section)) {
      pendingDividers.push(section)
      continue
    }

    if (pendingDividers.length === 0) {
      merged.push(section)
      continue
    }

    dividerSectionsMerged += pendingDividers.length
    const prefix = pendingDividers.map((entry) => entry.text).join('\n\n')
    const pendingSourceIndexes = pendingDividers.flatMap((entry) => entry.sourceIndexes ?? [entry.index])
    pendingDividers.length = 0
    merged.push({
      ...section,
      sourceIndexes: [
        ...pendingSourceIndexes,
        ...(section.sourceIndexes ?? [section.index])
      ],
      text: finalizeEpubText(`${prefix}\n\n${section.text}`)
    })
  }

  if (pendingDividers.length > 0) {
    if (merged.length === 0) {
      merged.push(...pendingDividers)
    } else {
      dividerSectionsMerged += pendingDividers.length
      const suffix = pendingDividers.map((entry) => entry.text).join('\n\n')
      const lastSection = merged[merged.length - 1] as EpubTextSection
      merged[merged.length - 1] = {
        ...lastSection,
        sourceIndexes: [
          ...(lastSection.sourceIndexes ?? [lastSection.index]),
          ...pendingDividers.flatMap((entry) => entry.sourceIndexes ?? [entry.index])
        ],
        text: finalizeEpubText(`${lastSection.text}\n\n${suffix}`)
      }
    }
  }

  return { sections: merged, dividerSectionsMerged }
}

const prepareSections = (
  chapters: EpubChapter[]
): { sections: EpubTextSection[], sectionsDropped: number, dividerSectionsMerged: number } => {
  const cleanedSections = buildSections(chapters)
  const keptSections = cleanedSections.filter((section) => section.text.length > 0)
  const sectionsDropped = cleanedSections.length - keptSections.length
  const { sections, dividerSectionsMerged } = mergeDividerSections(keptSections)

  return { sections, sectionsDropped, dividerSectionsMerged }
}

const buildCombinedText = (sections: EpubTextSection[]): string =>
  finalizeEpubText(
    sections
      .map((section) => section.text.trim())
      .filter((text) => text.length > 0)
      .join('\n\n')
  )

const buildPages = (sections: EpubTextSection[]): PageResult[] =>
  sections.map((section) => ({
    pageNumber: section.index,
    method: 'text',
    text: section.text
  }))

const appendSectionText = (target: EpubTextSection, section: EpubTextSection): EpubTextSection => ({
  ...target,
  text: finalizeEpubText(`${target.text}\n\n${section.text}`),
  sourceIndexes: [
    ...(target.sourceIndexes ?? [target.index]),
    ...(section.sourceIndexes ?? [section.index])
  ]
})

const groupSectionsByTocStarts = (
  sections: EpubTextSection[]
): {
  sections: EpubTextSection[]
  logicalChapterSource: LogicalChapterSource
  tocStartSections: number
  prefaceSectionsDropped: number
  pageLikeTocStartsIgnored?: number
} => {
  const tocStartSections = sections.filter((section) => section.isTocStart === true).length
  if (tocStartSections === 0) {
    return {
      sections,
      logicalChapterSource: 'spine',
      tocStartSections,
      prefaceSectionsDropped: 0
    }
  }

  const pageLikeTocStarts = sections.filter((section) => section.isTocStart === true && isPageLikeTocTitle(section.title)).length
  const hasPageListToc = pageLikeTocStarts > 0
    && pageLikeTocStarts / tocStartSections >= PAGE_LIKE_TOC_RATIO
    && (pageLikeTocStarts >= 3 || pageLikeTocStarts === tocStartSections)

  if (hasPageListToc) {
    const headingGrouped = groupSectionsByHeadingStarts(sections)
    if (headingGrouped.sections.length > 0) {
      return {
        ...headingGrouped,
        tocStartSections,
        pageLikeTocStartsIgnored: pageLikeTocStarts
      }
    }

    return {
      sections: sections.map((section) => isPageLikeTocTitle(section.title) ? { ...section, title: '' } : section),
      logicalChapterSource: 'spine',
      tocStartSections,
      prefaceSectionsDropped: 0,
      pageLikeTocStartsIgnored: pageLikeTocStarts
    }
  }

  const grouped: EpubTextSection[] = []
  let current: EpubTextSection | undefined
  let prefaceSectionsDropped = 0

  for (const section of sections) {
    if (section.isTocStart === true) {
      if (current) {
        grouped.push({ ...current, index: grouped.length + 1 })
      }
      current = { ...section }
      continue
    }

    if (!current) {
      prefaceSectionsDropped += 1
      continue
    }

    current = appendSectionText(current, section)
  }

  if (current) {
    grouped.push({ ...current, index: grouped.length + 1 })
  }

  return {
    sections: grouped,
    logicalChapterSource: 'toc',
    tocStartSections,
    prefaceSectionsDropped
  }
}

const groupSectionsByHeadingStarts = (
  sections: EpubTextSection[]
): {
  sections: EpubTextSection[]
  logicalChapterSource: 'heading'
  prefaceSectionsDropped: number
} => {
  const grouped: EpubTextSection[] = []
  let current: EpubTextSection | undefined
  let prefaceSectionsDropped = 0

  for (const section of sections) {
    const headingTitle = findSectionHeadingTitle(section)
    if (headingTitle) {
      if (current) {
        grouped.push({ ...current, index: grouped.length + 1 })
      }
      current = { ...section, title: headingTitle }
      continue
    }

    if (!current) {
      prefaceSectionsDropped += 1
      continue
    }

    current = appendSectionText(current, section)
  }

  if (current) {
    grouped.push({ ...current, index: grouped.length + 1 })
  }

  return {
    sections: grouped,
    logicalChapterSource: 'heading',
    prefaceSectionsDropped
  }
}

const buildChapterFiles = (
  sections: EpubTextSection[],
  chunkLimitChars?: number
): EpubArtifactFile[] => {
  const files: TextArtifactFile[] = []

  for (const section of sections) {
    const baseName = `${String(section.index).padStart(3, '0')}-${buildSectionSlug(section)}`
    const parts = typeof chunkLimitChars === 'number'
      ? splitWithHardLimit(section.text, chunkLimitChars)
      : [section.text]

    if (parts.length <= 1) {
      const onlyPart = parts[0]
      if (typeof onlyPart === 'string' && onlyPart.length > 0) {
        files.push({
          relativePath: `chapters/${baseName}.txt`,
          text: onlyPart
        })
      }
      continue
    }

    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]
      if (typeof part !== 'string' || part.length === 0) {
        continue
      }

      files.push({
        relativePath: `chapters/${baseName}-part-${String(index + 1).padStart(3, '0')}.txt`,
        text: part
      })
    }
  }

  return files
}

const buildChunkFiles = (
  documentSlug: string,
  text: string,
  chunkLimitChars: number
): EpubArtifactFile[] =>
  splitWithHardLimit(text, chunkLimitChars)
    .filter((chunk) => chunk.length > 0)
    .map((chunk, index) => ({
      relativePath: `chunks/${documentSlug}-${String(index + 1).padStart(3, '0')}.txt`,
      text: chunk
    }))

export const buildEpubTextOutput = (
  documentSlug: string,
  chapters: EpubChapter[],
  options: {
    chapterFiles?: boolean
    chunkLimitChars?: number
  }
): EpubTextOutput => {
  const { sections, sectionsDropped, dividerSectionsMerged } = prepareSections(chapters)
  const text = buildCombinedText(sections)
  const pages = buildPages(sections)

  if (options.chapterFiles) {
    const logicalChapters = groupSectionsByTocStarts(sections)
    const files = buildChapterFiles(logicalChapters.sections, options.chunkLimitChars)
    return {
      pages,
      text,
      exportPlan: {
        files,
        summary: {
          sourceFormat: 'epub',
          mode: 'chapters',
          ...(typeof options.chunkLimitChars === 'number' ? { chunkLimitChars: options.chunkLimitChars } : {}),
          sectionsKept: sections.length,
          sectionsDropped,
          dividerSectionsMerged,
          logicalChapterCount: logicalChapters.sections.length,
          logicalChapterSource: logicalChapters.logicalChapterSource,
          tocStartSections: logicalChapters.tocStartSections,
          prefaceSectionsDropped: logicalChapters.prefaceSectionsDropped,
          ...(typeof logicalChapters.pageLikeTocStartsIgnored === 'number' ? { pageLikeTocStartsIgnored: logicalChapters.pageLikeTocStartsIgnored } : {}),
          filesWritten: files.length,
          chapterFilesWritten: files.length,
          directories: ['chapters']
        }
      }
    }
  }

  if (typeof options.chunkLimitChars === 'number') {
    const files = buildChunkFiles(documentSlug, text, options.chunkLimitChars)
    return {
      pages,
      text,
      exportPlan: {
        files,
        summary: {
          sourceFormat: 'epub',
          mode: 'chunks',
          chunkLimitChars: options.chunkLimitChars,
          sectionsKept: sections.length,
          sectionsDropped,
          dividerSectionsMerged,
          filesWritten: files.length,
          chunkFilesWritten: files.length,
          directories: ['chunks']
        }
      }
    }
  }

  return { pages, text }
}
