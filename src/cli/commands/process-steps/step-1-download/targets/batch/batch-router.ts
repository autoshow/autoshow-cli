

import type { ProcessCommand, RuntimeOptions } from '~/types'
import type { BatchSource } from './batch-types'
import { selectBatchItems } from './batch-select'
import { tryEnumerateYoutubeChannel } from '../youtube-channel-provider'
import { tryEnumeratePodcastFeed } from '../podcast-rss-provider'
import type { ResolvedBatch } from '~/types'


export const tryResolveBatchSource = async (
  input: string,
  command: ProcessCommand,
  opts: RuntimeOptions
): Promise<ResolvedBatch | null> => {
  if (command === 'extract') return null
  if (!input.startsWith('http')) return null

  const batchOpts = {
    limit: opts.batchLimit,
    all: opts.batchAll,
    order: opts.batchOrder
  }

  const ytSource = await tryEnumerateYoutubeChannel(input, batchOpts)
  if (ytSource) {
    const selected = selectBatchItems(ytSource.items, batchOpts)
    const sourceWithSelected: BatchSource = { ...ytSource, items: selected }
    return {
      source: sourceWithSelected,
      selectedUrls: selected.map(i => i.url),
      selectedItems: selected
    }
  }

  const rssSource = await tryEnumeratePodcastFeed(input)
  if (rssSource) {
    const selected = selectBatchItems(rssSource.items, batchOpts)
    const sourceWithSelected: BatchSource = { ...rssSource, items: selected }
    return {
      source: sourceWithSelected,
      selectedUrls: selected.map(i => i.url),
      selectedItems: selected
    }
  }

  return null
}
