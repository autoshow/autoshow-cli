import * as v from 'valibot'

const RESET = '\x1b[0m'
const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'

const colorize = (text: string, color: string): string => {
  return `${color}${text}${RESET}`
}

const timestamp = (): string => {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  const ms = String(now.getMilliseconds()).padStart(3, '0')
  return colorize(`${h}:${m}:${s}.${ms}`, DIM)
}

export const bold = (text: string): string => {
  return `${BOLD}${text}${RESET}`
}

export const cyan = (text: string): string => {
  return `${CYAN}${text}${RESET}`
}

export const green = (text: string): string => {
  return `${GREEN}${text}${RESET}`
}

export const red = (text: string): string => {
  return `${RED}${text}${RESET}`
}

export const formatDuration = (durationMs: number): string => {
  return `${(durationMs / 1000).toFixed(2)}s`
}

export const formatCompactCost = (dollars: number): string => {
  return dollars < 0.01
    ? `$${dollars.toFixed(4)}`
    : `$${dollars.toFixed(2)}`
}

export const compactParts = (
  parts: Array<string | number | false | null | undefined>
): string => {
  return parts
    .filter((part): part is string | number => part !== false && part !== null && part !== undefined && String(part).length > 0)
    .map(String)
    .join(' ')
}

const logBase = (...messages: unknown[]): void => {
  const firstMessage = messages[0]
  const restMessages = messages.slice(1)

  if (typeof firstMessage === 'string' && firstMessage.includes('\x1b[')) {
    console.log(timestamp(), colorize('►', CYAN), firstMessage, ...restMessages)
  } else {
    console.log(timestamp(), colorize('►', CYAN), ...messages)
  }
}

logBase.dim = (...messages: unknown[]): void => {
  console.log(timestamp(), `${DIM}${messages.map(String).join(' ')}${RESET}`)
}

logBase.success = (message: string): void => {
  console.log(timestamp(), colorize('✓', GREEN), colorize(message, GREEN))
}

export const l = logBase

export const comicLog = {
  header(command: string, details: Array<string | number | false | null | undefined> = []): void {
    l(`${bold(command)}${details.length > 0 ? ` ${compactParts(details)}` : ''}`)
  },

  line(label: string, details: Array<string | number | false | null | undefined> = []): void {
    l.dim(`${label}${details.length > 0 ? ` ${compactParts(details)}` : ''}`)
  },

  output(
    status: 'generated' | 'skipped' | 'combined',
    kind: string,
    details: Array<string | number | false | null | undefined>
  ): void {
    l.dim(compactParts([status, kind, ...details]))
  },

  summary(details: Array<string | number | false | null | undefined>): void {
    l.dim(compactParts(['summary', ...details]))
  },

  outputDirectory(path: string): void {
    l.dim(`output directory: ${path}`)
  },
}

const errBase = (...messages: unknown[]): void => {
  if (messages.length === 1 && v.isValiError(messages[0])) {
    errValidation(messages[0])
    return
  }

  console.error(timestamp(), colorize('✗', RED), colorize(messages.map(String).join(' '), RED))
}

const errValidation = (error: v.ValiError<v.GenericSchema | v.GenericSchemaAsync>): void => {
  errBase('Validation error:')

  const issues = Array.isArray(error.issues) ? error.issues : []

  if (issues.length === 0) {
    errBase(`  - ${error.message}`)
    return
  }

  const flatErrors = v.flatten(issues as [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]])

  if (flatErrors.root) {
    flatErrors.root.forEach(msg => errBase(`  - ${msg}`))
  }

  if (flatErrors.nested) {
    Object.entries(flatErrors.nested).forEach(([path, messages]) => {
      if (messages) {
        messages.forEach(msg => errBase(`  - ${path}: ${msg}`))
      }
    })
  }
}

export const err = errBase
