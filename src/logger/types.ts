export const LOG_LEVELS = ['debug', 'info', 'success', 'warn', 'error'] as const

export type LogLevel = typeof LOG_LEVELS[number]

export const LOG_LEVEL_PRIORITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  success: 30,
  warn: 40,
  error: 50
}

export const LOG_CATEGORIES = [
  'general',
  'command',
  'artifact',
  'pricing',
  'pipeline',
  'tts',
  'usage'
] as const

export type LogCategory = typeof LOG_CATEGORIES[number]

export type LogContext = Readonly<Record<string, string | number | boolean | null | undefined>>

export type LogMetadata = Readonly<Record<string, unknown>>

export type LogEvent = {
  timestamp: string
  level: LogLevel
  message: string
  category: LogCategory
  runId: string
  command?: string
  step?: string
  context?: LogContext
  metadata?: LogMetadata
}

export type LogWriteOptions = {
  category?: LogCategory
  metadata?: LogMetadata
  context?: LogContext
  indent?: boolean
  args?: readonly unknown[]
}

export type LogSinkEvent = LogEvent & {
  indent: boolean
  args: readonly unknown[]
}

export type LogSink = (event: LogSinkEvent) => void

export type CreateLoggerOptions = {
  runId?: string
  context?: LogContext
  sinks?: readonly LogSink[]
  minLevel?: LogLevel
}

export type BaseLogFn = (message: string, ...args: unknown[]) => void

export interface Logger {
  write: (level: LogLevel, message: string, options?: LogWriteOptions) => void
  debug: BaseLogFn
  info: BaseLogFn
  success: BaseLogFn
  warn: BaseLogFn
  error: (message: string, errorObj?: unknown) => void
  withContext: (context: LogContext) => Logger
}
