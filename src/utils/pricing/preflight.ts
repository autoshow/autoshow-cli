import type { ProcessCommand, RuntimeOptions } from '~/types'
import { buildAggregatedPriceEstimate } from './aggregate-pricing'
import type { AggregatedPriceEstimate } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/logger'

export type PreflightResult = {
  estimate: AggregatedPriceEstimate
  shouldExit: boolean
}

export const runPreflight = async (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: RuntimeOptions,
  maxCents: number | undefined,
  characterCount?: number
): Promise<PreflightResult> => {
  const estimate = await buildAggregatedPriceEstimate(command, resolvedTarget, opts, characterCount)
  l.report.estimate(estimate)

  if (opts.price) {
    return { estimate, shouldExit: true }
  }

  if (maxCents !== undefined && estimate.totalEstimatedCost > maxCents) {
    if (!opts.allowOverBudget) {
      throw CLIUsageError(
        `Estimated cost ${formatCents(estimate.totalEstimatedCost)} exceeds configured budget ${formatCents(maxCents)}. Use --allow-over-budget to proceed.`
      )
    }
    l.warn(`Estimated cost ${formatCents(estimate.totalEstimatedCost)} exceeds budget ${formatCents(maxCents)} — continuing because --allow-over-budget is set.`)
  }

  return { estimate, shouldExit: false }
}

const formatCents = (amount: number): string => `${amount.toFixed(4)}¢`
