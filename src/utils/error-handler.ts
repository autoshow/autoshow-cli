import {
  InvalidParametersError,
  InvalidSchemaError,
  MissingRequiredFlagError,
  NoCommandSpecifiedError,
  NoSuchCommandError
} from 'clerc'

export const CLIUsageError = (message: string): Error => {
  const error = new Error(message)
  error.name = 'CLIUsageError'
  return error
}

export const isCLIUsageError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'CLIUsageError'

export const isUsageError = (error: unknown): boolean => {
  return (
    isCLIUsageError(error) ||
    error instanceof NoSuchCommandError ||
    error instanceof NoCommandSpecifiedError ||
    error instanceof InvalidParametersError ||
    error instanceof MissingRequiredFlagError ||
    error instanceof InvalidSchemaError
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
  if (error instanceof NoSuchCommandError) {
    return `Unknown command "${error.commandName}". Run: bun as help`
  }
  if (error instanceof NoCommandSpecifiedError) {
    return 'No command or input provided. Run: bun as --help'
  }
  if (error instanceof InvalidParametersError || error instanceof MissingRequiredFlagError || error instanceof InvalidSchemaError) {
    return `${error.message}. Run: bun as help <command>`
  }
  return 'Invalid command usage. Run: bun as --help'
}
