import { l } from '@/logging'
import type { ProcessingOptions } from '@/text/text-types'

export function logChannelProcessingStatus(
  total: number,
  processing: number,
  options: ProcessingOptions
): void {
  if (options.last) {
    l('\n  - Found videos in the channel', { total })
    l('  - Processing the last videos', { count: processing })
  } else if (options.days) {
    l('\n  - Found videos in the channel', { total })
    l('  - Processing videos from the last days', { count: processing, days: options.days })
  } else if (options.date && options.date.length > 0) {
    l('\n  - Found videos in the channel', { total })
    l('  - Processing videos from specified dates', { count: processing, dates: options.date.join(', ') })
  } else {
    l('\n  - Found videos in the channel', { total })
    l('  - Processing all videos', { count: processing })
  }
}