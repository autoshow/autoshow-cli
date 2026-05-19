export const estimateTokens = (text: string): number => text.split(/\s+/).filter(Boolean).length

export const toArray = <T>(value: T | T[] | undefined): T[] =>
  value == null ? [] : Array.isArray(value) ? value : [value]
