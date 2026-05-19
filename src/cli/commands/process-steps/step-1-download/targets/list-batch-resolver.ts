import type { BatchItem, ProcessCommand, ResolvedBatch, RuntimeOptions } from '~/types'
import { selectBatchItems } from './batch/batch-select'
import { tryResolveBatchSource } from './batch/batch-router'

const buildInputListBatchItems = (items: string[]): BatchItem[] =>
  items.map((item, index) => ({
    id: String(index + 1),
    url: item
  }))

export const resolveListBatchItems = async (
  items: string[],
  sourceUrl: string,
  command: ProcessCommand,
  opts: RuntimeOptions
): Promise<ResolvedBatch> => {
  const batchOpts = {
    limit: opts.batchLimit,
    all: opts.batchAll,
    order: opts.batchOrder
  }

  const selectedListItems = selectBatchItems(buildInputListBatchItems(items), batchOpts)
  const flattenedLeafItems = (await Promise.all(selectedListItems.map(async (item) => {
    const resolved = await tryResolveBatchSource(item.url, command, opts)
    return resolved?.selectedItems.length ? resolved.selectedItems : [item]
  }))).flat()

  return {
    source: {
      sourceKind: 'url_list',
      sourceUrl,
      title: 'Input list',
      items: flattenedLeafItems
    },
    selectedUrls: flattenedLeafItems.map(item => item.url),
    selectedItems: flattenedLeafItems,
    totalCount: flattenedLeafItems.length
  }
}
