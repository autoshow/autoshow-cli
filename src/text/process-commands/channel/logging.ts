import { l } from '../../../logging.ts'
import type { ProcessingOptions } from '@/types.ts'

export function logChannelProcessingStatus(
  total: number,
  processing: number,
  options: ProcessingOptions
): void {
  l.dim('[logChannelProcessingStatus] Logging channel processing status')
  
  if (options.last) {
    l.dim(`\n  - Found ${total} videos in the channel.`)
    l.dim(`  - Processing the last ${processing} videos.`)
  } else if (options.days) {
    l.dim(`\n  - Found ${total} videos in the channel.`)
    l.dim(`  - Processing ${processing} videos from the last ${options.days} days.\n`)
  } else if (options.date && options.date.length > 0) {
    l.dim(`\n  - Found ${total} videos in the channel.`)
    l.dim(`  - Processing ${processing} videos from specified dates: ${options.date.join(', ')}.\n`)
  } else {
    l.dim(`\n  - Found ${total} videos in the channel.`)
    l.dim(`  - Processing all ${processing} videos.\n`)
  }
  
  l.dim(`[logChannelProcessingStatus] Status logged for ${processing}/${total} videos`)
}