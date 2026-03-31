import { getLogContext } from '~/logger/context-store'
import {
  sanitizeLogArgs,
  sanitizeLogContext,
  sanitizeLogMetadata,
  sanitizeLogText
} from '~/logger/redaction'
import {
  LOG_LEVEL_PRIORITY,
  type CreateLoggerOptions,
  type LogContext,
  type Logger,
  type LogLevel,
  type LogSink,
  type LogSinkEvent,
  type LogWriteOptions,
  type MutableLoggerConfig
} from '~/logger/types'

const ansiReset = '\x1b[0m'
const sinkFailureColor = Bun.color('tomato', 'ansi') ?? ''
const sinkFailureTimestampColor = Bun.color('gray', 'ansi') ?? ''

const colorText = (text: string, ansiCode: string): string => {
  if (ansiCode.length === 0 || text.length === 0) {
    return text
  }
  return `${ansiCode}${text}${ansiReset}`
}

const getTimestamp = (): string => {
  return new Date().toISOString()
}

const createRunId = (): string => {
  const timestampPart = Date.now().toString(36)
  const randomPart = Math.random().toString(36).slice(2, 10)
  return `${timestampPart}-${randomPart}`
}

const mergeContext = (...contexts: Array<LogContext | undefined>): LogContext => {
  const merged: Record<string, string | number | boolean | null | undefined> = {}

  for (const context of contexts) {
    if (!context) {
      continue
    }

    Object.assign(merged, context)
  }

  return merged
}

const getContextString = (context: LogContext, key: string): string | undefined => {
  const value = context[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

const shouldEmitLevel = (level: LogLevel, minLevel: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel]
}

const makeSinkEvent = (
  level: LogLevel,
  message: string,
  runId: string,
  baseContext: LogContext,
  options?: LogWriteOptions
): LogSinkEvent => {
  const asyncContext = getLogContext()
  const mergedContext = sanitizeLogContext(mergeContext(baseContext, asyncContext, options?.context))
  const contextKeys = Object.keys(mergedContext)
  const command = getContextString(mergedContext, 'command')
  const step = getContextString(mergedContext, 'step')

  return {
    timestamp: getTimestamp(),
    level,
    message: sanitizeLogText(message),
    category: options?.category ?? 'general',
    runId,
    ...(command ? { command } : {}),
    ...(step ? { step } : {}),
    ...(contextKeys.length > 0 ? { context: mergedContext } : {}),
    ...(options?.metadata ? { metadata: sanitizeLogMetadata(options.metadata) } : {}),
    indent: options?.indent ?? true,
    args: sanitizeLogArgs(options?.args ?? [])
  }
}

const writeSinkFailure = (error: unknown): void => {
  const message = sanitizeLogText(error instanceof Error ? error.message : String(error))
  const timestamp = getTimestamp()
  const prefix = colorText('\u2716', sinkFailureColor)
  const content = colorText(`Logger sink failure: ${message}`, sinkFailureColor)
  console.error(`${colorText(`[${timestamp}]`, sinkFailureTimestampColor)} ${prefix}   ${content}`)
}

export const createLogger = (options: CreateLoggerOptions = {}): Logger => {
  const runId = options.runId ?? createRunId()
  const baseContext = options.context ?? {}
  const config: MutableLoggerConfig = {
    sinks: options.sinks ? [...options.sinks] : [],
    minLevel: options.minLevel ?? 'info'
  }
  let sinkFailureReported = false

  const emit = (event: LogSinkEvent): void => {
    for (const sink of config.sinks) {
      try {
        sink(event)
      } catch (error) {
        if (!sinkFailureReported) {
          sinkFailureReported = true
          writeSinkFailure(error)
        }
      }
    }
  }

  const write = (level: LogLevel, message: string, writeOptions?: LogWriteOptions): void => {
    if (!shouldEmitLevel(level, config.minLevel)) {
      return
    }
    emit(makeSinkEvent(level, message, runId, baseContext, writeOptions))
  }

  const logger: Logger = {
    config,
    write,
    debug: (message, ...args) => {
      write('debug', message, { args })
    },
    info: (message, ...args) => {
      write('info', message, { args })
    },
    success: (message, ...args) => {
      write('success', message, { args })
    },
    warn: (message, ...args) => {
      write('warn', message, { args })
    },
    error: (message, errorObj) => {
      if (errorObj instanceof Error) {
        write('error', `${message}: ${errorObj.message}`)
        if (errorObj.stack) {
          write('error', errorObj.stack, { indent: false })
        }
        return
      }

      if (errorObj === undefined) {
        write('error', message)
        return
      }

      write('error', message, { args: [errorObj] })
    },
    withContext: (context) => {
      return createLogger({
        runId,
        context: { ...baseContext, ...context },
        sinks: config.sinks,
        minLevel: config.minLevel
      })
    }
  }

  return logger
}

export const createNoopSink = (): LogSink => {
  return () => undefined
}
