import type { LogSink, LogSinkEvent } from '~/logger/types'

const logIndent = '  '
const ansiReset = '\x1b[0m'

const getAnsiColor = (input: string): string => {
  const ansi = Bun.color(input, 'ansi')
  return ansi ?? ''
}

const levelColorMap: Record<LogSinkEvent['level'], string> = {
  debug: getAnsiColor('slategray'),
  info: getAnsiColor('deepskyblue'),
  success: getAnsiColor('limegreen'),
  warn: getAnsiColor('gold'),
  error: getAnsiColor('tomato')
}

const infoCategoryColorMap: Record<LogSinkEvent['category'], string> = {
  general: '',
  command: getAnsiColor('cornflowerblue'),
  artifact: getAnsiColor('mediumseagreen'),
  pricing: getAnsiColor('khaki'),
  pipeline: getAnsiColor('turquoise'),
  tts: getAnsiColor('orange'),
  usage: getAnsiColor('salmon')
}

const timestampColor = getAnsiColor('gray')

const colorText = (text: string, ansiCode: string): string => {
  if (ansiCode.length === 0 || text.length === 0) {
    return text
  }
  return `${ansiCode}${text}${ansiReset}`
}

const getMessageColor = (event: LogSinkEvent): string => {
  if (event.level === 'info') {
    const categoryColor = infoCategoryColorMap[event.category]
    return categoryColor.length > 0 ? categoryColor : levelColorMap.info
  }
  return levelColorMap[event.level]
}

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
  const timestamp = colorText(`[${event.timestamp}]`, timestampColor)
  const symbol = getLevelSymbol(event.level)
  const levelColor = levelColorMap[event.level]
  const levelPrefix = symbol.length > 0 ? `${colorText(symbol, levelColor)} ` : ''
  const batchPrefix = colorText(getBatchItemPrefix(event), timestampColor)
  const message = event.indent ? `${logIndent}${event.message}` : event.message
  return `${timestamp} ${levelPrefix}${batchPrefix}${colorText(message, getMessageColor(event))}`
}

export const createHumanSink = (): LogSink => {
  return (event) => {
    const filteredArgs = event.args.filter(arg => arg !== undefined)
    const message = formatMessage(event)

    switch (event.level) {
      case 'warn':
        console.warn(message, ...filteredArgs)
        return
      case 'error':
        console.error(message, ...filteredArgs)
        return
      default:
        console.error(message, ...filteredArgs)
    }
  }
}
