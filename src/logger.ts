import { createLogger } from '~/logger/core'
import { runWithLogContext } from '~/logger/context-store'
import { createReporter, type Reporter, type StepTimingCost } from '~/logger/reporter'
import { createHumanSink } from '~/logger/sinks/human-sink'
import { createJsonSink } from '~/logger/sinks/json-sink'
import type { LogContext, Logger, LogLevel, LogSink } from '~/logger/types'
import { LOG_LEVELS } from '~/logger/types'

export { createLogger, createNoopSink } from '~/logger/core'
export { createHumanSink } from '~/logger/sinks/human-sink'
export { createJsonSink } from '~/logger/sinks/json-sink'
export { runWithLogContext }
export { createReporter }
export { CLIUsageError, isLoggerUsageError, usageError } from '~/logger/usage-error'
export type { Logger, LogEvent, LogLevel, LogCategory, LogContext, LogMetadata, LogSink, LogSinkEvent, LogWriteOptions } from '~/logger/types'
export type { Reporter, StepTimingCost }

export type GlobalLogger = Logger & {
  report: Reporter
}

type LogFormat = 'auto' | 'human' | 'json' | 'both'

const parseLogFormat = (value: string | undefined): LogFormat => {
  const normalized = value?.trim().toLowerCase()
  if (normalized === 'human' || normalized === 'json' || normalized === 'both' || normalized === 'auto') {
    return normalized
  }
  return 'auto'
}

const resolveLogFormat = (format: LogFormat): Exclude<LogFormat, 'auto'> => {
  if (format !== 'auto') {
    return format
  }

  return process.env['NODE_ENV'] === 'production' ? 'json' : 'human'
}

const parseMinLogLevel = (value: string | undefined): LogLevel => {
  const normalized = value?.trim().toLowerCase()
  if (normalized && (LOG_LEVELS as readonly string[]).includes(normalized)) {
    return normalized as LogLevel
  }

  return 'info'
}

const getHost = (): string | undefined => {
  const host = process.env['HOSTNAME'] || process.env['HOST']
  if (host && host.trim().length > 0) {
    return host.trim()
  }
  return undefined
}

const createConfiguredSinks = (): LogSink[] => {
  const resolvedFormat = resolveLogFormat(parseLogFormat(process.env['AUTOSHOW_LOG_FORMAT']))

  if (resolvedFormat === 'human') {
    return [createHumanSink()]
  }

  if (resolvedFormat === 'json') {
    return [createJsonSink()]
  }

  return [createHumanSink(), createJsonSink()]
}

const host = getHost()

const coreLogger = createLogger({
  context: {
    service: 'autoshow-cli',
    component: 'cli',
    env: process.env['NODE_ENV'] ?? 'development',
    pid: process.pid,
    ...(host ? { host } : {})
  },
  minLevel: parseMinLogLevel(process.env['AUTOSHOW_LOG_LEVEL']),
  sinks: createConfiguredSinks()
})

const attachReport = (logger: Logger): GlobalLogger => {
  return {
    ...logger,
    withContext: (context) => attachReport(logger.withContext(context)),
    report: createReporter(logger)
  }
}

export const l = attachReport(coreLogger)

export const withContext = (context: LogContext): GlobalLogger => {
  return attachReport(coreLogger.withContext(context))
}

export const report = l.report
export const debug = l.debug
export const info = l.info
export const success = l.success
export const warn = l.warn
export const error = l.error
