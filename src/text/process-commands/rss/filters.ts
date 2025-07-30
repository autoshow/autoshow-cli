import { l } from '../../../logging.ts'
import type { ProcessingOptions, ShowNoteMetadata } from '@/types.ts'

export async function filterRSSItems(
  options: ProcessingOptions,
  feedItemsArray?: any,
  channelTitle?: string,
  channelLink?: string,
  channelImage?: string
): Promise<ShowNoteMetadata[]> {
  l.dim('[filterRSSItems] Starting RSS item filtering')
  l.dim(`[filterRSSItems] Input: ${feedItemsArray?.length || 0} items`)
  
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
  
  l.dim(`[filterRSSItems] Filtered to ${unfilteredItems.length} audio/video items`)
  
  let itemsToProcess = []
  if (options.item && options.item.length > 0) {
    l.dim('[filterRSSItems] Applying item URL filter')
    itemsToProcess = unfilteredItems.filter((it) =>
      options.item!.includes(it.showLink || '')
    )
    l.dim(`[filterRSSItems] Item filter result: ${itemsToProcess.length} items`)
  } else if (options.days !== undefined) {
    l.dim(`[filterRSSItems] Applying days filter: ${options.days} days`)
    const now = new Date()
    const cutoff = new Date(now.getTime() - options.days * 24 * 60 * 60 * 1000)
    itemsToProcess = unfilteredItems.filter((it) => {
      if (!it.publishDate) return false
      const itDate = new Date(it.publishDate)
      return itDate >= cutoff
    })
    l.dim(`[filterRSSItems] Days filter result: ${itemsToProcess.length} items`)
  } else if (options.date && options.date.length > 0) {
    l.dim(`[filterRSSItems] Applying date filter: ${options.date.join(', ')}`)
    const selectedDates = new Set(options.date)
    itemsToProcess = unfilteredItems.filter((it) =>
      it.publishDate && selectedDates.has(it.publishDate)
    )
    l.dim(`[filterRSSItems] Date filter result: ${itemsToProcess.length} items`)
  } else if (options.last) {
    l.dim(`[filterRSSItems] Applying last filter: ${options.last} items`)
    itemsToProcess = unfilteredItems.slice(0, options.last)
    l.dim(`[filterRSSItems] Last filter result: ${itemsToProcess.length} items`)
  } else {
    const sortedItems =
      options.order === 'oldest'
        ? unfilteredItems.slice().reverse()
        : unfilteredItems
    itemsToProcess = sortedItems
    l.dim(`[filterRSSItems] No specific filter, using all ${itemsToProcess.length} items`)
  }
  
  l.dim(`[filterRSSItems] Final filtered items: ${itemsToProcess.length}`)
  return itemsToProcess
}