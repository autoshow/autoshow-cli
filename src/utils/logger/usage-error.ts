import { AppUsageError } from '~/utils/error-handler'

export { AppUsageError as CLIUsageError }

export const usageError = (message: string, hint?: string): never => {
  throw new AppUsageError(message, hint ? [hint] : undefined)
}
