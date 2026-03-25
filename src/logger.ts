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

const createConfiguredSinks = (formatOverride?: LogFormat): LogSink[] => {
  const resolvedFormat = resolveLogFormat(formatOverride ?? parseLogFormat(process.env['AUTOSHOW_LOG_FORMAT']))

  if (resolvedFormat === 'human') {
    return [createHumanSink()]
  }

  if (resolvedFormat === 'json') {
    return [createJsonSink()]
  }

  return [createHumanSink(), createJsonSink()]
}

const host = getHost()

const baseContext = {
  service: 'autoshow-cli',
  component: 'cli',
  env: process.env['NODE_ENV'] ?? 'development',
  pid: process.pid,
  ...(host ? { host } : {})
}

const attachReport = (logger: Logger): GlobalLogger => {
  return {
    ...logger,
    withContext: (context) => attachReport(logger.withContext(context)),
    report: createReporter(logger)
  }
}

let activeLogger = attachReport(createLogger({
  context: baseContext,
  minLevel: parseMinLogLevel(process.env['AUTOSHOW_LOG_LEVEL']),
  sinks: createConfiguredSinks()
}))

export type ReconfigureOptions = {
  verbose?: boolean
  quiet?: boolean
  json?: boolean
}

export const reconfigureLogger = (opts: ReconfigureOptions): void => {
  let minLevel: LogLevel | undefined
  let formatOverride: LogFormat | undefined

  if (opts.verbose) {
    minLevel = 'debug'
  } else if (opts.quiet) {
    minLevel = 'error'
  }

  if (opts.json) {
    formatOverride = 'json'
  }

  if (minLevel === undefined && formatOverride === undefined) {
    return
  }

  activeLogger = attachReport(createLogger({
    context: baseContext,
    minLevel: minLevel ?? parseMinLogLevel(process.env['AUTOSHOW_LOG_LEVEL']),
    sinks: createConfiguredSinks(formatOverride)
  }))
}

export const l: GlobalLogger = {
  get report() { return activeLogger.report },
  write: (...args) => activeLogger.write(...args),
  debug: (...args) => activeLogger.debug(...args),
  info: (...args) => activeLogger.info(...args),
  success: (...args) => activeLogger.success(...args),
  warn: (...args) => activeLogger.warn(...args),
  error: (...args) => activeLogger.error(...args),
  withContext: (context) => attachReport(activeLogger.withContext(context))
}

export const withContext = (context: LogContext): GlobalLogger => {
  return attachReport(activeLogger.withContext(context))
}

export const report = l.report
export const debug = l.debug
export const info = l.info
export const success = l.success
export const warn = l.warn
export const error = l.error
