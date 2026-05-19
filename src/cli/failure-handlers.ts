import * as l from '~/utils/logger'
import { extractErrorHints, isAppError } from '~/utils/error-handler'

let handlersInstalled = false
let fatalHandled = false

const handleFatal = (label: string, error: unknown): void => {
  if (fatalHandled) {
    return
  }

  fatalHandled = true
  if (isAppError(error)) {
    l.error(`${label}: ${error.message}`)
    for (const hint of extractErrorHints(error)) {
      l.write('info', hint)
    }
    process.exit(error.exitCode)
  }

  const payloadLabel = error instanceof Error && error.name.length > 0
    ? `${label} (${error.name} payload redacted)`
    : `${label} (payload redacted)`
  l.error(payloadLabel)
  process.exit(1)
}

export const installProcessFailureHandlers = (): void => {
  if (handlersInstalled) {
    return
  }

  handlersInstalled = true

  process.on('uncaughtException', (error) => {
    handleFatal('Uncaught exception', error)
  })

  process.on('unhandledRejection', (reason) => {
    handleFatal('Unhandled promise rejection', reason)
  })
}
