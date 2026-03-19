import { installProcessFailureHandlers } from '../../../../src/cli/failure-handlers'

installProcessFailureHandlers()

Promise.reject(new Error('fatal-secret-value-987'))

setTimeout(() => {
  process.exit(0)
}, 250)
