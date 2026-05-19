import { join } from 'node:path'
import * as l from '~/utils/logger'
import { logLocationsTable } from '~/utils/logger/human-table'
import { runWithLogContext } from '~/utils/logger'
import { ensureDirectory, writeFile } from '~/utils/cli-utils'
import { createUniqueDirectoryName } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { isSttPartialCompletionError } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/batch'
import { writeSttBatchManifest } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/manifest'
import { writeBatchManifest } from '~/cli/commands/process-steps/manifest-utils'
import { joinOutputRoot } from '~/cli/commands/process-steps/output-root'
import type { BatchItemProcessor, BatchManifestErrorEntry, BatchManifestEntry, BatchProcessResult, BatchRunOptions, ProcessCommand, RuntimeOptions } from '~/types'
import { attachOutputDir, buildBatchManifestEntryForItem, getBatchManifestCompletionStatus, getBatchManifestErrorCount, getBatchManifestErrors, getErrorOutputDir, readBatchManifestEntry, toManifestKind } from './batch-manifest'
import { buildBatchPartialFailureTable, buildSttBatchItemDetail, logBatchCompletionTable, logBatchItemStatus } from './batch-summary'

const formatProviderFailureDetail = (count: number): string =>
  String(count) + ' provider failure' + (count === 1 ? '' : 's')

const runWithSemaphore = async <T>(
  max: number,
  sem: { active: number },
  fn: () => Promise<T>
): Promise<T> => {
  while (sem.active >= max) {
    await new Promise<void>(r => setTimeout(r, 50))
  }
  sem.active++
  try {
    return await fn()
  } finally {
    sem.active--
  }
}

export const processBatch = async (
  items: string[],
  batchLabel: string,
  command: ProcessCommand,
  opts: RuntimeOptions,
  processSingleTarget: BatchItemProcessor,
  runOpts: BatchRunOptions = {}
): Promise<BatchProcessResult> => {
  const sttLike = command === 'extract' && runOpts.extractRoute === 'media'
  const prefilledEntries = runOpts.initialEntries ? [...runOpts.initialEntries] : undefined

  if (items.length === 0 && (!prefilledEntries || prefilledEntries.length === 0)) {
    l.warn('No inputs to process')
    return { ok: 0, partial: 0, incomplete: 0, fail: 0 }
  }

  if (typeof runOpts.totalCount === 'number' && runOpts.totalCount > items.length) {
    const selectedCount = prefilledEntries?.length ?? items.length
    if (selectedCount < runOpts.totalCount) {
      if (items.length < selectedCount) {
        l.warn(`Processing ${items.length} runnable items from ${selectedCount} selected of ${runOpts.totalCount} total. Some selected inputs were skipped as unsupported for this command; use --batch-all to select more items.`)
      } else {
        l.warn(`Processing ${items.length} of ${runOpts.totalCount} items. Use --batch-all to process all.`)
      }
    } else {
      l.warn(`Processing ${items.length} of ${selectedCount} selected items. Some inputs were skipped as unsupported for this command.`)
    }
  }

  const batchDirName = createUniqueDirectoryName(batchLabel)
  const batchDir = runOpts.parentBatchDir
    ? join(runOpts.parentBatchDir, runOpts.extractRoute ?? toManifestKind(command))
    : joinOutputRoot(batchDirName)
  await ensureDirectory(batchDir)
  logLocationsTable(l, [{ artifact: 'outputDir', path: batchDir }])

  if (runOpts.source) {
    const sourceData = {
      sourceKind: runOpts.source.sourceKind,
      sourceUrl: runOpts.source.sourceUrl,
      title: runOpts.source.title,
      author: runOpts.source.author,
      selectedCount: prefilledEntries?.length ?? items.length
    }
    await writeFile(`${batchDir}/source.json`, JSON.stringify(sourceData, null, 2))
  }

  const batchSource = runOpts.source
    ? {
        sourceKind: runOpts.source.sourceKind,
        sourceUrl: runOpts.source.sourceUrl,
        title: runOpts.source.title,
        author: runOpts.source.author,
        selectedCount: prefilledEntries?.length ?? items.length
      }
    : undefined

  let infoEntries: BatchManifestEntry[]
  if (prefilledEntries && prefilledEntries.length > 0) {
    infoEntries = prefilledEntries
  } else if (runOpts.selectedItems && runOpts.selectedItems.length > 0) {
    infoEntries = runOpts.selectedItems.map((item, index) =>
      item
        ? buildBatchManifestEntryForItem(item.url, item)
        : buildBatchManifestEntryForItem(items[index] ?? `item-${index + 1}`)
    )
  } else {
    infoEntries = items.map((item) => buildBatchManifestEntryForItem(item))
  }

  if (infoEntries.length === 0) {
    l.warn('No supported inputs to process')
    return { ok: 0, partial: 0, incomplete: 0, fail: 0, batchDir }
  }

  await writeBatchManifest(batchDir, toManifestKind(command), infoEntries, batchSource)
  logLocationsTable(l, [{ artifact: 'batchManifest', path: `${batchDir}/batch.json` }])

  const concurrency = Math.max(1, runOpts.concurrency ?? 1)
  let ok = 0
  let partial = 0
  let incomplete = 0
  let fail = 0
  let failureExitCode: number | undefined
  let hasMixedFailureCodes = false
  const finalInfoEntries = [...infoEntries]
  const partialFailureEntries: BatchManifestErrorEntry[] = []
  const resultEntryIndexes = runOpts.resultEntryIndexes ?? items.map((_, index) => index)

  const recordFailureExitCode = (error: unknown): void => {
    const exitCode = error instanceof Error && 'exitCode' in error
      ? (error as Error & { exitCode?: unknown }).exitCode
      : undefined
    if (typeof exitCode !== 'number' || !Number.isFinite(exitCode) || exitCode < 1) {
      hasMixedFailureCodes = true
      return
    }
    if (failureExitCode === undefined) {
      failureExitCode = exitCode
      return
    }
    if (failureExitCode !== exitCode) {
      hasMixedFailureCodes = true
    }
  }

  const executeBatchItem = async (
    item: string,
    index: number
  ): Promise<{
    manifestEntry: BatchManifestEntry | null
    errorCount: number
    status: 'ok' | 'partial' | 'incomplete' | 'failed'
    failureError?: unknown
  }> =>
    await runWithLogContext({ batchId: batchDirName, itemIndex: index + 1, itemCount: items.length }, async () => {
      logBatchItemStatus('info', item, 'processing')

      try {
        const batchItem = runOpts.selectedItems?.[index]
        const processed = await processSingleTarget(command, item, batchDir, opts, batchItem)
        const manifestEntry = processed?.manifestEntry
          ? (processed.outputDir ? attachOutputDir(processed.manifestEntry, processed.outputDir) : processed.manifestEntry)
          : processed?.outputDir
            ? attachOutputDir(await readBatchManifestEntry(processed.outputDir, command), processed.outputDir)
            : null
        const errorCount = getBatchManifestErrorCount(manifestEntry)

        if (sttLike) {
          const completionStatus = getBatchManifestCompletionStatus(manifestEntry) ?? (errorCount > 0 ? 'incomplete' : 'full')
          if (completionStatus === 'full') {
            logBatchItemStatus('success', item, 'done')
            return { manifestEntry, errorCount, status: 'ok' }
          }

          if (completionStatus === 'failed') {
            logBatchItemStatus('error', item, 'failed', 'no STT provider outputs completed')
            return { manifestEntry, errorCount, status: 'failed' }
          }

          logBatchItemStatus('warn', item, 'incomplete', buildSttBatchItemDetail(manifestEntry))
          return { manifestEntry, errorCount, status: 'incomplete' }
        }

        if (errorCount > 0) {
          logBatchItemStatus('warn', item, 'done', formatProviderFailureDetail(errorCount))
          return { manifestEntry, errorCount, status: 'partial' }
        }

        logBatchItemStatus('success', item, 'done')
        return { manifestEntry, errorCount, status: 'ok' }
      } catch (error) {
        if (sttLike && isSttPartialCompletionError(error)) {
          const manifestEntry = attachOutputDir(await readBatchManifestEntry(error.outputDir, command), error.outputDir)
          const errorCount = getBatchManifestErrorCount(manifestEntry)
          if (error.completionStatus === 'failed') {
            logBatchItemStatus('error', item, 'failed', error.message)
            return { manifestEntry, errorCount, status: 'failed', failureError: error }
          }

          logBatchItemStatus('warn', item, 'incomplete', buildSttBatchItemDetail(manifestEntry))
          return { manifestEntry, errorCount, status: 'incomplete', failureError: error }
        }

        const errorOutputDir = getErrorOutputDir(error)
        if (errorOutputDir && !sttLike) {
          const manifestEntry = attachOutputDir(await readBatchManifestEntry(errorOutputDir, command), errorOutputDir)
          const errorCount = getBatchManifestErrorCount(manifestEntry)
          const completionStatus = getBatchManifestCompletionStatus(manifestEntry) ?? (errorCount > 0 ? 'incomplete' : undefined)

          if (completionStatus === 'failed') {
            logBatchItemStatus('error', item, 'failed', error instanceof Error ? error.message : String(error))
            return { manifestEntry, errorCount, status: 'failed', failureError: error }
          }

          if (completionStatus === 'incomplete') {
            logBatchItemStatus('warn', item, 'done', formatProviderFailureDetail(errorCount))
            return { manifestEntry, errorCount, status: 'partial', failureError: error }
          }
        }

        const message = error instanceof Error ? error.message : String(error)
        logBatchItemStatus('error', item, 'failed', message)
        return { manifestEntry: null, errorCount: 0, status: 'failed', failureError: error }
      }
    })

  if (concurrency === 1) {
    for (let index = 0; index < items.length; index++) {
      const item = items[index] as string
      const result = await executeBatchItem(item, index)
      if (result.manifestEntry) {
        const entryIndex = resultEntryIndexes[index] ?? index
        finalInfoEntries[entryIndex] = {
          ...(finalInfoEntries[entryIndex] ?? {}),
          ...result.manifestEntry
        }
      }
      partialFailureEntries.push(...getBatchManifestErrors(result.manifestEntry))

      if (result.status === 'ok') {
        ok++
      } else if (result.status === 'partial') {
        ok++
        partial++
      } else if (result.status === 'incomplete') {
        incomplete++
        recordFailureExitCode(result.failureError)
      } else {
        fail++
        recordFailureExitCode(result.failureError)
      }
    }
  } else {
    l.write('info', `Processing ${items.length} items with concurrency ${concurrency}`)
    const sem = { active: 0 }
    const results = await Promise.allSettled(
      items.map((item, index) =>
        runWithSemaphore(concurrency, sem, async () => await executeBatchItem(item, index))
      )
    )
    for (const [index, r] of results.entries()) {
      if (r.status === 'fulfilled') {
        if (r.value.manifestEntry) {
          const entryIndex = resultEntryIndexes[index] ?? index
          finalInfoEntries[entryIndex] = {
            ...(finalInfoEntries[entryIndex] ?? {}),
            ...r.value.manifestEntry
          }
        }
        partialFailureEntries.push(...getBatchManifestErrors(r.value.manifestEntry))

        if (r.value.status === 'ok') {
          ok++
        } else if (r.value.status === 'partial') {
          ok++
          partial++
        } else if (r.value.status === 'incomplete') {
          incomplete++
          recordFailureExitCode(r.value.failureError)
        } else {
          fail++
          recordFailureExitCode(r.value.failureError)
        }
      } else {
        fail++
        recordFailureExitCode(r.reason)
        const message = r.reason instanceof Error ? r.reason.message : String(r.reason)
        l.error(`Batch item failed: ${message}`)
      }
    }
  }

  if (partialFailureEntries.length > 0) {
    const partialFailureTable = buildBatchPartialFailureTable(partialFailureEntries)
    if (partialFailureTable.rows.length > 0) {
      l.write('warn', 'Partial provider failures', {
        category: 'pipeline',
        humanTable: partialFailureTable,
        metadata: {
          failures: partialFailureTable.rows
        }
      })
    }
  }

  logBatchCompletionTable(command, ok, partial, incomplete, fail, sttLike)
  if (sttLike) {
    await writeSttBatchManifest(batchDir, finalInfoEntries, batchSource)
  } else {
    await writeBatchManifest(batchDir, toManifestKind(command), finalInfoEntries, batchSource)
  }

  return {
    ok,
    partial,
    incomplete,
    fail,
    batchDir,
    ...(!hasMixedFailureCodes && failureExitCode !== undefined ? { failureExitCode } : {})
  }
}
