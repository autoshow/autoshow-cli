import { paint, terminalPalette, terminalStyles } from '~/utils/terminal-colors'
import type { LogCategory, LogLevel } from '~/types'

type TableCellColorContext = {
  column: string
  value: string
  row: Readonly<Record<string, string>>
}

const CATEGORY_COLORS: Partial<Record<LogCategory, string>> = {
  command: terminalPalette.info,
  artifact: terminalPalette.path,
  pricing: terminalPalette.cost,
  usage: 'lightsalmon'
}

const STATUS_COLORS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:fail(?:ed)?|failure|errors?|errored|blocked|invalid|rejected|denied|unavailable)\b/, terminalPalette.error],
  [/\b(?:missing|skipped?|incomplete|partial|miss|none|empty|not found|warning)\b/, terminalPalette.warning],
  [/\b(?:success|succeeded|completed?|done|ok|ready|passed|hit|found|available|full)\b/, terminalPalette.success],
  [/\b(?:started|starting|running|pending|planned|queued|waiting|active|in[- ]?progress|progress)\b/, terminalPalette.pending]
]

const normalizeColumn = (column: string): string =>
  column.trim().replace(/[^a-z0-9]+/gi, '').toLowerCase()

const normalizeValue = (value: string): string =>
  value.trim().toLowerCase()

const preserveOuterWhitespace = (value: string, color: string): string => {
  const leadingWhitespace = value.match(/^\s*/)?.[0] ?? ''
  const trailingWhitespace = value.match(/\s*$/)?.[0] ?? ''
  const core = value.slice(leadingWhitespace.length, value.length - trailingWhitespace.length)
  return core.length === 0
    ? value
    : `${leadingWhitespace}${paint(core, color)}${trailingWhitespace}`
}

const semanticColumn = (context: TableCellColorContext): string => {
  const column = normalizeColumn(context.column)
  if (column !== 'value') {
    return context.column
  }

  const key = context.row['key'] ?? context.row['setting'] ?? context.row['metric']
  return key && key.length > 0 ? key : context.column
}

const colorFromMatchers = (
  value: string,
  matchers: ReadonlyArray<readonly [RegExp, string]>
): string | undefined => {
  const normalized = normalizeValue(value)
  for (const [pattern, color] of matchers) {
    if (pattern.test(normalized)) {
      return color
    }
  }
  return undefined
}

const colorizeStatusValue = (value: string): string => {
  const color = colorFromMatchers(value, STATUS_COLORS)
  return color ? preserveOuterWhitespace(value, color) : value
}

const colorizePathValue = (value: string): string => {
  const slashIndex = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'))
  if (slashIndex < 0 || slashIndex >= value.length - 1) {
    return preserveOuterWhitespace(value, terminalPalette.pathBase)
  }

  return preserveOuterWhitespace(value, terminalPalette.path)
}

const colorizeStreamValue = (value: string): string => {
  const normalized = normalizeValue(value)
  if (normalized === 'stderr') {
    return preserveOuterWhitespace(value, terminalPalette.warning)
  }
  if (normalized === 'stdout') {
    return preserveOuterWhitespace(value, terminalPalette.info)
  }
  return terminalStyles.info(value)
}

const isStatusColumn = (column: string): boolean =>
  column === 'status'
  || column === 'state'
  || column === 'action'
  || column === 'result'
  || column === 'outcome'
  || column.endsWith('status')
  || column.endsWith('state')
  || column.endsWith('action')

const isPathColumn = (column: string): boolean =>
  column === 'path'
  || column === 'file'
  || column === 'filename'
  || column === 'input'
  || column === 'output'
  || column === 'source'
  || column === 'destination'
  || column === 'dir'
  || column === 'location'
  || column.endsWith('path')
  || column.endsWith('file')
  || column.includes('filename')

const isArtifactColumn = (column: string): boolean =>
  column === 'artifact' || column.endsWith('artifact')

const isCostColumn = (column: string): boolean =>
  column.includes('cost')
  || column.includes('price')
  || column.includes('cents')

const isDurationColumn = (column: string): boolean =>
  column.includes('duration')
  || column.includes('time')
  || column.includes('timing')
  || column.includes('elapsed')
  || column.includes('latency')
  || column.endsWith('ms')
  || column.endsWith('seconds')

const isThroughputColumn = (column: string): boolean =>
  column.includes('speed')
  || column.includes('throughput')
  || column.includes('persecond')
  || column.includes('fps')

const isCountColumn = (column: string): boolean =>
  column === 'page'
  || column === 'pages'
  || column === 'total'
  || column === 'count'
  || column === 'attempt'
  || column.endsWith('page')
  || column.endsWith('pages')
  || column.endsWith('count')
  || column.endsWith('counts')
  || column.endsWith('concurrency')
  || column.endsWith('attempt')
  || column.endsWith('attempts')

const isStreamColumn = (column: string): boolean =>
  column === 'stream'
  || column.endsWith('stream')

const isProviderModelColumn = (column: string): boolean =>
  column === 'providermodel'
  || column === 'providerandmodel'
  || column === 'target'

const isProviderColumn = (column: string): boolean =>
  column === 'provider'
  || column === 'service'
  || column === 'engine'
  || column.endsWith('provider')
  || column.endsWith('service')

const isModelColumn = (column: string): boolean =>
  column === 'model'
  || column === 'modelid'
  || column.endsWith('model')
  || column.endsWith('modelid')

const isRemoteIdColumn = (column: string): boolean =>
  column === 'id'
  || column === 'remoteid'
  || column === 'jobid'
  || column === 'requestid'
  || column === 'operationid'
  || column === 'operationname'
  || column.endsWith('remoteid')
  || column.endsWith('jobid')
  || column.endsWith('requestid')
  || column.endsWith('operationid')
  || column.endsWith('operationname')

export const colorizeHumanTableBorder = (value: string): string =>
  terminalStyles.muted(value)

export const colorizeHumanTableHeader = (value: string): string =>
  terminalStyles.muted(value)

export const colorizeHumanTableCell = (context: TableCellColorContext): string => {
  if (context.value.length === 0) {
    return context.value
  }

  const column = normalizeColumn(semanticColumn(context))
  const value = context.value

  if (isStreamColumn(column)) {
    return colorizeStreamValue(value)
  }
  if (isStatusColumn(column)) {
    return colorizeStatusValue(value)
  }
  if (isCostColumn(column) || value.includes('\u00a2')) {
    return terminalStyles.cost(value)
  }
  if (isCountColumn(column)) {
    return terminalStyles.throughput(value)
  }
  if (isThroughputColumn(column)) {
    return terminalStyles.throughput(value)
  }
  if (isDurationColumn(column)) {
    return terminalStyles.duration(value)
  }
  if (isPathColumn(column)) {
    return colorizePathValue(value)
  }
  if (isArtifactColumn(column)) {
    return preserveOuterWhitespace(value, terminalPalette.path)
  }
  if (isProviderModelColumn(column)) {
    return terminalStyles.model(value)
  }
  if (isProviderColumn(column)) {
    return terminalStyles.provider(value)
  }
  if (isModelColumn(column)) {
    return terminalStyles.model(value)
  }
  if (isRemoteIdColumn(column)) {
    return terminalStyles.info(value)
  }

  return value
}

export const colorizeLogTimestamp = (timestamp: string): string =>
  terminalStyles.muted(timestamp)

export const colorizeLogLevelSymbol = (symbol: string, level: LogLevel): string => {
  switch (level) {
    case 'success':
      return terminalStyles.success(symbol)
    case 'warn':
      return terminalStyles.warning(symbol)
    case 'error':
      return terminalStyles.error(symbol)
    case 'debug':
      return terminalStyles.muted(symbol)
    case 'info':
      return terminalStyles.info(symbol)
  }
}

export const colorizeLogBatchPrefix = (prefix: string): string =>
  terminalStyles.muted(prefix)

export const colorizeLogMessage = (message: string, category: LogCategory): string => {
  const color = CATEGORY_COLORS[category]
  return color ? paint(message, color) : message
}
