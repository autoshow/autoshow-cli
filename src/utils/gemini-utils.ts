export const parseStatusFromGeminiError = (error: unknown): number | undefined => {
  if (error && typeof error === 'object') {
    if ('status' in error && typeof error.status === 'number') {
      return error.status
    }
    if ('code' in error && typeof error.code === 'number') {
      return error.code
    }
  }

  if (error instanceof Error) {
    const codeMatch = /"code"\s*:\s*(\d{3})/.exec(error.message)
    if (codeMatch) {
      const parsed = Number.parseInt(codeMatch[1] as string, 10)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return undefined
}
