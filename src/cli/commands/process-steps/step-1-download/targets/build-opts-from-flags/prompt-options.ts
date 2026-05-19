export const readPromptFlags = (flags: Record<string, unknown>): string[] => {
  const value = flags['prompt']
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
  if (typeof value === 'string' && value.length > 0) return [value]
  return []
}
