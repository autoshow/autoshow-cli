

import {
  scanTagBlocks,
  firstTagText,
  firstTagAttr,
  firstStartTag,
  readAttr
} from '~/utils/xml-scan'
import type { ParsedEpisode, ParsedFeed } from '~/types'


const parseRss2Episodes = (xml: string): ParsedEpisode[] =>
  scanTagBlocks(xml, 'item').map(block => ({
    id: firstTagText(block, 'guid') ?? firstTagAttr(block, 'enclosure', 'url'),
    enclosureUrl: firstTagAttr(block, 'enclosure', 'url') ?? '',
    title: firstTagText(block, 'title'),
    pubDate: firstTagText(block, 'pubDate'),

    duration: firstTagText(block, 'itunes:duration') ?? firstTagText(block, 'duration')
  })).filter(ep => ep.enclosureUrl !== '')

const parseAtomEntries = (xml: string): ParsedEpisode[] =>
  scanTagBlocks(xml, 'entry').map(block => {

    let enclosureUrl = ''
    for (const linkBlock of scanTagBlocks(block, 'link')) {
      const tag = firstStartTag(linkBlock, 'link')
      if (tag && readAttr(tag, 'rel') === 'enclosure') {
        enclosureUrl = readAttr(tag, 'href') ?? ''
        break
      }
    }

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
