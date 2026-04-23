import { createSingleRowTable } from '~/utils/logger/human-table'
import type { HumanLogTable, SuitePriceSummary, SuitePriceTableLogger } from '~/types'

export const buildSuitePriceSummaryRows = (
  summary: SuitePriceSummary
): Array<{ checked: string, totalEstimatedCost: string }> => [{
  checked: `${summary.checkedCount} ${summary.checkedLabel}`,
  totalEstimatedCost: `${summary.totalEstimatedCost.toFixed(5)}¢`
}]

export const buildSuitePriceSummaryTable = (
  summary: SuitePriceSummary
): HumanLogTable =>
  createSingleRowTable(buildSuitePriceSummaryRows(summary)[0]!, ['checked', 'totalEstimatedCost'])

export const logSuitePriceSummary = (
  logger: SuitePriceTableLogger,
  summary: SuitePriceSummary
): void => {
  logger.write('info', 'Suite Cost Summary', {
    category: 'pricing',
    humanTable: buildSuitePriceSummaryTable(summary),
    metadata: summary
  })
}
