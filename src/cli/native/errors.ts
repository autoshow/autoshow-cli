type NativeCliUsageErrorCode =
  | 'invalid-parameters'
  | 'invalid-schema'
  | 'missing-required-flag'
  | 'missing-required-value'
  | 'no-command-specified'
  | 'no-such-command'
  | 'unknown-flag'

export class NativeCliUsageError extends Error {
  readonly code: NativeCliUsageErrorCode
  readonly exitCode = 2

  constructor(code: NativeCliUsageErrorCode, message: string) {
    super(message)
    this.name = 'NativeCliUsageError'
    this.code = code
  }
}

export class NativeNoSuchCommandError extends NativeCliUsageError {
  readonly commandName: string

  constructor(commandName: string) {
    super('no-such-command', `Unknown command "${commandName}"`)
    this.name = 'NativeNoSuchCommandError'
    this.commandName = commandName
  }
}

export class NativeNoCommandSpecifiedError extends NativeCliUsageError {
  constructor() {
    super('no-command-specified', 'No command or input provided')
    this.name = 'NativeNoCommandSpecifiedError'
  }
}

export class NativeInvalidParametersError extends NativeCliUsageError {
  constructor(message: string) {
    super('invalid-parameters', message)
    this.name = 'NativeInvalidParametersError'
  }
}

export class NativeUnknownFlagError extends NativeCliUsageError {
  readonly flagNames: string[]

  constructor(flagNames: string[]) {
    super(
      'unknown-flag',
      flagNames.length === 1
        ? `Unexpected flag: ${flagNames[0]}`
        : `Unexpected flags: ${flagNames.join(', ')}`
    )
    this.name = 'NativeUnknownFlagError'
    this.flagNames = flagNames
  }
}

export class NativeMissingFlagValueError extends NativeCliUsageError {
  readonly flagName: string

  constructor(flagName: string) {
    super('missing-required-value', `Missing value for --${flagName}`)
    this.name = 'NativeMissingFlagValueError'
    this.flagName = flagName
  }
}

export const isNativeUsageError = (error: unknown): boolean =>
  error instanceof NativeCliUsageError

export const nativeUsageMessage = (error: unknown): string | undefined => {
  if (error instanceof NativeNoSuchCommandError) {
    return `Unknown command "${error.commandName}". Run: bun as help`
  }
  if (error instanceof NativeNoCommandSpecifiedError) {
    return 'No command or input provided. Run: bun as --help'
  }
  if (error instanceof NativeInvalidParametersError || error instanceof NativeMissingFlagValueError) {
    return `${error.message}. Run: bun as help <command>`
  }
  if (error instanceof NativeUnknownFlagError || error instanceof NativeCliUsageError) {
    return error.message
  }
  return undefined
}
