import { isNativeUsageError, nativeUsageMessage } from '~/cli/native/errors'

export const CLIUsageError = (message: string): Error => {
  const error = new Error(message)
  error.name = 'CLIUsageError'
  return error
}

const isCLIUsageError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'CLIUsageError'

export const isUsageError = (error: unknown): boolean => {
  return (
    isCLIUsageError(error) ||
    isNativeUsageError(error)
  )
}

export const normalizeExitCode = (error: unknown): number => {
  if (error instanceof Error && 'exitCode' in error) {
    const exitCode = (error as Error & { exitCode?: unknown }).exitCode
    if (typeof exitCode === 'number' && Number.isFinite(exitCode) && exitCode > 0) {
      return exitCode
    }
  }
  return isUsageError(error) ? 2 : 1
}

export const usageMessage = (error: unknown): string => {
  if (isCLIUsageError(error)) {
    return (error as Error).message
  }
  const nativeMessage = nativeUsageMessage(error)
  if (nativeMessage !== undefined) return nativeMessage
  return 'Invalid command usage. Run: bun as --help'
}
