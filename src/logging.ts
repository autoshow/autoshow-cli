import { exit } from '@/node-utils'

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  boldRed: '\x1b[1m\x1b[31m',
  boldYellow: '\x1b[1m\x1b[33m',
  boldBlue: '\x1b[1m\x1b[34m',
  boldMagenta: '\x1b[1m\x1b[35m',
  boldCyan: '\x1b[1m\x1b[36m',
  boldUnderline: '\x1b[1m\x1b[4m',
  boldItalic: '\x1b[1m\x1b[3m'
}

const colorize = (color: keyof typeof colors, text: string): string => {
  return `${colors[color]}${text}${colors.reset}`
}

export const colorUtils = {
  bold: (text: string) => colorize('bold', text),
  dim: (text: string) => colorize('dim', text),
  red: (text: string) => colorize('red', text),
  yellow: (text: string) => colorize('yellow', text),
  blue: (text: string) => colorize('blue', text),
  magenta: (text: string) => colorize('magenta', text),
  cyan: (text: string) => colorize('cyan', text),
  boldRed: (text: string) => colorize('boldRed', text),
  boldYellow: (text: string) => colorize('boldYellow', text),
  boldBlue: (text: string) => colorize('boldBlue', text),
  boldMagenta: (text: string) => colorize('boldMagenta', text),
  boldCyan: (text: string) => colorize('boldCyan', text),
  boldUnderline: (text: string) => colorize('boldUnderline', text),
  boldItalic: (text: string) => colorize('boldItalic', text)
}

export function logInitialFunctionCall(functionName: string, details: Record<string, unknown>): void {
  l.opts(`${functionName} called with the following arguments:\n`)
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === 'object' && value !== null) {
      l.opts(`${key}:\n`)
      l.opts(`${JSON.stringify(value, null, 2)}`)
    } else {
      l.opts(`${key}: ${value}`)
    }
  }
  l.opts('')
}

export function logCommandValidation(stage: string, detail: Record<string, unknown>): void {
  const p = '[logging]'
  l.dim(`${p}[CommandValidation:${stage}]`)
  Object.entries(detail).forEach(([key, value]) =>
    l.dim(`${p}  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
  )
}

export function logSeparator(params:
  | { type: 'channel' | 'playlist' | 'urls', index: number, total: number, descriptor: string  }
  | { type: 'rss', index: number, total: number, descriptor: string  }
  | { type: 'completion', descriptor: string  }
) {
  switch (params.type) {
    case 'channel':
    case 'playlist':
    case 'urls':
      l.final(`\n================================================================================================`)
      if (params.type === 'urls') {
        l.final(`  Processing URL ${params.index + 1}/${params.total}: ${params.descriptor}`)
      } else {
        l.final(`  Processing video ${params.index + 1}/${params.total}: ${params.descriptor}`)
      }
      l.final(`================================================================================================\n`)
      break

    case 'rss':
      l.final(`\n========================================================================================`)
      l.final(`  Item ${params.index + 1}/${params.total} processing: ${params.descriptor}`)
      l.final(`========================================================================================\n`)
      break

    case 'completion':
      l.final(`\n================================================================================================`)
      l.final(`  ${params.descriptor} Processing Completed Successfully.`)
      l.final(`================================================================================================\n`)
      break
  }
}

function createChainableLogger(baseLogger: (...args: any[]) => void) {
  const logger = (...args: any[]) => baseLogger(...args)
  const styledLogger = Object.assign(logger, {
    step: (...args: any[]) => baseLogger(colorUtils.boldUnderline(args.join(' '))),
    dim: (...args: any[]) => baseLogger(colorUtils.dim(args.join(' '))),
    success: (...args: any[]) => baseLogger(colorUtils.boldBlue(args.join(' '))),
    warn: (...args: any[]) => baseLogger(colorUtils.boldYellow(args.join(' '))),
    opts: (...args: any[]) => baseLogger(colorUtils.boldMagenta(args.join(' '))),
    info: (...args: any[]) => baseLogger(colorUtils.boldMagenta(args.join(' '))),
    wait: (...args: any[]) => baseLogger(colorUtils.boldCyan(args.join(' '))),
    final: (...args: any[]) => baseLogger(colorUtils.boldItalic(args.join(' '))),
  })
  return styledLogger
}

export const l = createChainableLogger(console.log)

function createErrorLogger(baseLogger: (...args: any[]) => void) {
  return (...args: any[]) => {
    baseLogger(colorUtils.boldRed(args.join(' ')))
    exit(1)
  }
}

export const err = createErrorLogger(console.error)