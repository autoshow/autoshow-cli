import { createSingleRowTable } from '~/utils/logger/human-table'
import { formatEstimatedCost } from '~/utils/logger/formatters'
import type { HumanLogTable, SuitePriceSummary, TableLogger } from '~/types'

export const buildSuitePriceSummaryRows = (
  summary: SuitePriceSummary
): Array<{ checked: string, totalEstimatedCost: string }> => [{
  checked: `${summary.checkedCount} ${summary.checkedLabel}`,
  totalEstimatedCost: formatEstimatedCost(summary.totalEstimatedCost)
}]

const buildSuitePriceSummaryTable = (
  summary: SuitePriceSummary
): HumanLogTable =>
  createSingleRowTable(buildSuitePriceSummaryRows(summary)[0]!, ['checked', 'totalEstimatedCost'])

export const logSuitePriceSummary = (
  logger: TableLogger,
  summary: SuitePriceSummary
): void => {
  logger.write('info', 'Suite Cost Summary', {
    category: 'pricing',
    humanTable: buildSuitePriceSummaryTable(summary),
    metadata: summary
  })
}
