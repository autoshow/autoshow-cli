import * as l from '~/utils/logger'
import type { ProcessCommand, ResolvedBatch, RuntimeOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { planBatchInputsForCommand, processBatch, readInputList } from './target-utils'
import { processSingleTarget } from './single-target'
import { resolveListBatchItems } from './list-batch-resolver'

export const resolveInputListBatch = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: RuntimeOptions
): Promise<ResolvedBatch> => {
  l.write('info', `Reading inputs from ${resolvedTarget}`)
  const items = await readInputList(resolvedTarget)
  if (items.length === 0) {
    throw CLIUsageError(`No valid inputs found in ${resolvedTarget}. Provide newline-delimited URLs or local file paths in a .md or .txt file.`)
  }

  return await resolveListBatchItems(items, resolvedTarget, command, opts)
}

export const processResolvedInputListBatch = async (
  resolvedBatch: ResolvedBatch,
  command: ProcessCommand,
  opts: RuntimeOptions
): Promise<void> => {
  const batchPlan = await planBatchInputsForCommand(
    command,
    resolvedBatch.selectedUrls,
    opts,
    resolvedBatch.selectedItems
  )

  const { ok, fail, failureExitCode } = await processBatch(
    batchPlan.items,
    'inputs',
    command,
    opts,
    async (commandName, item, batchDir, batchOpts, batchItem) =>
      await processSingleTarget(commandName, item, batchDir, batchOpts, undefined, {
        batchChildContext: {
          batchDir,
          ...(batchItem ? { batchItem } : {})
        }
      }, batchItem),
    {
      source: resolvedBatch.source,
      ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
      initialEntries: batchPlan.initialEntries,
      resultEntryIndexes: batchPlan.resultEntryIndexes,
      concurrency: opts.batchConcurrency,
      totalCount: resolvedBatch.totalCount
    }
  )
  if (ok === 0 && fail > 0) {
    const error = new Error(`Batch processing failed for ${fail} item(s)`)
    if (failureExitCode !== undefined) {
      ;(error as Error & { exitCode?: number }).exitCode = failureExitCode
    }
    throw error
  }
}
