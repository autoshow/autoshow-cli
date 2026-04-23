import type { BatchSource, BatchItem } from '~/types'
import { exec } from '~/utils/cli-utils'
import * as l from '~/utils/logger'
import type { YtDlpFlatEntry, YtDlpListOptions } from '~/types'
import { buildYtDlpFailureMessage, buildYtDlpListArgs } from '../audio/yt-dlp-options'

const YOUTUBE_CHANNEL_PATH_PATTERNS = [
  /^\/@[^/]+\/?$/,
  /^\/channel\/[^/]+\/?$/,
  /^\/c\/[^/]+\/?$/,
  /^\/user\/[^/]+\/?$/
]

const isYoutubeHostname = (hostname: string): boolean =>
  hostname === 'youtube.com' ||
  hostname === 'www.youtube.com' ||
  hostname === 'youtu.be' ||
  hostname === 'm.youtube.com'

export const isYoutubeChannelUrl = (url: string): boolean => {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (!isYoutubeHostname(parsed.hostname.toLowerCase())) return false

  const path = parsed.pathname

  if (path === '/playlist' && parsed.searchParams.has('list')) return true

  if (YOUTUBE_CHANNEL_PATH_PATTERNS.some(p => p.test(path))) return true

  if (/^\/@[^/]+\/(videos|shorts|streams)\/?$/.test(path)) return true
  if (/^\/channel\/[^/]+\/(videos|shorts|streams)\/?$/.test(path)) return true

  return false
}

const ensureAbsoluteYoutubeUrl = (idOrUrl: string): string => {
  if (!idOrUrl) return ''
  if (idOrUrl.startsWith('http://') || idOrUrl.startsWith('https://')) return idOrUrl
  return `https://www.youtube.com/watch?v=${idOrUrl}`
}

export const buildYoutubeChannelListArgs = async (
  url: string,
  opts: YtDlpListOptions & { limit: number; all: boolean; order: 'newest' | 'oldest' }
): Promise<string[]> => await buildYtDlpListArgs(url, opts)

const parseUploadDate = (uploadDate: string | undefined): string | undefined => {
  if (!uploadDate || uploadDate.length !== 8) return undefined
  return `${uploadDate.slice(0, 4)}-${uploadDate.slice(4, 6)}-${uploadDate.slice(6, 8)}`
}

const parseEntry = (raw: unknown): BatchItem | null => {
  const j = raw as YtDlpFlatEntry
  const id = j.id ?? ''
  const rawUrl = j.webpage_url ?? j.url ?? ''
  const itemUrl = ensureAbsoluteYoutubeUrl(rawUrl || id)
  if (!itemUrl) return null

  const item: BatchItem = {
    id: id || itemUrl,
    url: itemUrl

  }
  if (j.title) item.title = j.title
  const author = j.uploader ?? j.channel
  if (author) item.author = author
  const publishedAt = parseUploadDate(j.upload_date)
  if (publishedAt) item.publishedAt = publishedAt
  if (j.duration != null) item.duration = String(j.duration)

  return item
}

export const tryEnumerateYoutubeChannel = async (
  url: string,
  batchOpts: { limit: number; all: boolean; order: 'newest' | 'oldest' } = { limit: 5, all: false, order: 'newest' }
): Promise<BatchSource | null> => {
  if (!isYoutubeChannelUrl(url)) return null

  l.write('info', `Enumerating YouTube channel/playlist: ${url}`)

  const args = await buildYoutubeChannelListArgs(url, batchOpts)
  const res = await exec('yt-dlp', args)

  if (res.exitCode !== 0) {
    l.warn(buildYtDlpFailureMessage('list', res.stderr || res.stdout || `failed to enumerate ${url}`))
    return null
  }

  const lines = res.stdout
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  const items: BatchItem[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    let parsed: unknown
    try {
      parsed = JSON.parse(line)
    } catch {
      continue
    }

    const item = parseEntry(parsed)
    if (!item || seen.has(item.url)) continue
    seen.add(item.url)
    items.push(item)
  }

  if (items.length === 0) {
    l.write('info', `No items found in YouTube channel/playlist: ${url}`)
    return null
  }

  l.write('success', `Found ${items.length} items in YouTube channel/playlist`)

  const channelTitle = items[0]?.author

  const source: BatchSource = {
    sourceKind: url.includes('playlist?list=') ? 'youtube_playlist' : 'youtube_channel',
    sourceUrl: url,
    items
  }
  if (channelTitle) source.title = channelTitle

  return source
}
