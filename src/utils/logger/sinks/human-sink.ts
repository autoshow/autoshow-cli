import { renderHumanTable } from '~/utils/logger/human-table'
import {
  colorizeLogBatchPrefix,
  colorizeLogLevelSymbol,
  colorizeLogMessage,
  colorizeLogTimestamp
} from '~/utils/logger/log-colors'
import type { HumanSinkOptions, LogSink, LogSinkEvent } from '~/types'

const logIndent = '  '

const getBatchItemPrefix = (event: LogSinkEvent): string => {
  const itemIndex = event.context?.['itemIndex']
  const itemCount = event.context?.['itemCount']

  if (
    typeof itemIndex === 'number'
    && Number.isFinite(itemIndex)
    && typeof itemCount === 'number'
    && Number.isFinite(itemCount)
    && itemIndex >= 1
    && itemCount >= itemIndex
  ) {
    return `[${itemIndex}/${itemCount}] `
  }

  return ''
}

const getLevelSymbol = (level: LogSinkEvent['level']): string => {
  switch (level) {
    case 'info':
      return ''
    case 'warn':
      return '\u26a0'
    case 'error':
      return '\u2716'
    case 'success':
      return '\u2713'
    case 'debug':
      return '\u25cb'
  }
}

const formatMessage = (event: LogSinkEvent): string => {
  const timestamp = colorizeLogTimestamp(`[${event.timestamp}]`)
  const symbol = getLevelSymbol(event.level)
  const levelPrefix = symbol.length > 0 ? `${colorizeLogLevelSymbol(symbol, event.level)} ` : ''
  const batchPrefix = colorizeLogBatchPrefix(getBatchItemPrefix(event))
  const message = event.indent ? `${logIndent}${event.message}` : event.message
  return `${timestamp} ${levelPrefix}${batchPrefix}${colorizeLogMessage(message, event.category)}`
}

export const createHumanSink = (options: HumanSinkOptions = {}): LogSink => {
  const interactive = options.interactive ?? process.stdout.isTTY === true

  return (event) => {
    const filteredArgs = event.args.filter(arg => arg !== undefined)
    const renderedParts = [formatMessage(event)]

    if (event.humanTable) {
      renderedParts.push(renderHumanTable(event.humanTable))
    }

    const message = renderedParts.join('\n')

    switch (event.level) {
      case 'warn':
        console.warn(message, ...filteredArgs)
        return
      case 'error':
        console.error(message, ...filteredArgs)
        return
      default:
        if (interactive) {
          console.log(message, ...filteredArgs)
          return
        }

        console.error(message, ...filteredArgs)
    }
  }
}
