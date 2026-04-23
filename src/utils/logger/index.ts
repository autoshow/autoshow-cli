import { createLogger } from '~/utils/logger/core'
import { runWithLogContext } from '~/utils/logger/context-store'
import { createReporter } from '~/utils/logger/reporter'
import { createHumanSink } from '~/utils/logger/sinks/human-sink'
import { createJsonSink } from '~/utils/logger/sinks/json-sink'
import { enableJsonResult, emitResult, isJsonResultActive } from '~/utils/logger/result-emitter'
import type {
  GlobalLogger,
  LogContext,
  LogFormat,
  Logger,
  LogLevel,
  LogSink,
  ReconfigureOptions
} from '~/types'
import { LOG_LEVELS } from '~/utils/logger/logger-types'

export { createLogger, createNoopSink } from '~/utils/logger/core'
export { createHumanSink } from '~/utils/logger/sinks/human-sink'
export { createJsonSink } from '~/utils/logger/sinks/json-sink'
export { runWithLogContext }
export { createReporter }
export { emitResult, isJsonResultActive }
export { CLIUsageError, isLoggerUsageError, usageError } from '~/utils/logger/usage-error'

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
    enableJsonResult()
  }

  if (minLevel === undefined && formatOverride === undefined) {
    return
  }

  const newSinks = createConfiguredSinks(formatOverride)
  activeLogger.config.sinks.length = 0
  activeLogger.config.sinks.push(...newSinks)
  if (minLevel !== undefined) {
    activeLogger.config.minLevel = minLevel
  }
}

export const l: GlobalLogger = {
  get config() { return activeLogger.config },
  get report() { return activeLogger.report },
  write: (...args) => activeLogger.write(...args),
  debug: (...args) => activeLogger.debug(...args),
  warn: (...args) => activeLogger.warn(...args),
  error: (...args) => activeLogger.error(...args),
  withContext: (context) => attachReport(activeLogger.withContext(context))
}

export const withContext = (context: LogContext): GlobalLogger => {
  return attachReport(activeLogger.withContext(context))
}

export const report = l.report
export const write = l.write
export const debug = l.debug
export const warn = l.warn
export const error = l.error
