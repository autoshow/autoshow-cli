import { l, err } from '@/logging'
import { parser } from '@/node-utils'
import { filterRSSItems } from './filters.ts'
import type { ProcessingOptions, ShowNoteMetadata } from '@/types'

export async function retryRSSFetch(
  fn: () => Promise<Response>
): Promise<Response> {
  const p = '[text/process-commands/rss/fetch]'
  l.dim(`${p} Starting RSS fetch with retry logic`)
  const maxRetries = 7
  let attempt = 0
  
  while (attempt < maxRetries) {
    try {
      attempt++
      l.dim(`${p} Attempt ${attempt} - Fetching RSS...\n`)
      const response = await fn()
      l.dim(`${p} RSS fetch succeeded on attempt ${attempt}`)
      return response
    } catch (error) {
      err(`${p} Attempt ${attempt} failed: ${(error as Error).message}`)
      if (attempt >= maxRetries) {
        err(`${p} Max retries (${maxRetries}) reached. Aborting RSS fetch.`)
        throw error
      }
      const delayMs = 1000 * 2 ** (attempt - 1)
      l.dim(`${p} Retrying in ${delayMs / 1000} seconds...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw new Error('RSS fetch failed after maximum retries.')
}

export async function selectRSSItemsToProcess(
  rssUrl: string,
  options: ProcessingOptions
): Promise<{ items: ShowNoteMetadata[], channelTitle: string }> {
  const p = '[text/process-commands/rss/fetch]'
  l.dim(`${p} Processing RSS URL: ${rssUrl}`)
  
  try {
    const fsPromises = await import('node:fs/promises')
    await fsPromises.access(rssUrl)
    l.dim(`${p} Reading RSS from local file`)
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
    l.dim(`${p} Local file processed: ${itemsToProcess.length} items`)
    return { items: itemsToProcess, channelTitle: channelTitle || '' }
  } catch {
    l.dim(`${p} Local file not found, attempting remote fetch`)
  }
  
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  
  try {
    l.dim(`${p} Fetching RSS from remote URL`)
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
    l.dim(`${p} Remote feed processed: ${itemsToProcess.length} items`)
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