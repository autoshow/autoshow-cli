import * as v from 'valibot'
import { formatDuration as formatSharedDuration } from '~/utils/logger/formatters'
import { paint, terminalPalette, terminalStyles } from '~/utils/terminal-colors'

const timestamp = (): string => {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return terminalStyles.muted(`[${h}:${m}:${s}]`)
}

export const bold = (text: string): string => {
  return paint(text, 'white')
}

export const cyan = (text: string): string => {
  return terminalStyles.info(text)
}

export const formatDuration = formatSharedDuration

export const formatCompactCost = (dollars: number): string => {
  return dollars < 0.01
    ? `$${dollars.toFixed(4)}`
    : `$${dollars.toFixed(2)}`
}

const compactParts = (
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
    console.log(timestamp(), terminalStyles.info('\u2022'), firstMessage, ...restMessages)
  } else {
    console.log(timestamp(), terminalStyles.info('\u2022'), ...messages)
  }
}

logBase.dim = (...messages: unknown[]): void => {
  console.log(timestamp(), terminalStyles.muted('\u2022'), terminalStyles.muted(messages.map(String).join(' ')))
}

logBase.success = (message: string): void => {
  console.log(timestamp(), terminalStyles.success('\u2713'), terminalStyles.success(message))
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

  console.error(timestamp(), terminalStyles.error('\u2716'), paint(messages.map(String).join(' '), terminalPalette.error))
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
