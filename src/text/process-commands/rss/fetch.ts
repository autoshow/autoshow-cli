import { err } from '@/logging'
import { parser } from '@/node-utils'
import { filterRSSItems } from './filters'
import type { ProcessingOptions, ShowNoteMetadata } from '@/text/text-types'

export async function retryRSSFetch(
  fn: () => Promise<Response>
): Promise<Response> {
  const maxRetries = 7
  let attempt = 0
  
  while (attempt < maxRetries) {
    try {
      attempt++
      const response = await fn()
      return response
    } catch (error) {
      if (attempt >= maxRetries) {
        err('Max retries reached. Aborting RSS fetch', { maxRetries })
        throw error
      }
      const delayMs = 1000 * 2 ** (attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw new Error('RSS fetch failed after maximum retries.')
}

export async function selectRSSItemsToProcess(
  rssUrl: string,
  options: ProcessingOptions
): Promise<{ items: ShowNoteMetadata[], channelTitle: string }> {
  try {
    const fsPromises = await import('node:fs/promises')
    await fsPromises.access(rssUrl)
    const text = await fsPromises.readFile(rssUrl, 'utf8')
    const feed = parser.parse(text)
    const {
      title: channelTitle,
      link: channelLink,
      image: channelImageObject,
      item: feedItems,
    } = feed.rss.channel
    const feedItemsArray = Array.isArray(feedItems) ? feedItems : [feedItems]
    if (!feedItemsArray || feedItemsArray.length === 0) {
      err('Error: No items found in the RSS feed.')
      process.exit(1)
    }
    const itemsToProcess = await filterRSSItems(
      options,
      feedItemsArray,
      channelTitle,
      channelLink,
      channelImageObject?.url
    )
    return { items: itemsToProcess, channelTitle: channelTitle || '' }
  } catch {
    // Not a local file, try remote fetch
  }
  
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  
  try {
    const response = await retryRSSFetch(
      () => fetch(rssUrl, {
        method: 'GET',
        headers: { Accept: 'application/rss+xml' },
        signal: controller.signal,
      })
    )
    clearTimeout(timeout)
    
    if (!response.ok) {
      err('HTTP error', { status: response.status })
      process.exit(1)
    }
    
    const text = await response.text()
    const feed = parser.parse(text)
    const {
      title: channelTitle,
      link: channelLink,
      image: channelImageObject,
      item: feedItems,
    } = feed.rss.channel
    const feedItemsArray = Array.isArray(feedItems) ? feedItems : [feedItems]
    if (!feedItemsArray || feedItemsArray.length === 0) {
      err('Error: No items found in the RSS feed.')
      process.exit(1)
    }
    const itemsToProcess = await filterRSSItems(
      options,
      feedItemsArray,
      channelTitle,
      channelLink,
      channelImageObject?.url
    )
    return { items: itemsToProcess, channelTitle: channelTitle || '' }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      err('Error: Fetch request timed out.')
    } else {
      err('Error fetching RSS feed', { error: (error as Error).message })
    }
    process.exit(1)
  }
}