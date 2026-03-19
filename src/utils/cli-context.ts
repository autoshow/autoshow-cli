export type OutputFormat = 'human' | 'json' | 'plain'

export type NetworkConfig = {
  timeout: number
  maxRetries: number
  skipExisting: boolean
}

export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  timeout: 30000,
  maxRetries: 7,
  skipExisting: false
}

export type CliContext = {
  stdoutTTY: boolean
  stderrTTY: boolean
  noColor: boolean
  format: OutputFormat
  quiet: boolean
  verbose: boolean
  noInput: boolean
  network: NetworkConfig
}

let context: CliContext | null = null

function shouldEnableDebug(): boolean {
  const debug = process.env['DEBUG']
  if (!debug) return false
  return debug === '1' || debug === 'autoshow' || debug === 'autoshow-cli'
}

function shouldDisableColor(): boolean {
  if (process.env['NO_COLOR'] !== undefined && process.env['NO_COLOR'] !== '') {
    return true
  }
  
  if (process.env['TERM'] === 'dumb') {
    return true
  }
  
  if (process.env['FORCE_COLOR'] !== undefined && process.env['FORCE_COLOR'] !== '0') {
    return false
  }
  
  return false
}

export function initCliContext(options: {
  noColor?: boolean
  json?: boolean
  plain?: boolean
  quiet?: boolean
  verbose?: boolean
  noInput?: boolean
  timeout?: number
  maxRetries?: number
  skipExisting?: boolean
} = {}): CliContext {
  const stdoutTTY = process.stdout.isTTY ?? false
  const stderrTTY = process.stderr.isTTY ?? false
  
  let format: OutputFormat = 'human'
  if (options.json) {
    format = 'json'
  } else if (options.plain) {
    format = 'plain'
  }
  
  const noColor = options.noColor === true || 
                  shouldDisableColor() || 
                  (!stdoutTTY && format === 'human')
  
  context = {
    stdoutTTY,
    stderrTTY,
    noColor,
    format,
    quiet: options.quiet ?? false,
    verbose: options.verbose ?? shouldEnableDebug(),
    noInput: options.noInput ?? false,
    network: {
      timeout: options.timeout ?? DEFAULT_NETWORK_CONFIG.timeout,
      maxRetries: options.maxRetries ?? DEFAULT_NETWORK_CONFIG.maxRetries,
      skipExisting: options.skipExisting ?? DEFAULT_NETWORK_CONFIG.skipExisting
    }
  }
  
  return context
}

export function getCliContext(): CliContext {
  if (!context) {
    return {
      stdoutTTY: process.stdout.isTTY ?? false,
      stderrTTY: process.stderr.isTTY ?? false,
      noColor: shouldDisableColor(),
      format: 'human',
      quiet: false,
      verbose: false,
      noInput: false,
      network: { ...DEFAULT_NETWORK_CONFIG }
    }
  }
  return context
}

export function resetCliContext(): void {
  context = null
}
