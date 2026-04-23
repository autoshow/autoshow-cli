import type { BatchSource, BatchItem } from '~/types'
import { parsePodcastFeedXml } from './podcast-rss'

const PODCAST_HOST_PATTERNS: RegExp[] = [
  /feeds\.megaphone\.fm/i,
  /anchor\.fm/i,
  /feeds\.transistor\.fm/i,
  /feeds\.simplecast\.com/i,
  /feeds\.libsyn\.com/i,
  /feeds\.soundcloud\.com/i,
  /feeds\.buzzsprout\.com/i,
  /feeds\.podbean\.com/i,
  /rss\.art19\.com/i,
  /omnycontent\.com/i,
  /feeds\.captivate\.fm/i,
  /media\.rss\.com/i
]

const looksLikeFeedUrl = (url: string): boolean => {
  const lower = url.toLowerCase()
  if (
    lower.includes('/feed') ||
    lower.includes('/rss') ||
    lower.endsWith('.xml') ||
    lower.endsWith('/feed.xml') ||
    lower.endsWith('/podcast')
  ) {
    return true
  }
  return PODCAST_HOST_PATTERNS.some(p => p.test(url))
}

const isFeedContentType = (contentType: string | null): boolean => {
  if (!contentType) return false
  return /application\/(rss|atom)\+xml|text\/xml|application\/xml/.test(contentType)
}

export const tryEnumeratePodcastFeed = async (url: string): Promise<BatchSource | null> => {
  if (!url.startsWith('http')) return null

  const isLikelyFeed = looksLikeFeedUrl(url)

  if (!isLikelyFeed) {

    try {
      const head = await fetch(url, { method: 'HEAD', redirect: 'follow' })
      if (!isFeedContentType(head.headers.get('content-type'))) return null
    } catch {
      return null
    }
  }

  let xml: string
  try {
    const resp = await fetch(url, { redirect: 'follow' })
    if (!resp.ok) return null
    xml = await resp.text()
  } catch {
    return null
  }

  const parsed = parsePodcastFeedXml(xml, url)
  if (!parsed || parsed.episodes.length === 0) return null

  const feedAuthor = parsed.author ?? parsed.title

  const items: BatchItem[] = parsed.episodes
    .filter(ep => ep.enclosureUrl.length > 0)
    .map(ep => {
      const item: BatchItem = {
        id: ep.id ?? ep.enclosureUrl,
        url: ep.enclosureUrl,

        directDownload: true
      }
      if (ep.title) item.title = ep.title
      if (feedAuthor) item.author = feedAuthor
      if (ep.pubDate) item.publishedAt = ep.pubDate
      if (ep.duration) item.duration = ep.duration
      return item
    })

  if (items.length === 0) return null

  const source: BatchSource = {
    sourceKind: 'podcast_rss',
    sourceUrl: url,
    items
  }
  if (parsed.title) source.title = parsed.title
  if (parsed.author) source.author = parsed.author
  if (parsed.image) source.image = parsed.image
  if (parsed.link) source.link = parsed.link

  return source
}
