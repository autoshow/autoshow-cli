import { posix } from 'node:path'
import {
  decodeXmlEntities,
  firstStartTag,
  firstTagAttr,
  firstTagBlock,
  firstTagText,
  innerXml,
  readAttr,
  scanTagBlocks
} from '~/utils/xml-scan'
import type {
  EpubAssets,
  EpubChapter,
  EpubContentReader,
  EpubInspectEngine,
  EpubInspectOutput,
  EpubInspectionPayload,
  EpubManifestItem,
  EpubMetadata,
  EpubTocItem
} from '~/types'
import { cleanEpubHtmlToText } from './cleanup'

const stripNsPrefixes = (xml: string): string =>
  xml.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*:/g, match => (match[1] === '/' ? '</' : '<'))

const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

const normalizeRelPath = (value: string): string => {
  const normalized = posix.normalize(value.replace(/\\/g, '/'))
  return normalized.startsWith('./') ? normalized.slice(2) : normalized
}

export const normalizeEntryPath = (value: string): string =>
  value.replace(/\\/g, '/').replace(/^\.?\//, '')

const decodeHrefPath = (href: string): string =>
  href
    .split('/')
    .map(segment => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .join('/')

const tryDecodeURIComponent = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const resolvePackageHref = (packagePath: string, href: string): string => {
  const cleanHref = href.split(/[?#]/, 1)[0]?.trim() ?? ''
  if (!cleanHref) return ''
  const resolved = posix.normalize(posix.join(posix.dirname(packagePath), decodeHrefPath(cleanHref)))
  return normalizeRelPath(resolved)
}

const splitTocHref = (hrefRaw: string): { href: string, fragment?: string } => {
  const hashIndex = hrefRaw.indexOf('#')
  if (hashIndex === -1) {
    return { href: hrefRaw }
  }

  const href = hrefRaw.slice(0, hashIndex)
  const fragment = hrefRaw.slice(hashIndex + 1).trim()
  return {
    href,
    ...(fragment ? { fragment } : {})
  }
}

const cleanEpubHtmlFragmentToText = (html: string): string =>
  cleanEpubHtmlToText(`<html><body>${html}</body></html>`)

const readTagTexts = (xml: string, tagName: string): string[] =>
  scanTagBlocks(xml, tagName)
    .map(block => collapseWhitespace(decodeXmlEntities(innerXml(block, tagName))))
    .filter(Boolean)

const parseMetadata = (opfXml: string): EpubMetadata => {
  const xml = stripNsPrefixes(opfXml)
  const title = firstTagText(xml, 'title')
  const language = firstTagText(xml, 'language')
  const identifier = firstTagText(xml, 'identifier')
  const description = firstTagText(xml, 'description')
  const publisher = firstTagText(xml, 'publisher')
  const publishedAt = firstTagText(xml, 'date')
  return {
    ...(title ? { title } : {}),
    creators: readTagTexts(xml, 'creator'),
    ...(language ? { language } : {}),
    ...(identifier ? { identifier } : {}),
    ...(description ? { description } : {}),
    ...(publisher ? { publisher } : {}),
    ...(publishedAt ? { publishedAt } : {}),
    subjects: readTagTexts(xml, 'subject')
  }
}

const parseManifest = (opfXml: string, packagePath: string): EpubManifestItem[] => {
  const xml = stripNsPrefixes(opfXml)
  return scanTagBlocks(xml, 'item')
    .map((block): EpubManifestItem | null => {
      const id = firstTagAttr(block, 'item', 'id')
      const href = firstTagAttr(block, 'item', 'href')
      const mediaType = firstTagAttr(block, 'item', 'media-type')
      const properties = firstTagAttr(block, 'item', 'properties')
      if (!id || !href || !mediaType) return null
      return {
        id,
        href,
        mediaType,
        ...(properties ? { properties } : {}),
        path: resolvePackageHref(packagePath, href)
      }
    })
    .filter((item): item is EpubManifestItem => item !== null)
}

const parseSpine = (opfXml: string, manifest: EpubManifestItem[]): EpubInspectionPayload['spine'] => {
  const xml = stripNsPrefixes(opfXml)
  const manifestById = new Map(manifest.map(item => [item.id, item]))

  return scanTagBlocks(xml, 'itemref').map((block, index) => {
    const idref = firstTagAttr(block, 'itemref', 'idref') ?? ''
    const linear = firstTagAttr(block, 'itemref', 'linear') ?? 'yes'
    const manifestItem = manifestById.get(idref)
    return {
      index: index + 1,
      idref,
      linear,
      ...(manifestItem?.id ? { manifestId: manifestItem.id } : {}),
      ...(manifestItem?.href ? { href: manifestItem.href } : {}),
      ...(manifestItem?.path ? { path: manifestItem.path } : {})
    }
  })
}

const parseNcxNavPoint = (
  block: string,
  packagePath: string
): EpubTocItem => {
  const start = firstStartTag(block, 'navPoint') ?? ''
  const id = readAttr(start, 'id')
  const playOrderRaw = readAttr(start, 'playOrder')
  const playOrder = playOrderRaw ? Number.parseInt(playOrderRaw, 10) : undefined
  const navLabelBlock = firstTagBlock(block, 'navLabel')
  const label = navLabelBlock ? firstTagText(navLabelBlock, 'text') : undefined
  const src = firstTagAttr(block, 'content', 'src')
  const hrefParts = src ? splitTocHref(src) : undefined
  const href = hrefParts?.href
  const path = href ? resolvePackageHref(packagePath, href) : undefined
  const childrenXml = innerXml(block, 'navPoint')
  const children = scanTagBlocks(childrenXml, 'navPoint').map(child => parseNcxNavPoint(child, packagePath))

  return {
    ...(id ? { id } : {}),
    ...(playOrder !== undefined && Number.isFinite(playOrder) ? { playOrder } : {}),
    title: label ?? 'Untitled',
    ...(href ? { href } : {}),
    ...(hrefParts?.fragment ? { fragment: hrefParts.fragment } : {}),
    ...(path ? { path } : {}),
    children
  }
}

const parseNcx = (ncxXml: string, packagePath: string): EpubTocItem[] => {
  const xml = stripNsPrefixes(ncxXml)
  const navMap = firstTagBlock(xml, 'navMap')
  if (!navMap) return []
  const navMapInner = innerXml(navMap, 'navMap')
  return scanTagBlocks(navMapInner, 'navPoint').map(block => parseNcxNavPoint(block, packagePath))
}

const parseNavHtml = (navXml: string, packagePath: string): EpubTocItem[] => {
  const xml = stripNsPrefixes(navXml)
  const navBlocks = scanTagBlocks(xml, 'nav')
  if (navBlocks.length === 0) return []

  const tocBlock = navBlocks.find(block => {
    const start = firstStartTag(block, 'nav') ?? ''
    return /(?:^|\s)(?:type|epub:type)\s*=\s*["']toc["']/i.test(start) || /role\s*=\s*["']doc-toc["']/i.test(start)
  }) ?? navBlocks[0]
  if (!tocBlock) return []

  const items: EpubTocItem[] = []
  const anchorRegex = /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = anchorRegex.exec(tocBlock)) !== null) {
    const hrefRaw = (match[1] || match[2] || '').trim()
    const hrefParts = splitTocHref(hrefRaw)
    const href = hrefParts.href
    const title = collapseWhitespace(cleanEpubHtmlFragmentToText(match[3] || ''))
    if (!href || !title) continue
    items.push({
      title,
      href,
      ...(hrefParts.fragment ? { fragment: hrefParts.fragment } : {}),
      path: resolvePackageHref(packagePath, href),
      children: []
    })
  }
  return items
}

const flattenToc = (items: EpubTocItem[]): EpubTocItem[] => {
  const out: EpubTocItem[] = []
  for (const item of items) {
    out.push(item)
    out.push(...flattenToc(item.children))
  }
  return out
}

const buildTocItemsByPath = (tocItems: EpubTocItem[]): Map<string, EpubTocItem[]> => {
  const tocByPath = new Map<string, EpubTocItem[]>()
  for (const item of flattenToc(tocItems)) {
    if (item.path) {
      const existing = tocByPath.get(item.path) ?? []
      existing.push(item)
      tocByPath.set(item.path, existing)
    }
  }
  return tocByPath
}

type TocBoundary = {
  tocItem: EpubTocItem
  startOffset: number
  tocOrder: number
}

const HEADING_ADJUST_BEFORE_CHARS = 1200
const HEADING_ADJUST_AFTER_CHARS = 4000
const HEADING_ADJUST_AFTER_FALLBACK_CHARS = 1600
const HEADING_ADJUST_BEFORE_FALLBACK_CHARS = 800

const NUMBER_WORDS: Record<string, string> = {
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  ten: '10',
  eleven: '11',
  twelve: '12',
  thirteen: '13',
  fourteen: '14',
  fifteen: '15',
  sixteen: '16',
  seventeen: '17',
  eighteen: '18',
  nineteen: '19',
  twenty: '20'
}

const NUMBER_WORD_RE = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/g

const normalizeComparableText = (value: string): string =>
  collapseWhitespace(
    decodeXmlEntities(value)
      .toLowerCase()
      .replace(NUMBER_WORD_RE, word => NUMBER_WORDS[word] ?? word)
      .replace(/[^a-z0-9]+/g, ' ')
  )

const isMeaningfulHeadingText = (text: string): boolean =>
  text.length > 0 && !/^[\d\s-]+$/.test(text)

const headingTitleMatches = (headingText: string, title: string): boolean => {
  const headingKey = normalizeComparableText(headingText)
  const titleKey = normalizeComparableText(title)
  if (!headingKey || !titleKey) return false
  return headingKey.includes(titleKey) || titleKey.includes(headingKey)
}

const isChapterHeadingKey = (key: string): boolean =>
  /^(?:chapter|chatper)\s+(?:\d+|[ivxlcdm]+)\b/i.test(key)

const isChapterHeadingText = (text: string): boolean =>
  isChapterHeadingKey(normalizeComparableText(text))

const isLikelyHeadingLine = (text: string, title: string, tagName: string): boolean => {
  if (!isMeaningfulHeadingText(text)) {
    return false
  }
  if (tagName.toLowerCase().startsWith('h')) {
    return true
  }
  if (headingTitleMatches(text, title)) {
    return true
  }

  const key = normalizeComparableText(text)
  return isChapterHeadingKey(key)
    || /^(?:introduction|prologue|epilogue|table of contents|contents)$/.test(key)
}

const findNearbyHeadingStart = (html: string, anchorOffset: number, tocTitle: string): number | undefined => {
  const minOffset = Math.max(0, anchorOffset - HEADING_ADJUST_BEFORE_CHARS)
  const maxOffset = Math.min(html.length, anchorOffset + HEADING_ADJUST_AFTER_CHARS)
  const headingRegex = /<(h[1-6]|p)\b[\s\S]*?<\/\1>/gi
  const candidates: Array<{ start: number, end: number, text: string }> = []
  let match: RegExpExecArray | null

  while ((match = headingRegex.exec(html)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (end < minOffset) continue
    if (start > maxOffset) break

    const text = cleanEpubHtmlFragmentToText(match[0])
    if (!isLikelyHeadingLine(text, tocTitle, match[1] ?? '')) continue
    candidates.push({ start, end, text })
  }

  const containing = candidates.find(candidate => candidate.start <= anchorOffset && candidate.end >= anchorOffset)
  if (containing) return containing.start

  const tocTitleIsChapter = isChapterHeadingText(tocTitle)
  const titleMatches = candidates
    .filter(candidate => headingTitleMatches(candidate.text, tocTitle))
    .sort((a, b) => {
      if (tocTitleIsChapter) {
        const chapterRank = Number(isChapterHeadingText(b.text)) - Number(isChapterHeadingText(a.text))
        if (chapterRank !== 0) return chapterRank
      }
      return Math.abs(a.start - anchorOffset) - Math.abs(b.start - anchorOffset)
    })
  if (titleMatches[0]) return titleMatches[0].start

  const after = candidates
    .filter(candidate => candidate.start >= anchorOffset && candidate.start - anchorOffset <= HEADING_ADJUST_AFTER_FALLBACK_CHARS)
    .sort((a, b) => a.start - b.start)
  if (after[0]) return after[0].start

  const before = candidates
    .filter(candidate => candidate.start < anchorOffset && anchorOffset - candidate.start <= HEADING_ADJUST_BEFORE_FALLBACK_CHARS)
    .sort((a, b) => b.start - a.start)
  return before[0]?.start
}

const fragmentCandidates = (fragment: string): Set<string> => {
  const decodedEntities = decodeXmlEntities(fragment)
  const decodedUri = tryDecodeURIComponent(decodedEntities)
  return new Set([
    fragment,
    decodedEntities,
    decodedUri,
    tryDecodeURIComponent(fragment)
  ].filter(value => value.length > 0))
}

const findFragmentAnchorOffset = (html: string, fragment: string): number | undefined => {
  const candidates = fragmentCandidates(fragment)
  const tagRegex = /<[^!?/][^>]*\s(?:id|name|xml:id)\s*=\s*(["'])(.*?)\1[^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(html)) !== null) {
    const value = decodeXmlEntities(match[2] ?? '').trim()
    if (candidates.has(value) || candidates.has(tryDecodeURIComponent(value))) {
      return match.index
    }
  }

  return undefined
}

const resolveTocBoundaryOffset = (
  html: string,
  tocItem: EpubTocItem,
  spinePath: string,
  warnings: string[]
): number | undefined => {
  const fragment = tocItem.fragment
  if (!fragment) {
    return 0
  }

  const anchorOffset = findFragmentAnchorOffset(html, fragment)
  if (anchorOffset === undefined) {
    warnings.push(`TOC fragment target not found in ${spinePath}: #${fragment}`)
    return undefined
  }

  return findNearbyHeadingStart(html, anchorOffset, tocItem.title) ?? anchorOffset
}

const buildTocBoundaries = (
  html: string,
  spinePath: string,
  tocItems: EpubTocItem[],
  warnings: string[]
): TocBoundary[] =>
  tocItems
    .map((tocItem, tocOrder): TocBoundary | null => {
      const startOffset = resolveTocBoundaryOffset(html, tocItem, spinePath, warnings)
      return startOffset === undefined ? null : { tocItem, startOffset, tocOrder }
    })
    .filter((boundary): boundary is TocBoundary => boundary !== null)
    .sort((a, b) => a.startOffset - b.startOffset || a.tocOrder - b.tocOrder)

const appendChapter = (
  chapters: EpubChapter[],
  spineItem: EpubInspectionPayload['spine'][number],
  text: string,
  options: {
    path: string
    title?: string
    tocItem?: EpubTocItem
  }
): void => {
  const words = text.length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length

  chapters.push({
    index: chapters.length + 1,
    idref: spineItem.idref,
    href: spineItem.href ?? '',
    path: options.path,
    ...(options.title ? { title: options.title } : {}),
    ...(options.tocItem ? { tocTitle: options.tocItem.title, isTocStart: true } : {}),
    text,
    wordCount: words,
    characterCount: text.length
  })
}

const buildChapterFromFullSpineItem = (
  chapters: EpubChapter[],
  spineItem: EpubInspectionPayload['spine'][number],
  spinePath: string,
  html: string,
  tocItem?: EpubTocItem
): void => {
  const title = tocItem?.title
    ?? firstTagText(html, 'h1')
    ?? firstTagText(html, 'title')
  const text = cleanEpubHtmlToText(html)
  appendChapter(chapters, spineItem, text, {
    path: spinePath,
    ...(title ? { title } : {}),
    ...(tocItem ? { tocItem } : {})
  })
}

const buildChaptersFromTocBoundaries = (
  chapters: EpubChapter[],
  spineItem: EpubInspectionPayload['spine'][number],
  spinePath: string,
  html: string,
  tocItems: EpubTocItem[],
  warnings: string[]
): boolean => {
  if (tocItems.length === 0) {
    return false
  }

  const boundaries = buildTocBoundaries(html, spinePath, tocItems, warnings)
  if (boundaries.length === 0) {
    return false
  }

  const firstBoundary = boundaries[0] as TocBoundary
  if (firstBoundary.startOffset > 0) {
    const preludeText = cleanEpubHtmlFragmentToText(html.slice(0, firstBoundary.startOffset))
    if (preludeText.length > 0) {
      const title = firstTagText(html, 'title')
      appendChapter(chapters, spineItem, preludeText, {
        path: spinePath,
        ...(title ? { title } : {})
      })
    }
  }

  for (let index = 0; index < boundaries.length; index++) {
    const boundary = boundaries[index] as TocBoundary
    const nextBoundary = boundaries[index + 1]
    const endOffset = nextBoundary ? nextBoundary.startOffset : html.length
    const text = cleanEpubHtmlFragmentToText(html.slice(boundary.startOffset, endOffset))
    appendChapter(chapters, spineItem, text, {
      path: spinePath,
      title: boundary.tocItem.title,
      tocItem: boundary.tocItem
    })
  }

  return true
}

const buildChapters = async (
  reader: EpubContentReader,
  spine: EpubInspectionPayload['spine'],
  tocItems: EpubTocItem[],
  warnings: string[]
): Promise<EpubChapter[]> => {
  const tocByPath = buildTocItemsByPath(tocItems)
  const chapters: EpubChapter[] = []

  for (const spineItem of spine) {
    if (!spineItem.path || !spineItem.href) continue
    if (!reader.hasEntry(spineItem.path)) {
      warnings.push(`Missing chapter entry referenced in spine: ${spineItem.path}`)
      continue
    }

    const xhtml = await reader.readText(spineItem.path)
    const stripped = stripNsPrefixes(xhtml)
    const tocForPath = tocByPath.get(spineItem.path) ?? []
    if (buildChaptersFromTocBoundaries(chapters, spineItem, spineItem.path, stripped, tocForPath, warnings)) {
      continue
    }

    buildChapterFromFullSpineItem(chapters, spineItem, spineItem.path, stripped, tocForPath[0])
  }

  return chapters
}

const classifyAssets = (manifest: EpubManifestItem[]): EpubAssets => {
  const images: string[] = []
  const stylesheets: string[] = []
  const fonts: string[] = []
  const scripts: string[] = []
  const other: string[] = []

  for (const item of manifest) {
    const mediaType = item.mediaType.toLowerCase()
    if (mediaType.startsWith('image/')) {
      images.push(item.path)
      continue
    }
    if (mediaType.includes('css')) {
      stylesheets.push(item.path)
      continue
    }
    if (mediaType.includes('font') || /\.(?:woff2?|ttf|otf)$/i.test(item.path)) {
      fonts.push(item.path)
      continue
    }
    if (mediaType.includes('javascript') || mediaType.includes('ecmascript')) {
      scripts.push(item.path)
      continue
    }
    other.push(item.path)
  }

  return { images, stylesheets, fonts, scripts, other }
}

const findContainerRootfile = (containerXml: string): { rootfilePath?: string, mediaType?: string } => {
  const xml = stripNsPrefixes(containerXml)
  const rootfile = scanTagBlocks(xml, 'rootfile')[0]
  if (!rootfile) return {}
  const rootfilePath = firstTagAttr(rootfile, 'rootfile', 'full-path')
  const mediaType = firstTagAttr(rootfile, 'rootfile', 'media-type')

  return {
    ...(rootfilePath ? { rootfilePath } : {}),
    ...(mediaType ? { mediaType } : {})
  }
}

const findPackagePathFallback = (reader: EpubContentReader): string | undefined =>
  reader.entries
    .map(entry => entry.path)
    .find(path => path.toLowerCase().endsWith('.opf'))

const buildPageText = (chapters: EpubChapter[]): string =>
  chapters
    .map(chapter => chapter.text)
    .join('\n\n')
    .trim()

export const inspectEpubWithReader = async (
  reader: EpubContentReader,
  engine: EpubInspectEngine
): Promise<EpubInspectOutput> => {
  const warnings: string[] = []
  if (!reader.hasEntry('META-INF/container.xml')) {
    throw new Error('Invalid EPUB: META-INF/container.xml not found')
  }

  const containerXml = await reader.readText('META-INF/container.xml')
  const container = findContainerRootfile(containerXml)
  const packagePath = container.rootfilePath ? normalizeRelPath(container.rootfilePath) : undefined
  const resolvedPackagePath = packagePath ?? findPackagePathFallback(reader)

  if (!resolvedPackagePath) {
    throw new Error('Invalid EPUB: package OPF path could not be resolved')
  }
  if (!reader.hasEntry(resolvedPackagePath)) {
    throw new Error(`Invalid EPUB: package OPF not found at ${resolvedPackagePath}`)
  }

  const opfXml = await reader.readText(resolvedPackagePath)
  const metadata = parseMetadata(opfXml)
  const manifest = parseManifest(opfXml, resolvedPackagePath)
  const spine = parseSpine(opfXml, manifest)

  const manifestById = new Map(manifest.map(item => [item.id, item]))
  const strippedOpf = stripNsPrefixes(opfXml)
  const spineTag = firstStartTag(strippedOpf, 'spine')
  const tocId = spineTag ? readAttr(spineTag, 'toc') : undefined
  const ncxItem = tocId ? manifestById.get(tocId) : manifest.find(item => item.mediaType === 'application/x-dtbncx+xml')
  const navItem = manifest.find(item => (item.properties ?? '').split(/\s+/).includes('nav'))

  let tocSource: 'ncx' | 'nav' | 'none' = 'none'
  let tocItems: EpubTocItem[] = []

  if (ncxItem?.path && reader.hasEntry(ncxItem.path)) {
    tocItems = parseNcx(await reader.readText(ncxItem.path), resolvedPackagePath)
    tocSource = 'ncx'
  } else if (navItem?.path && reader.hasEntry(navItem.path)) {
    tocItems = parseNavHtml(await reader.readText(navItem.path), resolvedPackagePath)
    tocSource = 'nav'
  } else {
    warnings.push('No TOC source found (neither NCX nor EPUB3 nav)')
  }

  const chapters = await buildChapters(reader, spine, tocItems, warnings)
  const assets = classifyAssets(manifest)
  const totalWords = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0)
  const totalCharacters = chapters.reduce((sum, chapter) => sum + chapter.characterCount, 0)

  const payload: EpubInspectionPayload = {
    schemaVersion: 1,
    engine,
    container: {
      rootfilePath: resolvedPackagePath,
      ...(container.mediaType ? { mediaType: container.mediaType } : {})
    },
    packagePath: resolvedPackagePath,
    metadata,
    manifest,
    spine,
    toc: {
      source: tocSource,
      items: tocItems
    },
    chapters,
    assets,
    inventory: {
      totalFiles: reader.entries.length,
      files: [...reader.entries].sort((a, b) => a.path.localeCompare(b.path))
    },
    stats: {
      chapterCount: chapters.length,
      totalWords,
      totalCharacters,
      totalFiles: reader.entries.length
    },
    diagnostics: {
      adapter: reader.adapterLabel,
      warnings
    }
  }

  return {
    payload,
    text: buildPageText(chapters)
  }
}
