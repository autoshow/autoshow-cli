import * as l from '~/logger'
import type { ProcessCommand, RuntimeOptions } from '~/types'
import { isOcrCommand, isSttCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { collectInputFiles, isDocumentByExtension, isInputDirectoryPath, processBatch, readInputList } from './target-utils'
import { processSingleTarget } from './single-target'
import { runSttBatch, throwIfSttBatchIncomplete } from '../../step-2-stt/batch'
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
  const files = isOcrCommand(command)
    ? allFiles.filter(file => isDocumentByExtension(file))
    : allFiles
  const includeUrlsFromInputDir = !opts.textInput && isInputDirectoryPath(resolvedTarget)
  const listedInputEntries = includeUrlsFromInputDir ? await readInputList(`${resolvedTarget}/2-urls.md`) : []
  const listedInputs = listedInputEntries.length > 0
    ? (await resolveListBatchItems(listedInputEntries, `${resolvedTarget}/2-urls.md`, command, opts)).selectedUrls
    : []
  const all = includeUrlsFromInputDir ? [...files, ...listedInputs] : files

  if (all.length === 0) {
    l.warn(`No inputs found in ${resolvedTarget}`)
    return
  }

  const label = command === 'write' && opts.textInput
    ? 'text'
    : includeUrlsFromInputDir
      ? 'input'
      : 'files'
  if (isSttCommand(command)) {
    const result = await runSttBatch(all, label, opts, {
      concurrency: opts.batchConcurrency
    })
    throwIfSttBatchIncomplete(result)
    return
  }

  const { ok, incomplete, fail, failureExitCode } = await processBatch(all, label, command, opts, async (commandName, item, batchDir, batchOpts, batchItem) =>
    await processSingleTarget(commandName, item, batchDir, batchOpts, undefined, {
      batchChildContext: {
        batchDir,
        ...(batchItem ? { batchItem } : {})
      }
    }, batchItem), {
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
