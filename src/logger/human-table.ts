import type { HumanLogTable, HumanLogTableCell, HumanLogTableRow } from '~/logger/types'

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
