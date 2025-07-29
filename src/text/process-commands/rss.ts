// src/process-commands/rss.ts

import { generateMarkdown } from '../process-steps/01-generate-markdown.ts'
import { downloadAudio, saveAudio } from '../process-steps/02-download-audio.ts'
import { runTranscription } from '../process-steps/03-run-transcription.ts'
import { selectPrompts } from '../process-steps/04-select-prompt.ts'
import { runLLM } from '../process-steps/05-run-llm.ts'
import { saveInfo } from '../utils/save-info.ts'
import { l, err, logSeparator, logInitialFunctionCall } from '../../logging.ts'
import { parser } from '../../node-utils.ts'
import type { ProcessingOptions, ShowNoteMetadata } from '@/types.ts'
function validateRSSOptions(options: ProcessingOptions) {
  if (options.last !== undefined) {
    if (!Number.isInteger(options.last) || options.last < 1) {
      err('Error: The --last option must be a positive integer.')
      process.exit(1)
    }
    if (options.skip !== undefined || options.order !== undefined) {
      err('Error: The --last option cannot be used with --skip or --order.')
      process.exit(1)
    }
  }
  if (options.skip !== undefined && (!Number.isInteger(options.skip) || options.skip < 0)) {
    err('Error: The --skip option must be a non-negative integer.')
    process.exit(1)
  }
  if (options.order !== undefined && !['newest', 'oldest'].includes(options.order)) {
    err("Error: The --order option must be either 'newest' or 'oldest'.")
    process.exit(1)
  }
  if (options.lastDays !== undefined) {
    if (!Number.isInteger(options.lastDays) || options.lastDays < 1) {
      err('Error: The --lastDays option must be a positive integer.')
      process.exit(1)
    }
    if (
      options.last !== undefined ||
      options.skip !== undefined ||
      options.order !== undefined ||
      (options.date && options.date.length > 0)
    ) {
      err('Error: The --lastDays option cannot be used with --last, --skip, --order, or --date.')
      process.exit(1)
    }
  }
  if (options.date && options.date.length > 0) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    for (const d of options.date) {
      if (!dateRegex.test(d)) {
        err(`Error: Invalid date format "${d}". Please use YYYY-MM-DD format.`)
        process.exit(1)
      }
    }
    if (
      options.last !== undefined ||
      options.skip !== undefined ||
      options.order !== undefined
    ) {
      err('Error: The --date option cannot be used with --last, --skip, or --order.')
      process.exit(1)
    }
  }
}
async function filterRSSItems(
  options: ProcessingOptions,
  feedItemsArray?: any,
  channelTitle?: string,
  channelLink?: string,
  channelImage?: string
) {
  const defaultDate = new Date().toISOString().substring(0, 10)
  const unfilteredItems: ShowNoteMetadata[] = (feedItemsArray || [])
    .filter((item: any) => {
      if (!item.enclosure || !item.enclosure.type) return false
      const audioVideoTypes = ['audio/', 'video/']
      return audioVideoTypes.some((type) => item.enclosure.type.startsWith(type))
    })
    .map((item: any) => {
      let publishDate: string
      try {
        const date = item.pubDate ? new Date(item.pubDate) : new Date()
        publishDate = date.toISOString().substring(0, 10)
      } catch {
        publishDate = defaultDate
      }
      return {
        showLink: item.enclosure?.url || '',
        channel: channelTitle || '',
        channelURL: channelLink || '',
        title: item.title || '',
        description: '',
        publishDate,
        coverImage: item['itunes:image']?.href || channelImage || '',
      }
    })
  let itemsToProcess = []
  if (options.item && options.item.length > 0) {
    itemsToProcess = unfilteredItems.filter((it) =>
      options.item!.includes(it.showLink || '')
    )
  } else if (options.lastDays !== undefined) {
    const now = new Date()
    const cutoff = new Date(now.getTime() - options.lastDays * 24 * 60 * 60 * 1000)
    itemsToProcess = unfilteredItems.filter((it) => {
      if (!it.publishDate) return false
      const itDate = new Date(it.publishDate)
      return itDate >= cutoff
    })
  } else if (options.date && options.date.length > 0) {
    const selectedDates = new Set(options.date)
    itemsToProcess = unfilteredItems.filter((it) =>
      it.publishDate && selectedDates.has(it.publishDate)
    )
  } else if (options.last) {
    itemsToProcess = unfilteredItems.slice(0, options.last)
  } else {
    const sortedItems =
      options.order === 'oldest'
        ? unfilteredItems.slice().reverse()
        : unfilteredItems
    itemsToProcess = sortedItems.slice(options.skip || 0)
  }
  return itemsToProcess
}
function getLLMService(options: ProcessingOptions): string | undefined {
  if (options.chatgpt) return 'chatgpt'
  if (options.claude) return 'claude'
  if (options.gemini) return 'gemini'
  return undefined
}
function getTranscriptService(options: ProcessingOptions): string | undefined {
  if (options.deepgram) return 'deepgram'
  if (options.assembly) return 'assembly'
  if (options.whisper) return 'whisper'
  return undefined
}
function logRSSProcessingStatus(
  total: number,
  processing: number,
  options: ProcessingOptions
) {
  if (options.item && options.item.length > 0) {
    l.dim(`\n  - Found ${total} items in the RSS feed.`)
    l.dim(`  - Processing ${processing} specified items.`)
  } else if (options.last) {
    l.dim(`\n  - Found ${total} items in the RSS feed.`)
    l.dim(`  - Processing the last ${options.last} items.`)
  } else {
    l.dim(`\n  - Found ${total} item(s) in the RSS feed.`)
    l.dim(`  - Processing ${processing} item(s) after skipping ${options.skip || 0}.\n`)
  }
}
async function retryRSSFetch(
  fn: () => Promise<Response>
) {
  const maxRetries = 7
  let attempt = 0
  while (attempt < maxRetries) {
    try {
      attempt++
      l.dim(`  Attempt ${attempt} - Fetching RSS...\n`)
      const response = await fn()
      l.dim(`\n  RSS fetch succeeded on attempt ${attempt}.`)
      return response
    } catch (error) {
      err(`  Attempt ${attempt} failed: ${(error as Error).message}`)
      if (attempt >= maxRetries) {
        err(`  Max retries (${maxRetries}) reached. Aborting RSS fetch.`)
        throw error
      }
      const delayMs = 1000 * 2 ** (attempt - 1)
      l.dim(`  Retrying in ${delayMs / 1000} seconds...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw new Error('RSS fetch failed after maximum retries.')
}
async function selectRSSItemsToProcess(
  rssUrl: string,
  options: ProcessingOptions
) {
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
  } catch {}
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
async function processRSSFeeds(
  options: ProcessingOptions,
  expandedRssUrls: string[],
  llmServices?: string,
  transcriptServices?: string
) {
  let allItemsForCombined: ShowNoteMetadata[] = []
  for (const rssUrl of expandedRssUrls) {
    if (options.item && options.item.length > 0) {
      l.dim('\nProcessing specific items:')
      options.item.forEach((url) => l.dim(`  - ${url}`))
    } else if (options.last) {
      l.dim(`\nProcessing the last ${options.last} items`)
    } else if (options.skip) {
      l.dim(`  - Skipping first ${options.skip || 0} items`)
    }
    
    try {
      const { items, channelTitle } = await selectRSSItemsToProcess(rssUrl, options)
      
      if (options.info) {
        if (typeof options.info === 'string' && options.info === 'combined') {
          l.dim(`\nCollecting items from feed: ${channelTitle || rssUrl} for combined output`)
          allItemsForCombined = [...allItemsForCombined, ...items]
          continue
        }
        
        if (items.length > 0) {
          await saveAudio('', true)
          await saveInfo('rss', items, channelTitle || '')
        }
        continue
      }
      
      if (items.length === 0) {
        l.dim('\nNo items found matching the provided criteria for this feed. Skipping...')
        continue
      }
      
      logRSSProcessingStatus(items.length, items.length, options)
      
      const results = []
      for (const [index, item] of items.entries()) {
        logSeparator({
          type: 'rss',
          index,
          total: items.length,
          descriptor: item.title
        })
        l.opts('Parameters passed to processItem:\n')
        l.opts(`  - llmServices: ${llmServices}\n  - transcriptServices: ${transcriptServices}\n`)
        try {
          const { frontMatter, finalPath, filename, metadata } = await generateMarkdown(options, item)
          if (item.showLink) {
            await downloadAudio(options, item.showLink, filename)
          } else {
            throw new Error(`showLink is undefined for item: ${item.title}`)
          }
          const { transcript, modelId: transcriptionModel } = await runTranscription(options, finalPath, transcriptServices)
          const selectedPrompts = await selectPrompts(options)
          const llmOutput = await runLLM(
            options,
            finalPath,
            frontMatter,
            selectedPrompts,
            transcript,
            metadata as ShowNoteMetadata,
            llmServices,
            transcriptServices,
            transcriptionModel
          )
          if (!options.saveAudio) {
            await saveAudio(finalPath)
          }
          results.push({
            frontMatter,
            prompt: selectedPrompts,
            llmOutput: llmOutput || '',
            transcript,
          })
        } catch (error) {
          err(`Error processing item ${item.title}: ${(error as Error).message}`)
          results.push({
            frontMatter: '',
            prompt: '',
            llmOutput: '',
            transcript: '',
          })
        }
      }
    } catch (error) {
      err(`Error processing RSS feed ${rssUrl}: ${(error as Error).message}`)
      throw error
    }
  }
  
  if (options.info === 'combined' && allItemsForCombined.length > 0) {
    l.dim(`\nProcessing combined info for ${allItemsForCombined.length} items from ${expandedRssUrls.length} RSS feeds`)
    allItemsForCombined.sort((a, b) => {
      const dateA = new Date(a.publishDate || '1970-01-01')
      const dateB = new Date(b.publishDate || '1970-01-01')
      return dateB.getTime() - dateA.getTime()
    })
    l.dim(`Sorted ${allItemsForCombined.length} items by publish date (newest first)`)
    await saveAudio('', true)
    await saveInfo('combined', allItemsForCombined, 'combined-feeds')
  }
}
export async function processRSS(
  options: ProcessingOptions,
  llmServicesParam?: string,
  transcriptServicesParam?: string
): Promise<void> {
  logInitialFunctionCall('processRSS', { llmServicesParam, transcriptServicesParam, options })
  const llmServices = llmServicesParam || getLLMService(options)
  const transcriptServices = transcriptServicesParam || getTranscriptService(options)
  l.dim(`[processRSS] Using LLM: ${llmServices || 'none'}, Transcription: ${transcriptServices || 'none'}`)
  if (options.item && !Array.isArray(options.item)) {
    options.item = [options.item]
    l.dim(`[processRSS] Converted item to array: ${options.item.length} items`)
  }
  if (typeof options.rss === 'string') {
    options.rss = [options.rss]
    l.dim(`[processRSS] Converted rss to array: ${options.rss.length} URLs`)
  }
  const expandedRssUrls: string[] = []
  const fsPromises = await import('node:fs/promises')
  const path = await import('node:path')
  for (const rssUrl of options.rss || []) {
    try {
      await fsPromises.access(rssUrl)
      const ext = path.extname(rssUrl).toLowerCase()
      if (ext === '.md') {
        l.dim(`[processRSS] Processing markdown file: ${rssUrl}`)
        const content = await fsPromises.readFile(rssUrl, 'utf8')
        const lines = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'))
        if (lines.length === 0) {
          err(`Error: No RSS URLs found in the .md file: ${rssUrl}`)
          process.exit(1)
        }
        l.dim(`[processRSS] Found ${lines.length} URLs in markdown file`)
        expandedRssUrls.push(...lines)
      } else {
        expandedRssUrls.push(rssUrl)
      }
    } catch {
      expandedRssUrls.push(rssUrl)
    }
  }
  options.rss = expandedRssUrls
  validateRSSOptions(options)
  const rssUrls = options.rss
  if (!rssUrls || rssUrls.length === 0) {
    l.dim(`[processRSS] No valid RSS URLs found`)
    throw new Error(`No valid RSS URLs provided for processing`)
  }
  l.dim(`[processRSS] Processing ${rssUrls.length} RSS URLs`)
  await processRSSFeeds(options, rssUrls, llmServices, transcriptServices)
}