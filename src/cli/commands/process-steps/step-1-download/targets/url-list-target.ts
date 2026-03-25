import * as l from '~/logger'
import type { ProcessCommand, RuntimeOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { processBatch, readInputList } from './target-utils'
import { processSingleTarget } from './single-target'
import { selectBatchItems } from './batch/batch-select'

export const handleInputListTargetBatch = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: RuntimeOptions
): Promise<void> => {
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
  const batchItems = items.map((item, index) => ({
    id: String(index + 1),
    url: item
  }))
  const selectedItems = selectBatchItems(batchItems, batchOpts)
  const selectedUrls = selectedItems.map(item => item.url)

  const source = {
    sourceKind: 'url_list' as const,
    sourceUrl: resolvedTarget,
    title: 'Input list',
    items: selectedItems
  }
  const { ok, fail } = await processBatch(selectedUrls, 'inputs', command, opts, processSingleTarget, {
    source,
    selectedItems,
    concurrency: opts.batchConcurrency,
    totalCount: items.length
  })
  if (ok === 0 && fail > 0) {
    throw new Error(`Batch processing failed for ${fail} item(s)`)
  }
}
