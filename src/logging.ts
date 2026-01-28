import { exit } from '@/node-utils'
import { getCliContext, EXIT_ERROR } from '@/utils'
import type { LogColors } from '@/types/logging'

const isBrowser = typeof window !== 'undefined'

const RESET = '\x1b[0m'
const BOLD = '\x1b[1m'
const UNDERLINE = '\x1b[4m'

const STEP_PATTERN = /^Step \d+:/

const isStepTitle = (message: string): boolean => {
  return STEP_PATTERN.test(message)
}


const NO_COLORS: LogColors = {
  timestamp: '',
  message: '',
  path: '',
  value: '',
  jsonKey: '',
  jsonValue: '',
  error: '',
  success: '',
  stepTitle: ''
}


let colorsCache: LogColors | null = null





const shouldDisableColors = (): boolean => {
  if (isBrowser) return true
  
  const ctx = getCliContext()
  
  
  if (ctx.noColor) return true
  
  
  if (ctx.format === 'plain') return true
  
  
  if (ctx.format === 'json') return true
  
  return false
}


export const resetColorsCache = (): void => {
  colorsCache = null
}

const getColors = (): LogColors => {
  
  if (shouldDisableColors()) {
    return NO_COLORS
  }
  
  if (colorsCache) return colorsCache
  
  colorsCache = {
    timestamp: Bun.color('#6b7280', 'ansi-16m') || '',
    message: Bun.color('#e5e7eb', 'ansi-16m') || '',
    path: Bun.color('#60a5fa', 'ansi-16m') || '',
    value: Bun.color('#fbbf24', 'ansi-16m') || '',
    jsonKey: Bun.color('#a78bfa', 'ansi-16m') || '',
    jsonValue: Bun.color('#34d399', 'ansi-16m') || '',
    error: Bun.color('#ef4444', 'ansi-16m') || '',
    success: Bun.color('#22c55e', 'ansi-16m') || '',
    stepTitle: Bun.color('#f472b6', 'ansi-16m') || ''
  }
  return colorsCache
}

const getTimestamp = (): string => {
  if (isBrowser) return ''
  
  const ctx = getCliContext()
  
  
  if (ctx.format === 'plain' || ctx.format === 'json') return ''
  
  const c = getColors()
  const iso = new Date().toISOString().split('T')[1] || ''
  const time = iso.slice(0, 12)
  return `${c.timestamp}[${time}]${RESET} `
}

const isPath = (str: string): boolean => {
  return str.startsWith('./') || 
         str.startsWith('/') || 
         str.startsWith('../') ||
         /\.[a-z]{2,4}$/.test(str) ||
         str.includes('/output/')
}

const formatJsonObject = (obj: Record<string, unknown>, indent = 2): string => {
  const c = getColors()
  const ctx = getCliContext()
  
  
  if (ctx.format === 'plain') {
    return Object.entries(obj)
      .map(([key, val]) => `${key}=${typeof val === 'string' ? val : JSON.stringify(val)}`)
      .join(' ')
  }
  
  const entries = Object.entries(obj)
  const lines = entries.map(([key, val]) => {
    const spaces = ' '.repeat(indent)
    const formattedKey = `${c.jsonKey}${key}${RESET}`
    
    if (val === null) {
      return `${spaces}${formattedKey}: ${c.jsonValue}null${RESET}`
    }
    
    if (Array.isArray(val)) {
      if (val.length === 0) {
        return `${spaces}${formattedKey}: ${c.jsonValue}[]${RESET}`
      }
      const arrayItems = val.map(item => {
        const itemSpaces = ' '.repeat(indent + 2)
        if (typeof item === 'string') {
          return `${itemSpaces}${c.jsonValue}"${item}"${RESET}`
        }
        return `${itemSpaces}${c.jsonValue}${JSON.stringify(item)}${RESET}`
      }).join(',\n')
      return `${spaces}${formattedKey}: [\n${arrayItems}\n${spaces}]`
    }
    
    if (typeof val === 'object') {
      return `${spaces}${formattedKey}: ${c.jsonValue}${JSON.stringify(val)}${RESET}`
    }
    
    if (typeof val === 'string') {
      const displayVal = isPath(val) 
        ? `${c.path}"${val}"${RESET}`
        : `${c.jsonValue}"${val}"${RESET}`
      return `${spaces}${formattedKey}: ${displayVal}`
    }
    
    return `${spaces}${formattedKey}: ${c.jsonValue}${val}${RESET}`
  })
  
  return `{\n${lines.join(',\n')}\n}`
}





export const l = (message: string, data?: Record<string, unknown>): void => {
  if (isBrowser) {
    console.error(message, data || '')
    return
  }
  
  const ctx = getCliContext()
  
  
  if (ctx.quiet) return
  
  
  if (ctx.format === 'json') return
  
  const c = getColors()
  const timestamp = getTimestamp()
  
  if (isStepTitle(message)) {
    const coloredMessage = ctx.format === 'plain' 
      ? message 
      : `${BOLD}${UNDERLINE}${c.stepTitle}${message}${RESET}`
    if (data) {
      console.error(`\n${timestamp}${coloredMessage} ${formatJsonObject(data)}`)
    } else {
      console.error(`\n${timestamp}${coloredMessage}`)
    }
    return
  }
  
  const coloredMessage = ctx.format === 'plain' ? message : `${c.message}${message}${RESET}`
  
  if (data) {
    console.error(`${timestamp}${coloredMessage} ${formatJsonObject(data)}`)
  } else {
    console.error(`${timestamp}${coloredMessage}`)
  }
}









export const err = (message: string, errorObj?: unknown, exitCode: number = EXIT_ERROR): void => {
  if (isBrowser) {
    console.error(message, errorObj || '')
    return
  }
  
  const ctx = getCliContext()
  const c = getColors()
  const timestamp = getTimestamp()
  const errorMessage = errorObj instanceof Error ? `: ${errorObj.message}` : ''
  
  
  
  if (ctx.format === 'json') {
    console.error(`Error: ${message}${errorMessage}`)
  } else if (ctx.format === 'plain') {
    console.error(`ERROR ${message}${errorMessage}`)
  } else {
    console.error(`${timestamp}${c.error}${message}${errorMessage}${RESET}`)
  }
  
  exit(exitCode)
}





export const success = (message: string, data?: Record<string, unknown>): void => {
  if (isBrowser) {
    console.error(message, data || '')
    return
  }
  
  const ctx = getCliContext()
  
  
  if (ctx.quiet) return
  
  
  if (ctx.format === 'json') return
  
  const c = getColors()
  const timestamp = getTimestamp()
  const coloredMessage = ctx.format === 'plain' ? message : `${c.success}${message}${RESET}`
  
  if (data) {
    console.error(`${timestamp}${coloredMessage} ${formatJsonObject(data)}`)
  } else {
    console.error(`${timestamp}${coloredMessage}`)
  }
}
