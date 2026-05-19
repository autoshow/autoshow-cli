export const toRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined

export const getStringField = (obj: Record<string, unknown> | undefined, key: string): string | undefined => {
  if (!obj) return undefined
  const value = obj[key]
  return typeof value === 'string' ? value : undefined
}

export const getNumberField = (obj: Record<string, unknown> | undefined, key: string): number | undefined => {
  if (!obj) return undefined
  const value = obj[key]
  return typeof value === 'number' ? value : undefined
}

export const isStructuredFallbackError = (error: unknown): boolean => {
  const root = toRecord(error)
  const nested = toRecord(root?.['error'])

  const status = getNumberField(root, 'status')
  if (status !== 400 && status !== 422) return false

  const code = getStringField(root, 'code') ?? getStringField(nested, 'code')
  const param = getStringField(nested, 'param')
  const message = (getStringField(root, 'message') ?? '').toLowerCase()
  const nestedMessage = (getStringField(nested, 'message') ?? '').toLowerCase()
  const combinedMessage = `${message} ${nestedMessage}`

  if (code === 'json_validate_failed') return true
  if (param === 'response_format') return true

  return (
    combinedMessage.includes('response_format') ||
    combinedMessage.includes('json schema') ||
    combinedMessage.includes('failed to validate json') ||
    combinedMessage.includes('generated json does not match')
  )
}
