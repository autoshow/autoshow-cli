import { l, err } from '../../../logging.ts'
import { parser } from '../../../node-utils.ts'
import { filterRSSItems } from './filters.ts'
import type { ProcessingOptions, ShowNoteMetadata } from '@/types.ts'

export async function retryRSSFetch(
  fn: () => Promise<Response>
): Promise<Response> {
  l.dim('[retryRSSFetch] Starting RSS fetch with retry logic')
  const maxRetries = 7
  let attempt = 0
  
  while (attempt < maxRetries) {
    try {
      attempt++
      l.dim(`[retryRSSFetch] Attempt ${attempt} - Fetching RSS...\n`)
      const response = await fn()
      l.dim(`[retryRSSFetch] RSS fetch succeeded on attempt ${attempt}`)
      return response
    } catch (error) {
      err(`[retryRSSFetch] Attempt ${attempt} failed: ${(error as Error).message}`)
      if (attempt >= maxRetries) {
        err(`[retryRSSFetch] Max retries (${maxRetries}) reached. Aborting RSS fetch.`)
        throw error
      }
      const delayMs = 1000 * 2 ** (attempt - 1)
      l.dim(`[retryRSSFetch] Retrying in ${delayMs / 1000} seconds...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw new Error('RSS fetch failed after maximum retries.')
}

export async function selectRSSItemsToProcess(
  rssUrl: string,
  options: ProcessingOptions
): Promise<{ items: ShowNoteMetadata[], channelTitle: string }> {
  l.dim(`[selectRSSItemsToProcess] Processing RSS URL: ${rssUrl}`)
  
  try {
    const fsPromises = await import('node:fs/promises')
    await fsPromises.access(rssUrl)
    l.dim('[selectRSSItemsToProcess] Reading RSS from local file')
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
    l.dim(`[selectRSSItemsToProcess] Local file processed: ${itemsToProcess.length} items`)
    return { items: itemsToProcess, channelTitle: channelTitle || '' }
  } catch {
    l.dim('[selectRSSItemsToProcess] Local file not found, attempting remote fetch')
  }
  
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  
  try {
    l.dim('[selectRSSItemsToProcess] Fetching RSS from remote URL')
    const response = await retryRSSFetch(
      () => fetch(rssUrl, {
        method: 'GET',
        headers: { Accept: 'application/rss+xml' },
        signal: controller.signal,
      })
    )
    clearTimeout(timeout)
    
    if (!response.ok) {
      err(`HTTP error! status: ${response.status}`)
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
    l.dim(`[selectRSSItemsToProcess] Remote feed processed: ${itemsToProcess.length} items`)
    return { items: itemsToProcess, channelTitle: channelTitle || '' }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      err('Error: Fetch request timed out.')
    } else {
      err(`Error fetching RSS feed: ${(error as Error).message}`)
    }
    process.exit(1)
  }
}