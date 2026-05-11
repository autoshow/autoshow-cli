import { createHumanTable } from '~/utils/logger/human-table'
import type { HumanLogTable, LogLevel, SetupToolStatus, TableLogger } from '~/types'

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
  logger: TableLogger,
  summary: SetupToolStatus,
  level: LogLevel = summary.status === 'installed' || summary.status === 'ready' || summary.status === 'ok' ? 'success' : 'info'
): void => {
  logger.write(level, 'Setup Tool Status', {
    category: 'command',
    humanTable: buildSetupToolStatusTable(summary),
    metadata: summary
  })
}

export const buildProviderReadinessTable = (
  summary: {
    provider: string
    capability: string
    status: 'ready' | 'missing'
    envKey?: string | undefined
    detail?: string | undefined
  }
): HumanLogTable =>
  createHumanTable([{
    provider: summary.provider,
    capability: summary.capability,
    status: summary.status,
    envKey: summary.envKey ?? '',
    detail: summary.detail ?? ''
  }], ['provider', 'capability', 'status', 'envKey', 'detail'])

export const logProviderReadiness = (
  logger: TableLogger,
  summary: {
    provider: string
    capability: string
    status: 'ready' | 'missing'
    envKey?: string | undefined
    detail?: string | undefined
  }
): void => {
  logger.write(summary.status === 'ready' ? 'success' : 'warn', 'Provider Readiness', {
    category: 'command',
    humanTable: buildProviderReadinessTable(summary),
    metadata: summary
  })
}
