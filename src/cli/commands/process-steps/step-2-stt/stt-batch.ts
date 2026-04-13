import * as l from '~/logger'
import type { BatchProcessResult, BatchRunOptions, RuntimeOptions } from '~/types'
import { collectSttTargets } from './stt-targets'
import { SttBatchCoordinator } from './stt-batch-coordinator'
import { runResumeSttMissingFromBatchDir } from './resume-stt-batch'
import { processBatch } from '../step-1-download/targets/target-utils'
import { processSingleTarget } from '../step-1-download/targets/single-target'

export class SttBatchIncompleteError extends Error {
  readonly exitCode: number
  readonly batchDir?: string
  readonly full: number
  readonly incomplete: number
  readonly failed: number

  constructor(result: BatchProcessResult) {
    super(`STT batch incomplete: ${result.ok} full, ${result.incomplete} incomplete, ${result.fail} failed${result.batchDir ? `. See ${result.batchDir}` : ''}`)
    this.name = 'SttBatchIncompleteError'
    this.exitCode = 2
    if (result.batchDir) {
      this.batchDir = result.batchDir
    }
    this.full = result.ok
    this.incomplete = result.incomplete
    this.failed = result.fail
  }
}

const shouldEnableCoordinator = (
  items: string[],
  opts: RuntimeOptions
): boolean => items.length > 1 && collectSttTargets(opts).length > 1

export const runSttBatch = async (
  items: string[],
  batchLabel: string,
  opts: RuntimeOptions,
  runOpts: BatchRunOptions = {}
): Promise<BatchProcessResult> => {
  const coordinator = shouldEnableCoordinator(items, opts)
    ? new SttBatchCoordinator()
    : undefined

  let result = await processBatch(
    items,
    batchLabel,
    'stt',
    opts,
    async (command, item, batchDir, batchOpts) =>
      await processSingleTarget(command, item, batchDir, batchOpts, undefined, {
        ...(coordinator ? { sttBatchCoordinator: coordinator } : {})
      }),
    runOpts
  )

  if (coordinator && result.batchDir && (result.incomplete > 0 || result.fail > 0)) {
    l.warn(`Starting automatic STT batch backfill for retryable missing providers: ${result.batchDir}`)
    result = await runResumeSttMissingFromBatchDir(result.batchDir, opts, undefined, {
      retryableOnly: true,
      maxPasses: 2,
      ignoreUnresumableEntries: true
    })
  }

  return result
}

export const throwIfSttBatchIncomplete = (
  result: BatchProcessResult
): void => {
  if (result.incomplete > 0 || result.fail > 0) {
    throw new SttBatchIncompleteError(result)
  }
}
