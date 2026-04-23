

import type { ProcessCommand, RuntimeOptions } from '~/types'
import { commandSupportsBatchSourceExpansion } from '~/cli/commands/process-steps/process-command-kinds'
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
  if (!commandSupportsBatchSourceExpansion(command)) return null
  if (!input.startsWith('http')) return null

  const batchOpts = {
    limit: opts.batchLimit,
    all: opts.batchAll,
    order: opts.batchOrder
  }

  const ytSource = await tryEnumerateYoutubeChannel(input, batchOpts)
  if (ytSource) {
    const totalCount = ytSource.items.length
    const selected = selectBatchItems(ytSource.items, batchOpts)
    const sourceWithSelected: BatchSource = { ...ytSource, items: selected }
    return {
      source: sourceWithSelected,
      selectedUrls: selected.map(i => i.url),
      selectedItems: selected,
      totalCount
    }
  }

  const rssSource = await tryEnumeratePodcastFeed(input)
  if (rssSource) {
    const totalCount = rssSource.items.length
    const selected = selectBatchItems(rssSource.items, batchOpts)
    const sourceWithSelected: BatchSource = { ...rssSource, items: selected }
    return {
      source: sourceWithSelected,
      selectedUrls: selected.map(i => i.url),
      selectedItems: selected,
      totalCount
    }
  }

  return null
}
