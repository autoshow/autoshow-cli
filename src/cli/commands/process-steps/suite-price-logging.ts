import { createSingleRowTable } from '~/logger/human-table'
import type { HumanLogTable, Logger } from '~/logger/types'

type TableLogger = Pick<Logger, 'write'>

export type SuitePriceSummary = {
  checkedLabel: string
  checkedCount: number
  totalEstimatedCost: number
}

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
  logger: TableLogger,
  summary: SuitePriceSummary
): void => {
  logger.write('info', 'Suite Cost Summary', {
    category: 'pricing',
    humanTable: buildSuitePriceSummaryTable(summary),
    metadata: summary
  })
}
