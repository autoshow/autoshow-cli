export class CLIUsageError extends Error {
  readonly exitCode: number
  readonly hint: string | undefined

  constructor(message: string, hint?: string) {
    super(message)
    this.name = 'CLIUsageError'
    this.exitCode = 2
    this.hint = hint
  }
}

export const usageError = (message: string, hint?: string): never => {
  throw new CLIUsageError(message, hint)
}
