import type { MetadataScalar } from '~/types'

const INDENT = '  '

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isScalar = (value: unknown): value is MetadataScalar =>
  value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'

const escapeSingleQuotedString = (value: string): string =>
  value.replace(/'/g, "''")

const renderScalar = (value: MetadataScalar, indentLevel: number): string => {
  if (value === null) {
    return 'null'
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (!value.includes('\n')) {
    return `'${escapeSingleQuotedString(value)}'`
  }

  const indent = INDENT.repeat(indentLevel + 1)
  return `|-\n${value.split('\n').map(line => `${indent}${line}`).join('\n')}`
}

const renderObject = (value: Record<string, unknown>, indentLevel: number): string => {
  const lines: string[] = []

  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) {
      continue
    }

    const indent = INDENT.repeat(indentLevel)
    if (Array.isArray(entry)) {
      if (entry.length === 0) {
        lines.push(`${indent}${key}: []`)
        continue
      }
      lines.push(`${indent}${key}:`)
      lines.push(renderArray(entry, indentLevel + 1))
      continue
    }

    if (isPlainObject(entry)) {
      const objectEntries = Object.entries(entry).filter(([, nested]) => nested !== undefined)
      if (objectEntries.length === 0) {
        lines.push(`${indent}${key}: {}`)
        continue
      }
      lines.push(`${indent}${key}:`)
      lines.push(renderObject(entry, indentLevel + 1))
      continue
    }

    if (!isScalar(entry)) {
      lines.push(`${indent}${key}: '${escapeSingleQuotedString(String(entry))}'`)
      continue
    }

    lines.push(`${indent}${key}: ${renderScalar(entry, indentLevel)}`)
  }

  return lines.join('\n')
}

const renderArray = (value: unknown[], indentLevel: number): string => {
  const indent = INDENT.repeat(indentLevel)
  const lines: string[] = []

  for (const entry of value) {
    if (Array.isArray(entry)) {
      if (entry.length === 0) {
        lines.push(`${indent}- []`)
        continue
      }
      lines.push(`${indent}-`)
      lines.push(renderArray(entry, indentLevel + 1))
      continue
    }

    if (isPlainObject(entry)) {
      const objectEntries = Object.entries(entry).filter(([, nested]) => nested !== undefined)
      if (objectEntries.length === 0) {
        lines.push(`${indent}- {}`)
        continue
      }
      lines.push(`${indent}-`)
      lines.push(renderObject(entry, indentLevel + 1))
      continue
    }

    if (!isScalar(entry)) {
      lines.push(`${indent}- '${escapeSingleQuotedString(String(entry))}'`)
      continue
    }

    lines.push(`${indent}- ${renderScalar(entry, indentLevel)}`)
  }

  return lines.join('\n')
}

export const formatMetadataAsFrontmatter = (metadata: Record<string, unknown>): string => {
  const body = renderObject(metadata, 0)
  return body.length > 0 ? `---\n${body}\n---\n` : '---\n---\n'
}
