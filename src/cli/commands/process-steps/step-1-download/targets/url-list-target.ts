import * as l from '~/logger'
import type { BatchItem, ProcessCommand, ResolvedBatch, RuntimeOptions } from '~/types'
import { isSttCommand } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { processBatch, readInputList } from './target-utils'
import { processSingleTarget } from './single-target'
import { selectBatchItems } from './batch/batch-select'
import { runSttBatch, throwIfSttBatchIncomplete } from '../../step-2-stt/stt-batch'

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
  if (isSttCommand(command)) {
    const result = await runSttBatch(resolvedBatch.selectedUrls, 'inputs', opts, {
      source: resolvedBatch.source,
      selectedItems: resolvedBatch.selectedItems,
      concurrency: opts.batchConcurrency,
      totalCount: resolvedBatch.totalCount
    })
    throwIfSttBatchIncomplete(result)
    return
  }

  const { ok, incomplete, fail, failureExitCode } = await processBatch(
    resolvedBatch.selectedUrls,
    'inputs',
    command,
    opts,
    async (commandName, item, batchDir, batchOpts, batchItem) =>
      await processSingleTarget(commandName, item, batchDir, batchOpts, undefined, undefined, batchItem),
    {
      source: resolvedBatch.source,
      selectedItems: resolvedBatch.selectedItems,
      concurrency: opts.batchConcurrency,
      totalCount: resolvedBatch.totalCount
    }
  )
  if ((isSttCommand(command) && (incomplete > 0 || fail > 0)) || (!isSttCommand(command) && ok === 0 && fail > 0)) {
    const problemCount = isSttCommand(command) ? incomplete + fail : fail
    const error = new Error(`Batch processing failed for ${problemCount} item(s)`)
    if (failureExitCode !== undefined) {
      ;(error as Error & { exitCode?: number }).exitCode = failureExitCode
    }
    throw error
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
