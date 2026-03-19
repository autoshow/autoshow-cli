

export const readEnv = (key: string): string | undefined => {
  const val = process.env[key]?.trim()
  return val || undefined
}

export const readEnvFallback = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const val = process.env[key]?.trim()
    if (val) return val
  }
  return undefined
}
