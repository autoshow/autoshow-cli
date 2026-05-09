import * as l from '~/utils/logger'
import { logSingleRowTable } from '~/utils/logger/human-table'
import { logSuitePriceSummary } from '~/cli/commands/process-steps/suite-price-logging'
import { isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { buildAggregatedPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import type { ProcessCommand, RuntimeOptions } from '~/types'

const runWithConcurrency = async <T,>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> => {
  const normalizedConcurrency = Math.max(1, concurrency)
  let nextIndex = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= items.length) {
        return
      }
      await worker(items[currentIndex] as T, currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(normalizedConcurrency, items.length) }, async () => {
      await runWorker()
    })
  )
}

export const reportSuitePriceEstimate = async (
  command: ProcessCommand,
  targets: string[],
  opts: RuntimeOptions
): Promise<number> => {
  logSingleRowTable(l, 'Suite Price Estimate', {
    itemType: targets.length === 1 ? 'target' : 'targets',
    itemCount: targets.length
  }, { category: 'pricing', columns: ['itemType', 'itemCount'] })

  let suiteTotalEstimatedCost = 0
  const concurrency = isExtractCommand(command) ? opts.sttPreflightConcurrency : 1

  await runWithConcurrency(targets, concurrency, async (item) => {
    const estimate = await buildAggregatedPriceEstimate(command, item, opts, undefined)
    l.report.estimate(estimate)
    suiteTotalEstimatedCost += estimate.totalEstimatedCost
  })

  logSuitePriceSummary(l, {
    checkedLabel: targets.length === 1 ? 'command' : 'commands',
    checkedCount: targets.length,
    totalEstimatedCost: suiteTotalEstimatedCost
  })

  return suiteTotalEstimatedCost
}

export const formatCents = (amount: number): string => `${amount.toFixed(4)}¢`

export const shouldRunCommandPreflight = (
  opts: Pick<RuntimeOptions, 'price'>,
  maxCents: number | undefined
): boolean => opts.price || maxCents !== undefined
