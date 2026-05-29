import * as l from '~/utils/logger'
import type { ProcessCommand, ResolvedBatch, RuntimeOptions } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import { readInputList } from './target-utils'
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
