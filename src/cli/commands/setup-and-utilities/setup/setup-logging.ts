import { createHumanTable } from '~/utils/logger/human-table'
import type { HumanLogTable, LogLevel, SetupTableLogger, SetupToolStatus } from '~/types'

export const buildSetupToolStatusRows = (
  summary: SetupToolStatus
): Array<{ tool: string, status: string, detail: string }> => [{
  tool: summary.tool,
  status: summary.status,
  detail: summary.detail ?? ''
}]

export const buildSetupToolStatusTable = (
  summary: SetupToolStatus
): HumanLogTable =>
  createHumanTable(buildSetupToolStatusRows(summary), ['tool', 'status', 'detail'])

export const logSetupToolStatus = (
  logger: SetupTableLogger,
  summary: SetupToolStatus,
  level: LogLevel = summary.status === 'installed' || summary.status === 'ready' || summary.status === 'ok' ? 'success' : 'info'
): void => {
  logger.write(level, 'Setup Tool Status', {
    category: 'command',
    humanTable: buildSetupToolStatusTable(summary),
    metadata: summary
  })
}
