const ANSI_RESET = '\x1b[0m'
const ANSI_ESCAPE_PATTERN = /\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g
const SGR_COLOR_PATTERN = /^\x1b\[[0-9;]*m$/

type TerminalColorStream = {
  isTTY?: boolean | undefined
}

type TerminalPaintOptions = {
  enabled?: boolean | undefined
  stream?: TerminalColorStream | undefined
}

const isForceColorEnabled = (): boolean => {
  const value = process.env['FORCE_COLOR']
  return typeof value === 'string' && value !== '' && value !== '0'
}

export const shouldUseTerminalColors = (stream: TerminalColorStream = process.stdout): boolean => {
  if (isForceColorEnabled()) {
    return true
  }
  if (process.env['NO_COLOR'] !== undefined) {
    return false
  }
  return stream.isTTY === true
}

export const stripAnsi = (text: string): string =>
  text.replace(ANSI_ESCAPE_PATTERN, '')

const usableAnsiCode = (code: string | null | undefined): string =>
  code && SGR_COLOR_PATTERN.test(code) ? code : ''

export const paint = (
  text: string,
  color: string,
  options: TerminalPaintOptions = {}
): string => {
  if (text.length === 0) {
    return text
  }
  if (!(options.enabled ?? shouldUseTerminalColors(options.stream))) {
    return text
  }

  const ansiCode = usableAnsiCode(Bun.color(color, 'ansi')) || usableAnsiCode(Bun.color(color, 'ansi-16m'))
  if (ansiCode.length === 0) {
    return text
  }

  return `${ansiCode}${text}${ANSI_RESET}`
}

export const terminalPalette = {
  muted: 'gray',
  success: 'limegreen',
  info: 'deepskyblue',
  pending: 'cyan',
  warning: 'gold',
  error: 'red',
  cost: 'goldenrod',
  duration: 'darkorange',
  throughput: 'lightseagreen',
  path: 'mediumaquamarine',
  pathBase: 'deepskyblue',
  provider: 'lightseagreen',
  model: 'deepskyblue',
  extract: 'mediumseagreen',
  stt: 'dodgerblue',
  llm: 'cornflowerblue',
  tts: 'darkorange',
  image: 'hotpink',
  video: 'mediumpurple',
  music: 'gold'
} as const

const createSemanticPainter =
  (color: string) =>
    (text: string, options?: TerminalPaintOptions): string =>
      paint(text, color, options)

export const terminalStyles = {
  muted: createSemanticPainter(terminalPalette.muted),
  success: createSemanticPainter(terminalPalette.success),
  info: createSemanticPainter(terminalPalette.info),
  pending: createSemanticPainter(terminalPalette.pending),
  warning: createSemanticPainter(terminalPalette.warning),
  error: createSemanticPainter(terminalPalette.error),
  cost: createSemanticPainter(terminalPalette.cost),
  duration: createSemanticPainter(terminalPalette.duration),
  throughput: createSemanticPainter(terminalPalette.throughput),
  path: createSemanticPainter(terminalPalette.path),
  provider: createSemanticPainter(terminalPalette.provider),
  model: createSemanticPainter(terminalPalette.model)
} as const
