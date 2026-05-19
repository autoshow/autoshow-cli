import type {
  BatchItemTableRow,
  HumanLogTable,
  HumanLogTableAlign,
  HumanLogTableCell,
  HumanLogTableDetail,
  HumanLogTableRow,
  HumanTableLogOptions,
  KeyValueTableLogOptions,
  LocationTableRow,
  Logger,
  SingleRowTableLogOptions
} from '~/types'
import {
  colorizeHumanTableBorder,
  colorizeHumanTableCell,
  colorizeHumanTableHeader
} from '~/utils/logger/log-colors'
import { stripAnsi } from '~/utils/terminal-colors'

const tableIndent = '  '
const widePathDetailVisibleLength = 56

const tableChars = {
  topLeft: '\u250c',
  topJoin: '\u252c',
  topRight: '\u2510',
  leftJoin: '\u251c',
  crossJoin: '\u253c',
  rightJoin: '\u2524',
  bottomLeft: '\u2514',
  bottomJoin: '\u2534',
  bottomRight: '\u2518',
  horizontal: '\u2500',
  vertical: '\u2502'
} as const

const normalizeTableCell = (value: unknown): HumanLogTableCell => {
  if (value === null) {
    return null
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (value === undefined) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (value instanceof URL) {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return value.map(item => String(normalizeTableCell(item))).join(', ')
  }

  return Bun.inspect(value)
}

const pathLikeColumnNames = new Set<string>([
  'batchmanifest',
  'cachedir',
  'destination',
  'dir',
  'directory',
  'file',
  'filename',
  'input',
  'inputdir',
  'inputpath',
  'location',
  'manifest',
  'output',
  'outputdir',
  'outputpath',
  'path',
  'retryoutputdir',
  'runmanifest',
  'source',
  'sourcemedia',
  'sourcepath',
  'target',
  'targetpath',
  'workdir'
])

const alwaysLiftVerboseColumnNames = new Set<string>([
  'error',
  'errors',
  'lasterror',
  'stderr',
  'stdout',
  'stack'
])

const conditionallyLiftVerboseColumnNames = new Set<string>([
  'detail',
  'details',
  'message',
  'messages'
])

const normalizeColumnName = (column: string): string =>
  column.trim().replace(/[^a-z0-9]+/gi, '').toLowerCase()

const isAlwaysLiftVerboseColumnName = (column: string): boolean =>
  alwaysLiftVerboseColumnNames.has(normalizeColumnName(column))

const isConditionallyLiftVerboseColumnName = (column: string): boolean =>
  conditionallyLiftVerboseColumnNames.has(normalizeColumnName(column))

const isPathLikeColumnName = (column: string): boolean => {
  const normalized = normalizeColumnName(column)
  return pathLikeColumnNames.has(normalized)
    || normalized.endsWith('path')
    || normalized.endsWith('paths')
    || normalized.endsWith('dir')
    || normalized.endsWith('dirs')
    || normalized.endsWith('directory')
    || normalized.endsWith('directories')
    || normalized.endsWith('manifest')
    || normalized.endsWith('manifests')
    || normalized.includes('manifest')
}

const isUrlLikeValue = (value: string): boolean =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(value.trim())

const hasFilesystemPathMarker = (value: string): boolean => {
  const trimmed = value.trim()
  return /^(?:\.{1,2}[\\/]|~[\\/]|[\\/]|[A-Za-z]:[\\/])/.test(trimmed)
    || trimmed.includes('\\')
    || trimmed.split('/').length > 2
    || /^(?:build|cache|dist|docs|input|output|private|runtime|src|test|tmp|users|var)\//i.test(trimmed)
    || /[\\/][^\\/]+\.[A-Za-z0-9]{1,12}(?:$|[?#])/.test(trimmed)
}

const isProviderOrModelId = (value: string): boolean => {
  const trimmed = value.trim()
  if (hasFilesystemPathMarker(trimmed)) {
    return false
  }

  const slashCount = trimmed.split('/').length - 1
  return slashCount === 1
    && /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:@+-]*$/.test(trimmed)
}

const isLiftableWidePathValue = (value: HumanLogTableCell): boolean => {
  const visibleValue = stripAnsi(formatTableCell(value))
  return visibleValue.length > widePathDetailVisibleLength
    && /[\\/]/.test(visibleValue)
    && !isUrlLikeValue(visibleValue)
    && !isProviderOrModelId(visibleValue)
}

const collectTableColumns = (rows: readonly HumanLogTableRow[]): string[] => {
  const columns = new Set<string>()

  for (const row of rows) {
    for (const column of Object.keys(row)) {
      columns.add(column)
    }
  }

  return [...columns]
}

const resolveTableColumns = (table: HumanLogTable): string[] =>
  table.columns && table.columns.length > 0
    ? [...table.columns]
    : collectTableColumns(table.rows)

const formatTableCell = (value: HumanLogTableCell | undefined): string => {
  if (value === undefined) {
    return ''
  }

  if (value === null) {
    return 'null'
  }

  return String(value)
}

const shouldRenderHeader = (columns: readonly string[]): boolean =>
  !(
    columns.length === 2
    && (
      (columns[0] === 'key' && columns[1] === 'value')
      || (columns[0] === 'artifact' && columns[1] === 'path')
    )
  )

const nonEmptyTableCell = (value: HumanLogTableCell | undefined): boolean =>
  value !== undefined && formatTableCell(value).length > 0

type WidePathDetailContext = {
  label: string
  labelColumn?: string
}

const detailLabelFromCell = (value: HumanLogTableCell | undefined): string | undefined => {
  const label = formatTableCell(value).trim()
  return label.length > 0 ? label : undefined
}

const getKeyValueDetailLabel = (
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string
): string | undefined => {
  if (columns.length !== 2 || column !== columns[1]) {
    return undefined
  }

  return detailLabelFromCell(row[columns[0] as string])
}

const getProviderDetailPrefix = (row: HumanLogTableRow): string | undefined => {
  const provider = detailLabelFromCell(row['provider'])
  if (!provider) {
    return undefined
  }

  const model = detailLabelFromCell(row['model'])
  return model ? `${provider}/${model}` : provider
}

const buildCellDetailLabel = (
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string
): string => {
  const keyValueLabel = getKeyValueDetailLabel(row, columns, column)
  const label = keyValueLabel ?? column
  const providerPrefix = getProviderDetailPrefix(row)
  return providerPrefix && !label.includes(providerPrefix)
    ? `${providerPrefix} ${label}`
    : label
}

const getEffectiveVerboseColumnName = (
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string
): string => getKeyValueDetailLabel(row, columns, column) ?? column

const VERBOSE_DETAIL_VISIBLE_LENGTH = 96
const lineBreakPattern = /\r|\n/
const stackLikePattern = /(?:^|\n)\s*at\s+\S+|Traceback \(most recent call last\)|\b(?:Error|Exception):\s|\bstack trace\b/i
const rawStreamLikePattern = /\b(?:stderr|stdout)\b\s*[:=]|\bexit code\b|\bexited with code\b/i

const isVerboseDetailValue = (
  value: HumanLogTableCell
): boolean => {
  const visibleValue = stripAnsi(formatTableCell(value))
  return lineBreakPattern.test(visibleValue)
    || visibleValue.length > VERBOSE_DETAIL_VISIBLE_LENGTH
    || stackLikePattern.test(visibleValue)
    || rawStreamLikePattern.test(visibleValue)
}

const shouldLiftVerboseCell = (
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string,
  value: HumanLogTableCell | undefined
): value is HumanLogTableCell => {
  if (value === undefined) {
    return false
  }

  const visibleValue = stripAnsi(formatTableCell(value)).trim()
  if (visibleValue.length === 0) {
    return false
  }

  const effectiveColumn = getEffectiveVerboseColumnName(row, columns, column)
  if (isAlwaysLiftVerboseColumnName(effectiveColumn)) {
    return typeof value === 'string'
  }

  if (lineBreakPattern.test(visibleValue)) {
    return true
  }

  return isConditionallyLiftVerboseColumnName(effectiveColumn)
    && isVerboseDetailValue(value)
}

const getLiftedCellSummary = (
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string
): string => {
  const effectiveColumn = getEffectiveVerboseColumnName(row, columns, column)
  if (normalizeColumnName(effectiveColumn) === 'stack') {
    return 'see stack'
  }
  return 'see details'
}

const extractVerboseCellDetails = (table: HumanLogTable): HumanLogTable => {
  const columns = resolveTableColumns(table)
  const rows = table.rows.map(row => ({ ...row }))
  const details: HumanLogTableDetail[] = table.details ? [...table.details] : []
  let lifted = false

  for (const row of rows) {
    for (const column of columns) {
      const value = row[column]
      if (!shouldLiftVerboseCell(row, columns, column, value)) {
        continue
      }

      details.push({
        label: buildCellDetailLabel(row, columns, column),
        value
      })
      row[column] = getLiftedCellSummary(row, columns, column)
      lifted = true
    }
  }

  if (!lifted) {
    return table
  }

  return {
    ...table,
    rows,
    details
  }
}

const getWidePathDetailContext = (
  row: HumanLogTableRow,
  columns: readonly string[],
  column: string
): WidePathDetailContext | undefined => {
  const normalizedColumn = normalizeColumnName(column)

  if (normalizedColumn === 'path') {
    const artifactLabel = detailLabelFromCell(row['artifact'])
    if (artifactLabel) {
      return { label: artifactLabel, labelColumn: 'artifact' }
    }
  }

  if (columns.length === 2 && column === columns[1]) {
    const labelColumn = columns[0] as string
    const label = detailLabelFromCell(row[labelColumn])
    if (label && isPathLikeColumnName(label)) {
      return { label, labelColumn }
    }
  }

  if (isPathLikeColumnName(column)) {
    return { label: column }
  }

  return undefined
}

const shouldOmitLiftedLabelOnlyRow = (
  remainingColumns: readonly string[],
  liftedLabelColumns: ReadonlySet<string>
): boolean =>
  remainingColumns.length > 0
  && remainingColumns.every(column => liftedLabelColumns.has(column))

const extractWidePathDetails = (table: HumanLogTable): HumanLogTable => {
  const columns = resolveTableColumns(table)
  const rows = table.rows.map(row => ({ ...row }))
  const details: HumanLogTableDetail[] = table.details ? [...table.details] : []
  const liftedColumns = new Set<string>()
  const liftedLabelColumnsByRow = new Map<number, Set<string>>()

  for (const [rowIndex, row] of rows.entries()) {
    for (const column of columns) {
      const value = row[column]
      if (value === undefined) {
        continue
      }

      const detailContext = getWidePathDetailContext(row, columns, column)
      if (!detailContext || !isLiftableWidePathValue(value)) {
        continue
      }

      details.push({ label: detailContext.label, value })
      delete row[column]
      liftedColumns.add(column)

      if (detailContext.labelColumn) {
        const labelColumns = liftedLabelColumnsByRow.get(rowIndex) ?? new Set<string>()
        labelColumns.add(detailContext.labelColumn)
        liftedLabelColumnsByRow.set(rowIndex, labelColumns)
      }
    }
  }

  if (details.length === (table.details?.length ?? 0)) {
    return table
  }

  const keptRows = rows.filter((row, rowIndex) => {
    const remainingColumns = columns.filter(column => nonEmptyTableCell(row[column]))
    if (remainingColumns.length === 0) {
      return false
    }

    const liftedLabelColumns = liftedLabelColumnsByRow.get(rowIndex)
    return liftedLabelColumns
      ? !shouldOmitLiftedLabelOnlyRow(remainingColumns, liftedLabelColumns)
      : true
  })

  const keptColumns = columns.filter((column) => {
    if (!liftedColumns.has(column)) {
      return true
    }
    return keptRows.some(row => nonEmptyTableCell(row[column]))
  })
  const keptColumnSet = new Set(keptColumns)

  const out: HumanLogTable = {
    rows: keptRows,
    ...(keptColumns.length > 0 ? { columns: keptColumns } : {}),
    ...(table.align
      ? {
          align: Object.fromEntries(
            Object.entries(table.align).filter(([column]) => keptColumnSet.has(column))
          )
        }
      : {}),
    details
  }

  return out
}

const padColoredTableCell = (
  coloredValue: string,
  plainValue: string,
  width: number,
  align: HumanLogTableAlign = 'left'
): string => {
  const padding = ' '.repeat(Math.max(0, width - plainValue.length))
  return align === 'right'
    ? `${padding}${coloredValue}`
    : `${coloredValue}${padding}`
}

const renderBorder = (
  left: string,
  join: string,
  right: string,
  widths: readonly number[]
): string =>
  colorizeHumanTableBorder(
    `${left}${widths.map(width => tableChars.horizontal.repeat(width + 2)).join(join)}${right}`
  )

const createStringRow = (
  columns: readonly string[],
  values: readonly string[]
): Record<string, string> => {
  const row: Record<string, string> = {}
  for (const [index, column] of columns.entries()) {
    row[column] = values[index] ?? ''
  }
  return row
}

const renderTableRow = (
  values: readonly string[],
  widths: readonly number[],
  columns: readonly string[],
  options: { header?: boolean; align?: HumanLogTable['align'] } = {}
): string => {
  const row = createStringRow(columns, values)
  const vertical = colorizeHumanTableBorder(tableChars.vertical)
  return `${vertical}${values
    .map((value, index) => {
      const width = widths[index] ?? 0
      const column = columns[index] ?? ''
      const align = options.align?.[column] ?? 'left'
      const coloredValue = options.header
        ? colorizeHumanTableHeader(value)
        : colorizeHumanTableCell({ column, value, row })
      return ` ${padColoredTableCell(coloredValue, value, width, align)} `
    })
    .join(vertical)}${vertical}`
}

export const createHumanTable = (
  rows: readonly HumanLogTableRow[],
  columns?: readonly string[],
  options: Pick<HumanLogTable, 'align'> = {}
): HumanLogTable =>
  extractWidePathDetails(
    extractVerboseCellDetails({
      rows,
      ...(columns ? { columns } : {}),
      ...(options.align ? { align: options.align } : {})
    })
  )

export const createKeyValueTable = (
  entries: ReadonlyArray<readonly [string, unknown]>,
  keyLabel = 'key',
  valueLabel = 'value'
): HumanLogTable =>
  createHumanTable(
    entries.map(([key, value]) => ({
      [keyLabel]: key,
      [valueLabel]: normalizeTableCell(value)
    })),
    [keyLabel, valueLabel]
  )

export const createSingleRowTable = (
  row: Readonly<Record<string, unknown>>,
  columns?: readonly string[]
): HumanLogTable =>
  createHumanTable([
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, normalizeTableCell(value)])
    ) as HumanLogTableRow
  ], columns)

const appendDetailColumnIfNeeded = (
  rows: readonly HumanLogTableRow[],
  baseColumns: readonly string[]
): readonly string[] =>
  rows.some((row) => row['detail'] !== undefined)
    ? [...baseColumns, 'detail']
    : baseColumns

export const createLocationsTable = (
  rows: readonly LocationTableRow[]
): HumanLogTable => {
  const normalizedRows = rows.map((row) => {
    const detail = toHumanTableCell(row.detail)
    return {
      artifact: toHumanTableCell(row.artifact),
      path: toHumanTableCell(row.path),
      ...(detail !== '' ? { detail } : {})
    }
  })

  return createHumanTable(
    normalizedRows,
    appendDetailColumnIfNeeded(normalizedRows, ['artifact', 'path'])
  )
}

const createBatchItemTable = (
  rows: readonly BatchItemTableRow[]
): HumanLogTable => {
  const normalizedRows = rows.map((row) => {
    const detail = toHumanTableCell(row.detail)
    return {
      status: toHumanTableCell(row.status),
      input: toHumanTableCell(row.input),
      ...(detail !== '' ? { detail } : {})
    }
  })

  return createHumanTable(
    normalizedRows,
    appendDetailColumnIfNeeded(normalizedRows, ['status', 'input'])
  )
}

export const logSingleRowTable = (
  logger: Pick<Logger, 'write'>,
  message: string,
  row: Readonly<Record<string, unknown>>,
  options: SingleRowTableLogOptions = {}
): void => {
  logger.write(options.level ?? 'info', message, {
    category: options.category ?? 'general',
    humanTable: createSingleRowTable(row, options.columns),
    metadata: options.metadata ?? row
  })
}

export const logKeyValueTable = (
  logger: Pick<Logger, 'write'>,
  message: string,
  entries: ReadonlyArray<readonly [string, unknown]>,
  options: KeyValueTableLogOptions = {}
): void => {
  const keyLabel = options.keyLabel ?? 'key'
  const valueLabel = options.valueLabel ?? 'value'

  logger.write(options.level ?? 'info', message, {
    category: options.category ?? 'general',
    humanTable: createKeyValueTable(entries, keyLabel, valueLabel),
    metadata: options.metadata ?? {
      entries: entries.map(([key, value]) => ({ key, value }))
    }
  })
}

export const logLocationsTable = (
  logger: Pick<Logger, 'write'>,
  rows: readonly LocationTableRow[],
  options: HumanTableLogOptions = {}
): void => {
  logger.write(options.level ?? 'info', 'Locations', {
    category: options.category ?? 'artifact',
    humanTable: createLocationsTable(rows),
    ...(options.metadata ? { metadata: options.metadata } : {})
  })
}

export const logBatchItemTable = (
  logger: Pick<Logger, 'write'>,
  rows: readonly BatchItemTableRow[],
  options: HumanTableLogOptions = {}
): void => {
  logger.write(options.level ?? 'info', 'Batch Item', {
    category: options.category ?? 'pipeline',
    humanTable: createBatchItemTable(rows),
    ...(options.metadata ? { metadata: options.metadata } : {})
  })
}

const renderHumanTableDetails = (details: readonly HumanLogTableDetail[] | undefined): string => {
  if (!details || details.length === 0) {
    return ''
  }

  return details
    .map((detail) => {
      const value = formatTableCell(detail.value)
      const valueLines = value.split(/\r?\n/).map(line => colorizeHumanTableCell({
        column: detail.label,
        value: line,
        row: { [detail.label]: line }
      }))
      const [firstLine = '', ...restLines] = valueLines
      const renderedFirstLine = `${tableIndent}${detail.label}: ${firstLine}`
      if (restLines.length === 0) {
        return renderedFirstLine
      }

      const continuationIndent = `${tableIndent}${' '.repeat(detail.label.length + 2)}`
      return [
        renderedFirstLine,
        ...restLines.map(line => `${continuationIndent}${line}`)
      ].join('\n')
    })
    .join('\n')
}

export const renderHumanTable = (table: HumanLogTable): string => {
  const normalizedTable = extractWidePathDetails(extractVerboseCellDetails(table))
  const renderedDetails = renderHumanTableDetails(normalizedTable.details)

  if (normalizedTable.rows.length === 0) {
    return renderedDetails.length > 0 ? renderedDetails : `${tableIndent}(empty)`
  }

  const columns = resolveTableColumns(normalizedTable)
  if (columns.length === 0) {
    return renderedDetails.length > 0 ? renderedDetails : `${tableIndent}(empty)`
  }

  const renderHeader = shouldRenderHeader(columns)
  const rows = normalizedTable.rows.map(row => columns.map(column => formatTableCell(row[column])))
  const widths = columns.map((column, index) => Math.max(
    renderHeader ? column.length : 0,
    ...rows.map(row => row[index]?.length ?? 0)
  ))
  const lines = [
    renderBorder(tableChars.topLeft, tableChars.topJoin, tableChars.topRight, widths),
    ...(renderHeader
      ? [
          renderTableRow(columns, widths, columns, { header: true, align: normalizedTable.align }),
          renderBorder(tableChars.leftJoin, tableChars.crossJoin, tableChars.rightJoin, widths)
        ]
      : []),
    ...rows.map(row => renderTableRow(row, widths, columns, { align: normalizedTable.align })),
    renderBorder(tableChars.bottomLeft, tableChars.bottomJoin, tableChars.bottomRight, widths)
  ]

  return lines
    .map(line => `${tableIndent}${line}`)
    .join('\n')
    + (renderedDetails.length > 0 ? `\n${renderedDetails}` : '')
}

export const toHumanTableCell = normalizeTableCell
