import { l } from '@/logging'
import type { ProcessingOptions, ShowNoteMetadata } from '@/types'

export async function filterRSSItems(
  options: ProcessingOptions,
  feedItemsArray?: any,
  channelTitle?: string,
  channelLink?: string,
  channelImage?: string
): Promise<ShowNoteMetadata[]> {
  const p = '[text/process-commands/rss/filters]'
  
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
  } else if (options.days !== undefined) {
    const now = new Date()
    const cutoff = new Date(now.getTime() - options.days * 24 * 60 * 60 * 1000)
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
    itemsToProcess = sortedItems
  }
  
  if (itemsToProcess.length === 0 && unfilteredItems.length > 0) {
    l.warn(`${p} No items matched the filter criteria`)
  }
  
  return itemsToProcess
}