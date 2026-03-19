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
} from './types'

const stripNsPrefixes = (xml: string): string =>
  xml.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*:/g, match => (match[1] === '/' ? '</' : '<'))

const collapseWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim()

const normalizeRelPath = (value: string): string => {
  const normalized = posix.normalize(value.replace(/\\/g, '/'))
  return normalized.startsWith('./') ? normalized.slice(2) : normalized
}

const resolvePackageHref = (packagePath: string, href: string): string => {
  const cleanHref = href.split('#')[0]?.trim() ?? ''
  if (!cleanHref) return ''
  const resolved = posix.normalize(posix.join(posix.dirname(packagePath), cleanHref))
  return normalizeRelPath(resolved)
}

const readTagTexts = (xml: string, tagName: string): string[] =>
  scanTagBlocks(xml, tagName)
    .map(block => collapseWhitespace(decodeXmlEntities(innerXml(block, tagName))))
    .filter(Boolean)

const stripMarkup = (value: string): string =>
  value
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head\b[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')

const extractHtmlText = (xml: string): string => {
  const stripped = stripMarkup(xml)
  return collapseWhitespace(decodeXmlEntities(stripped))
}

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
  const href = src ? src.split('#')[0] : undefined
  const path = href ? resolvePackageHref(packagePath, href) : undefined
  const childrenXml = innerXml(block, 'navPoint')
  const children = scanTagBlocks(childrenXml, 'navPoint').map(child => parseNcxNavPoint(child, packagePath))

  return {
    ...(id ? { id } : {}),
    ...(playOrder !== undefined && Number.isFinite(playOrder) ? { playOrder } : {}),
    title: label ?? 'Untitled',
    ...(href ? { href } : {}),
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
    const href = hrefRaw.split('#')[0] ?? ''
    const title = collapseWhitespace(decodeXmlEntities(stripMarkup(match[3] || '')))
    if (!href || !title) continue
    items.push({
      title,
      href,
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

const buildChapters = async (
  reader: EpubContentReader,
  spine: EpubInspectionPayload['spine'],
  tocItems: EpubTocItem[],
  warnings: string[]
): Promise<EpubChapter[]> => {
  const tocByPath = new Map(flattenToc(tocItems).flatMap(item => item.path ? [[item.path, item]] as const : []))
  const chapters: EpubChapter[] = []

  for (const spineItem of spine) {
    if (!spineItem.path || !spineItem.href) continue
    if (!reader.hasEntry(spineItem.path)) {
      warnings.push(`Missing chapter entry referenced in spine: ${spineItem.path}`)
      continue
    }

    const xhtml = await reader.readText(spineItem.path)
    const stripped = stripNsPrefixes(xhtml)
    const title = firstTagText(stripped, 'title')
      ?? firstTagText(stripped, 'h1')
      ?? tocByPath.get(spineItem.path)?.title

    const text = extractHtmlText(stripped)
    const words = text.length === 0 ? 0 : text.split(/\s+/).filter(Boolean).length

    chapters.push({
      index: chapters.length + 1,
      idref: spineItem.idref,
      href: spineItem.href,
      path: spineItem.path,
      ...(title ? { title } : {}),
      text,
      wordCount: words,
      characterCount: text.length
    })
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
    .map(chapter => `Page ${chapter.index}\n${chapter.text}`)
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
