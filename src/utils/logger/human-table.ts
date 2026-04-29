import type {
  BatchItemTableRow,
  HumanLogTable,
  HumanLogTableCell,
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

const tableIndent = '  '

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

const padColoredTableCell = (coloredValue: string, plainValue: string, width: number): string =>
  `${coloredValue}${' '.repeat(Math.max(0, width - plainValue.length))}`

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
  options: { header?: boolean } = {}
): string => {
  const row = createStringRow(columns, values)
  const vertical = colorizeHumanTableBorder(tableChars.vertical)
  return `${vertical}${values
    .map((value, index) => {
      const width = widths[index] ?? 0
      const column = columns[index] ?? ''
      const coloredValue = options.header
        ? colorizeHumanTableHeader(value)
        : colorizeHumanTableCell({ column, value, row })
      return ` ${padColoredTableCell(coloredValue, value, width)} `
    })
    .join(vertical)}${vertical}`
}

export const createHumanTable = (
  rows: readonly HumanLogTableRow[],
  columns?: readonly string[]
): HumanLogTable => ({
  rows,
  ...(columns ? { columns } : {})
})

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

export const renderHumanTable = (table: HumanLogTable): string => {
  if (table.rows.length === 0) {
    return `${tableIndent}(empty)`
  }

  const columns = resolveTableColumns(table)
  if (columns.length === 0) {
    return `${tableIndent}(empty)`
  }

  const renderHeader = shouldRenderHeader(columns)
  const rows = table.rows.map(row => columns.map(column => formatTableCell(row[column])))
  const widths = columns.map((column, index) => Math.max(
    renderHeader ? column.length : 0,
    ...rows.map(row => row[index]?.length ?? 0)
  ))
  const lines = [
    renderBorder(tableChars.topLeft, tableChars.topJoin, tableChars.topRight, widths),
    ...(renderHeader
      ? [
          renderTableRow(columns, widths, columns, { header: true }),
          renderBorder(tableChars.leftJoin, tableChars.crossJoin, tableChars.rightJoin, widths)
        ]
      : []),
    ...rows.map(row => renderTableRow(row, widths, columns)),
    renderBorder(tableChars.bottomLeft, tableChars.bottomJoin, tableChars.bottomRight, widths)
  ]

  return lines
    .map(line => `${tableIndent}${line}`)
    .join('\n')
}

export const toHumanTableCell = normalizeTableCell
