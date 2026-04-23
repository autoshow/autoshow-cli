import * as l from '~/logger'
import type { ProcessCommand, ResolvedBatch, RuntimeOptions } from '~/types'
import { isSttCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { CLIUsageError } from '~/utils/error-handler'
import { planBatchInputsForCommand, processBatch, readInputList } from './target-utils'
import { processSingleTarget } from './single-target'
import { runSttBatch, throwIfSttBatchIncomplete } from '../../step-2-stt/batch'
import { resolveListBatchItems } from './list-batch-resolver'

export const resolveInputListBatch = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: RuntimeOptions
): Promise<ResolvedBatch> => {
  l.info(`Reading inputs from ${resolvedTarget}`)
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

  if (isSttCommand(command)) {
    const result = await runSttBatch(batchPlan.items, 'inputs', opts, {
      source: resolvedBatch.source,
      ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
      initialEntries: batchPlan.initialEntries,
      resultEntryIndexes: batchPlan.resultEntryIndexes,
      concurrency: opts.batchConcurrency,
      totalCount: resolvedBatch.totalCount
    })
    throwIfSttBatchIncomplete(result)
    return
  }

  const { ok, incomplete, fail, failureExitCode } = await processBatch(
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
  const resolvedBatch = await resolveInputListBatch(resolvedTarget, command, opts)
  await processResolvedInputListBatch(resolvedBatch, command, opts)
}
