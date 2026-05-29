import { createHumanTable } from '~/utils/logger/human-table'
import type { HumanLogTable, LogLevel, SetupToolStatus, TableLogger } from '~/types'
import type { HostedProviderStatus } from './hosted-provider-config'

type SetupToolStatusRow = {
  tool: string
  status: string
  detail?: string
  path?: string
}

const isPathLikeDetail = (detail: string): boolean => {
  const value = detail.trim()
  return /^(?:\.{1,2}[\\/]|~[\\/]|[\\/]|[A-Za-z]:[\\/])/.test(value)
    || value.includes('\\')
    || value.split('/').length > 2
}

const buildSetupToolStatusRows = (
  summary: SetupToolStatus
): SetupToolStatusRow[] => {
  const detail = summary.detail ?? ''
  return [{
    tool: summary.tool,
    status: summary.status,
    ...(detail.length > 0
      ? isPathLikeDetail(detail) ? { path: detail } : { detail }
      : { detail: '' })
  }]
}

export const buildSetupToolStatusTable = (
  summary: SetupToolStatus
): HumanLogTable => {
  const rows = buildSetupToolStatusRows(summary)
  const pathRow = rows.find(row => row.path !== undefined)
  if (pathRow?.path !== undefined) {
    const table = createHumanTable(
      rows.map(({ path: _path, ...row }) => row),
      ['tool', 'status']
    )
    return {
      ...table,
      details: [
        ...(table.details ?? []),
        { label: 'path', value: pathRow.path }
      ]
    }
  }

  return createHumanTable(
    rows,
    ['tool', 'status', 'detail']
  )
}

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
    status: HostedProviderStatus
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
