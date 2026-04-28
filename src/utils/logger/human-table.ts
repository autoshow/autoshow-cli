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

const tableIndent = '  '

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

  const rendered = table.columns
    ? Bun.inspect.table(table.rows, [...table.columns])
    : Bun.inspect.table(table.rows)

  return rendered
    .split('\n')
    .map(line => `${tableIndent}${line}`)
    .join('\n')
}

export const toHumanTableCell = normalizeTableCell
