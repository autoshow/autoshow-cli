import * as l from '~/utils/logger'
import type { ProcessCommand, RuntimeOptions } from '~/types'
import type { BatchItem } from '~/types'
import { isSttCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { collectInputFiles, isInputDirectoryPath, planBatchInputsForCommand, processBatch, readInputList } from './target-utils'
import { processSingleTarget } from './single-target'
import { runSttBatch, throwIfSttBatchIncomplete } from '../../step-2-extract/step-2-stt/batch'
import { collectTextInputFiles } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { resolveListBatchItems } from './list-batch-resolver'

export const handleDirectoryTargetBatch = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: RuntimeOptions
): Promise<void> => {
  const allFiles = command === 'write' && opts.textInput
    ? await collectTextInputFiles(resolvedTarget)
    : await collectInputFiles(resolvedTarget)
  const includeUrlsFromInputDir = !opts.textInput && isInputDirectoryPath(resolvedTarget)
  const listedInputEntries = includeUrlsFromInputDir ? await readInputList(`${resolvedTarget}/2-urls.md`) : []
  const resolvedListedInputs = listedInputEntries.length > 0
    ? await resolveListBatchItems(listedInputEntries, `${resolvedTarget}/2-urls.md`, command, opts)
    : undefined
  const listedInputs = resolvedListedInputs?.selectedUrls ?? []
  const all = includeUrlsFromInputDir ? [...allFiles, ...listedInputs] : allFiles

  if (all.length === 0) {
    l.warn(`No inputs found in ${resolvedTarget}`)
    return
  }

  const selectedItems: Array<BatchItem | undefined> | undefined = includeUrlsFromInputDir
    ? [
        ...allFiles.map(() => undefined),
        ...(resolvedListedInputs?.selectedItems ?? [])
      ]
    : undefined
  const batchPlan = await planBatchInputsForCommand(command, all, opts, selectedItems)

  const label = command === 'write' && opts.textInput
    ? 'text'
    : includeUrlsFromInputDir
      ? 'input'
      : 'files'
  if (isSttCommand(command)) {
    const result = await runSttBatch(batchPlan.items, label, opts, {
      ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
      initialEntries: batchPlan.initialEntries,
      resultEntryIndexes: batchPlan.resultEntryIndexes,
      concurrency: opts.batchConcurrency
    })
    throwIfSttBatchIncomplete(result)
    return
  }

  const { ok, incomplete, fail, failureExitCode } = await processBatch(batchPlan.items, label, command, opts, async (commandName, item, batchDir, batchOpts, batchItem) =>
    await processSingleTarget(commandName, item, batchDir, batchOpts, undefined, {
      batchChildContext: {
        batchDir,
        ...(batchItem ? { batchItem } : {})
      }
    }, batchItem), {
    ...(batchPlan.selectedItems ? { selectedItems: batchPlan.selectedItems } : {}),
    initialEntries: batchPlan.initialEntries,
    resultEntryIndexes: batchPlan.resultEntryIndexes,
    concurrency: opts.batchConcurrency
  })
  if ((isSttCommand(command) && (incomplete > 0 || fail > 0)) || (!isSttCommand(command) && ok === 0 && fail > 0)) {
    const problemCount = isSttCommand(command) ? incomplete + fail : fail
    const error = new Error(`Batch processing failed for ${problemCount} item(s)`)
    if (failureExitCode !== undefined) {
      ;(error as Error & { exitCode?: number }).exitCode = failureExitCode
    }
    throw error
  }
}
