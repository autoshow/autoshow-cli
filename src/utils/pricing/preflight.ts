import type { PreflightResult, ProcessCommand, RuntimeOptions } from '~/types'
import { buildAggregatedPriceEstimate } from './aggregate-pricing'
import { CLIUsageError } from '~/utils/error-handler'
import * as l from '~/utils/logger'
import { createKeyValueTable } from '~/utils/logger/human-table'

export const runPreflight = async (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: RuntimeOptions,
  maxCents: number | undefined,
  characterCount?: number,
  context: { ttsInputText?: string | undefined } = {}
): Promise<PreflightResult> => {
  const estimate = await buildAggregatedPriceEstimate(command, resolvedTarget, opts, characterCount, context)
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
    l.write('warn', 'Pricing Budget', {
      category: 'pricing',
      humanTable: createKeyValueTable([
        ['estimatedCost', formatCents(estimate.totalEstimatedCost)],
        ['budget', formatCents(maxCents)],
        ['action', 'continuing because --allow-over-budget is set']
      ]),
      metadata: {
        estimatedCostCents: estimate.totalEstimatedCost,
        budgetCents: maxCents,
        allowOverBudget: true
      }
    })
  }

  return { estimate, shouldExit: false }
}

const formatCents = (amount: number): string => `${amount.toFixed(3)}¢`
