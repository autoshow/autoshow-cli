import * as l from '~/logger'
import type { BatchItem, ProcessCommand, ResolvedBatch, RuntimeOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { processBatch, readInputList } from './target-utils'
import { processSingleTarget } from './single-target'
import { selectBatchItems } from './batch/batch-select'

const buildInputListBatchItems = (items: string[]): BatchItem[] =>
  items.map((item, index) => ({
    id: String(index + 1),
    url: item
  }))

export const resolveInputListBatch = async (
  resolvedTarget: string,
  opts: RuntimeOptions
): Promise<ResolvedBatch> => {
  l.info(`Reading inputs from ${resolvedTarget}`)
  const items = await readInputList(resolvedTarget)
  if (items.length === 0) {
    throw CLIUsageError(`No valid inputs found in ${resolvedTarget}. Provide newline-delimited URLs or local file paths in a .md or .txt file.`)
  }

  const batchOpts = {
    limit: opts.batchLimit,
    all: opts.batchAll,
    order: opts.batchOrder
  }
  const selectedItems = selectBatchItems(buildInputListBatchItems(items), batchOpts)

  return {
    source: {
      sourceKind: 'url_list',
      sourceUrl: resolvedTarget,
      title: 'Input list',
      items: selectedItems
    },
    selectedUrls: selectedItems.map(item => item.url),
    selectedItems,
    totalCount: items.length
  }
}

export const processResolvedInputListBatch = async (
  resolvedBatch: ResolvedBatch,
  command: ProcessCommand,
  opts: RuntimeOptions
): Promise<void> => {
  const { ok, fail } = await processBatch(resolvedBatch.selectedUrls, 'inputs', command, opts, processSingleTarget, {
    source: resolvedBatch.source,
    selectedItems: resolvedBatch.selectedItems,
    concurrency: opts.batchConcurrency,
    totalCount: resolvedBatch.totalCount
  })
  if (ok === 0 && fail > 0) {
    throw new Error(`Batch processing failed for ${fail} item(s)`)
  }
}

export const handleInputListTargetBatch = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: RuntimeOptions
): Promise<void> => {
  const resolvedBatch = await resolveInputListBatch(resolvedTarget, opts)
  await processResolvedInputListBatch(resolvedBatch, command, opts)
}
