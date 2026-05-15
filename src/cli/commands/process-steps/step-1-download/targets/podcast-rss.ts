

import {
  scanTagBlocks,
  firstTagText,
  firstTagAttr,
  firstStartTag,
  readAttr
} from '~/utils/xml-scan'
import type { ParsedEpisode, ParsedFeed } from '~/types'
import { MEDIA_EXTENSIONS } from '../media-extensions'

const APPLICATION_MEDIA_CONTENT_TYPES = new Set([
  'application/mp4',
  'application/mpeg',
  'application/ogg'
])

const getUrlExtension = (url: string): string => {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    return MEDIA_EXTENSIONS.find(ext => pathname.endsWith(ext)) ?? ''
  } catch {
    const lower = url.split(/[?#]/, 1)[0]?.toLowerCase() ?? ''
    return MEDIA_EXTENSIONS.find(ext => lower.endsWith(ext)) ?? ''
  }
}

const isMediaEnclosure = (url: string, type?: string): boolean => {
  if (url.trim().length === 0) return false

  const normalizedType = type?.split(';', 1)[0]?.trim().toLowerCase()
  if (normalizedType?.startsWith('image/')) return false
  if (normalizedType?.startsWith('audio/') || normalizedType?.startsWith('video/')) return true
  if (normalizedType && APPLICATION_MEDIA_CONTENT_TYPES.has(normalizedType)) return true

  return getUrlExtension(url).length > 0
}

const findRssMediaEnclosureUrl = (block: string): string => {
  for (const enclosureBlock of scanTagBlocks(block, 'enclosure')) {
    const tag = firstStartTag(enclosureBlock, 'enclosure')
    const url = tag ? readAttr(tag, 'url') ?? '' : ''
    const type = tag ? readAttr(tag, 'type') : undefined
    if (isMediaEnclosure(url, type)) return url
  }
  return ''
}

const findAtomMediaEnclosureUrl = (block: string): string => {
  for (const linkBlock of scanTagBlocks(block, 'link')) {
    const tag = firstStartTag(linkBlock, 'link')
    if (!tag || readAttr(tag, 'rel')?.toLowerCase() !== 'enclosure') continue

    const url = readAttr(tag, 'href') ?? ''
    const type = readAttr(tag, 'type')
    if (isMediaEnclosure(url, type)) return url
  }
  return ''
}

const parseRss2Episodes = (xml: string): ParsedEpisode[] =>
  scanTagBlocks(xml, 'item').map(block => {
    const enclosureUrl = findRssMediaEnclosureUrl(block)
    return {
      id: firstTagText(block, 'guid') ?? enclosureUrl,
      enclosureUrl,
      title: firstTagText(block, 'title'),
      pubDate: firstTagText(block, 'pubDate'),

      duration: firstTagText(block, 'itunes:duration') ?? firstTagText(block, 'duration')
    }
  }).filter(ep => ep.enclosureUrl !== '')

const parseAtomEntries = (xml: string): ParsedEpisode[] =>
  scanTagBlocks(xml, 'entry').map(block => {
    const enclosureUrl = findAtomMediaEnclosureUrl(block)

    return {
      id: firstTagText(block, 'id'),
      enclosureUrl,
      title: firstTagText(block, 'title'),
      pubDate: firstTagText(block, 'published') ?? firstTagText(block, 'updated'),
      duration: firstTagText(block, 'itunes:duration')
    }
  }).filter(ep => ep.enclosureUrl !== '')

export const parsePodcastFeedXml = (xml: string, _feedUrl: string): ParsedFeed | null => {
  const isAtom = xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"')
  const isRss = xml.includes('<rss') || xml.includes('<channel>')

  if (!isAtom && !isRss) return null

  if (isAtom) {
    return {
      title: firstTagText(xml, 'title'),
      link: firstTagAttr(xml, 'link', 'href'),
      author: firstTagText(xml, 'author') ?? firstTagText(xml, 'name'),
      image: firstTagAttr(xml, 'icon', 'href') ?? firstTagText(xml, 'icon'),
      episodes: parseAtomEntries(xml)
    }
  }

  return {
    title: firstTagText(xml, 'title'),
    link: firstTagText(xml, 'link'),
    author: firstTagText(xml, 'itunes:author') ?? firstTagText(xml, 'managingEditor'),

    image: firstTagAttr(xml, 'itunes:image', 'href') ?? firstTagText(xml, 'url'),
    episodes: parseRss2Episodes(xml)
  }
}
