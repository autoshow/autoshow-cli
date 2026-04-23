import { AsyncLocalStorage } from 'node:async_hooks'
import type { LogContext } from '~/utils/logger/types'

const contextStore = new AsyncLocalStorage<LogContext>()

export const getLogContext = (): LogContext => {
  return contextStore.getStore() ?? {}
}

export const runWithLogContext = async <T>(
  context: LogContext,
  fn: () => Promise<T> | T
): Promise<T> => {
  const merged: LogContext = {
    ...getLogContext(),
    ...context
  }

  return await contextStore.run(merged, fn)
}
