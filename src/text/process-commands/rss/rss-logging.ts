import { l } from '@/logging'
import type { ProcessingOptions } from '@/types'

export function logRSSProcessingStatus(
  total: number,
  processing: number,
  options: ProcessingOptions
): void {
  const p = '[text/process-commands/rss/logging]'
  l.dim(`${p} Logging RSS processing status`)
  
  if (options.item && options.item.length > 0) {
    l.dim(`\n  - Found ${total} items in the RSS feed.`)
    l.dim(`  - Processing ${processing} specified items.`)
  } else if (options.last) {
    l.dim(`\n  - Found ${total} items in the RSS feed.`)
    l.dim(`  - Processing the last ${options.last} items.`)
  } else if (options.days) {
    l.dim(`\n  - Found ${total} items in the RSS feed.`)
    l.dim(`  - Processing ${processing} items from the last ${options.days} days.\n`)
  } else {
    l.dim(`\n  - Found ${total} item(s) in the RSS feed.`)
    l.dim(`  - Processing ${processing} item(s).\n`)
  }
  
  l.dim(`${p} Status logged for ${processing}/${total} items`)
}