import { exit } from '@/node-utils'

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  boldGreen: '\x1b[1m\x1b[32m',
  boldYellow: '\x1b[1m\x1b[33m',
  boldRed: '\x1b[1m\x1b[31m'
}

const colorize = (color: keyof typeof colors, text: string): string => {
  return `${colors[color]}${text}${colors.reset}`
}

function getTimestamp(): string {
  const now = new Date()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0')
  return `${hours}:${minutes}:${seconds}.${milliseconds}`
}

function withTimestamp(message: string): string {
  return `[${getTimestamp()}] ${message}`
}

export const colorUtils = {
  bold: (text: string) => colorize('bold', text),
  dim: (text: string) => colorize('dim', text),
  red: (text: string) => colorize('red', text),
  green: (text: string) => colorize('green', text),
  yellow: (text: string) => colorize('yellow', text),
  blue: (text: string) => colorize('blue', text),
  cyan: (text: string) => colorize('cyan', text),
  boldRed: (text: string) => colorize('boldRed', text),
  boldGreen: (text: string) => colorize('boldGreen', text),
  boldYellow: (text: string) => colorize('boldYellow', text)
}

function createChainableLogger(baseLogger: (...args: any[]) => void) {
  const logger = (...args: any[]) => baseLogger(withTimestamp(args.join(' ')))
  const styledLogger = Object.assign(logger, {
    dim: (...args: any[]) => baseLogger(withTimestamp(colorUtils.dim(args.join(' ')))),
    success: (...args: any[]) => baseLogger(withTimestamp(colorUtils.boldGreen(args.join(' ')))),
    warn: (...args: any[]) => baseLogger(withTimestamp(colorUtils.boldYellow(args.join(' ')))),
    opts: (...args: any[]) => baseLogger(withTimestamp(colorUtils.cyan(args.join(' ')))),
    wait: (...args: any[]) => baseLogger(withTimestamp(colorUtils.cyan(args.join(' ')))),
    final: (...args: any[]) => baseLogger(withTimestamp(colorUtils.bold(args.join(' ')))),
  })
  return styledLogger
}

export const l = createChainableLogger(console.log)

function createErrorLogger(baseLogger: (...args: any[]) => void) {
  return (...args: any[]) => {
    baseLogger(withTimestamp(colorUtils.boldRed(args.join(' '))))
    exit(1)
  }
}

export const err = createErrorLogger(console.error)