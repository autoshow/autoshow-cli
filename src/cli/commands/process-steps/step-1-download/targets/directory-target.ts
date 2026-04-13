import * as l from '~/logger'
import type { ProcessCommand, RuntimeOptions } from '~/types'
import { isOcrCommand } from '~/types'
import { collectInputFiles, isDocumentByExtension, isInputDirectoryPath, processBatch, readInputList } from './target-utils'
import { processSingleTarget } from './single-target'

export const handleDirectoryTargetBatch = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: RuntimeOptions
): Promise<void> => {
  const allFiles = await collectInputFiles(resolvedTarget)
  const files = isOcrCommand(command)
    ? allFiles.filter(file => isDocumentByExtension(file))
    : allFiles
  const includeUrlsFromInputDir = isInputDirectoryPath(resolvedTarget)
  const listedInputs = includeUrlsFromInputDir ? await readInputList(`${resolvedTarget}/2-urls.md`) : []
  const all = includeUrlsFromInputDir ? [...files, ...listedInputs] : files

  if (all.length === 0) {
    l.warn(`No inputs found in ${resolvedTarget}`)
    return
  }

  const label = includeUrlsFromInputDir ? 'input' : 'files'
  const { ok, fail, failureExitCode } = await processBatch(all, label, command, opts, processSingleTarget, {
    concurrency: opts.batchConcurrency
  })
  if (ok === 0 && fail > 0) {
    const error = new Error(`Batch processing failed for ${fail} item(s)`)
    if (failureExitCode !== undefined) {
      ;(error as Error & { exitCode?: number }).exitCode = failureExitCode
    }
    throw error
  }
}
