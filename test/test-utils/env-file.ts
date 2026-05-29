export const parseConfiguredEnvValueFromDotEnv = (
  text: string,
  key: string
): string | undefined => {
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const idx = trimmed.indexOf('=')
    if (idx <= 0) {
      continue
    }

    const parsedKey = trimmed.slice(0, idx).trim()
    if (parsedKey !== key) {
      continue
    }

    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (value.length > 0) {
      return value
    }
  }

  return undefined
}
