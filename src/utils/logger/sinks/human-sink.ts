import { renderHumanTable } from '~/utils/logger/human-table'
import {
  colorizeLogBatchPrefix,
  colorizeLogLevelSymbol,
  colorizeLogMessage,
  colorizeLogTimestamp
} from '~/utils/logger/log-colors'
import type { HumanLogSection, HumanSinkOptions, LogSink, LogSinkEvent } from '~/types'

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
      return '\u2022'
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

const formatHumanTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return `[${timestamp}]`
  }

  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `[${hours}:${minutes}:${seconds}]`
}

const formatMessage = (event: LogSinkEvent): string => {
  const timestamp = colorizeLogTimestamp(formatHumanTimestamp(event.timestamp))
  const symbol = getLevelSymbol(event.level)
  const levelPrefix = `${colorizeLogLevelSymbol(symbol, event.level)} `
  const batchPrefix = colorizeLogBatchPrefix(getBatchItemPrefix(event))
  const message = event.message
  return `${timestamp} ${levelPrefix}${batchPrefix}${colorizeLogMessage(message, event.category)}`
}

const renderHumanSection = (section: HumanLogSection): string => [
  `${logIndent}${section.title}`,
  renderHumanTable(section.table)
].join('\n')

export const createHumanSink = (options: HumanSinkOptions = {}): LogSink => {
  const interactive = options.interactive ?? process.stdout.isTTY === true

  return (event) => {
    const filteredArgs = event.args.filter(arg => arg !== undefined)
    const renderedParts = [formatMessage(event)]

    if (event.humanTable) {
      renderedParts.push(renderHumanTable(event.humanTable))
    }

    if (event.humanSections) {
      renderedParts.push(...event.humanSections.map(renderHumanSection))
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
