const ansiReset = '\x1b[0m'
const isForceColorEnabled = (): boolean => {
  const value = process.env['FORCE_COLOR']
  return typeof value === 'string' && value !== '' && value !== '0'
}

const shouldUseHelpColors = (): boolean => {
  if (isForceColorEnabled()) {
    return true
  }
  if (process.env['NO_COLOR'] !== undefined) {
    return false
  }
  return process.stdout.isTTY === true
}

export const helpColorsEnabled = shouldUseHelpColors()

export const colorText = (text: string, color: string): string => {
  if (!helpColorsEnabled) {
    return text
  }
  if (text.length === 0) {
    return text
  }
  const ansiCode = Bun.color(color, 'ansi-16m') ?? ''
  if (ansiCode.length === 0) {
    return text
  }
  return `${ansiCode}${text}${ansiReset}`
}

const HELP_GROUP_COLOR_BY_KEY: Readonly<Record<string, string>> = {
  config: 'lightseagreen',
  pricing: 'goldenrod',
  'step-1-download': 'deepskyblue',
  'step-2-stt': 'dodgerblue',
  'step-2-ocr': 'mediumseagreen',
  'step-3-write': 'cornflowerblue',
  'step-4-tts': 'darkorange',
  'step-5-image': 'hotpink',
  'step-6-video': 'mediumpurple',
  'step-7-music': 'gold'
}

const HELP_DEFAULT_VALUE_COLOR = 'springgreen'
const HELP_FLAG_NAME_COLOR = 'cyan'
export const HELP_TYPE_COLOR = 'lightsalmon'
const HELP_MODEL_VALUE_COLOR = 'deepskyblue'
const HELP_MODEL_DELIMITER_COLOR = 'steelblue'
const HELP_MODEL_SEGMENT_PATTERN = /(\bmodel(?:s)?(?:\s+ID)?(?:\s*\([^)]*\))?\s*:\s*)([^\n]+)/gi
const HELP_FLAG_ROW_PATTERN = /^(\s+)(--.+?)(\s{2,})(.*)$/gm
const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/

const hasAnsiEscapes = (text: string): boolean => ANSI_ESCAPE_PATTERN.test(text)

const colorizeModelToken = (token: string): string => {
  const leadingWhitespace = token.match(/^\s*/)?.[0] ?? ''
  const trailingWhitespace = token.match(/\s*$/)?.[0] ?? ''
  const core = token.slice(leadingWhitespace.length, token.length - trailingWhitespace.length)
  if (core.length === 0) {
    return token
  }
  return `${leadingWhitespace}${colorText(core, HELP_MODEL_VALUE_COLOR)}${trailingWhitespace}`
}

const colorizeModelValueList = (modelValues: string): string => {
  const parts = modelValues.split('|')
  const divider = colorText('|', HELP_MODEL_DELIMITER_COLOR)
  return parts.map(colorizeModelToken).join(divider)
}

export const colorizeHelpDescription = (description: string): string => {
  if (!helpColorsEnabled || hasAnsiEscapes(description)) {
    return description
  }

  return description.replace(HELP_MODEL_SEGMENT_PATTERN, (_match, prefix: string, modelValues: string) => {
    return `${prefix}${colorizeModelValueList(modelValues)}`
  })
}

const colorizeHelpFlagRows = (rendered: string): string => {
  const hasHelpSections = rendered.includes('\nFlags\n') || rendered.includes('\nGlobal Flags\n')
  if (!helpColorsEnabled || (!hasHelpSections && hasAnsiEscapes(rendered))) {
    return rendered
  }

  return rendered.replace(HELP_FLAG_ROW_PATTERN, (_match, indent: string, flagName: string, spacing: string, tail: string) => {
    return `${indent}${colorText(flagName, HELP_FLAG_NAME_COLOR)}${spacing}${tail}`
  })
}

export const withPatchedHelpConsole = async (run: () => Promise<void>): Promise<void> => {
  const originalLog = console.log
  console.log = (...args: unknown[]): void => {
    const transformed = args.map(arg => {
      if (typeof arg !== 'string') {
        return arg
      }
      return colorizeHelpFlagRows(arg)
    })
    originalLog(...transformed)
  }

  try {
    await run()
  } finally {
    console.log = originalLog
  }
}

export const shouldPatchHelpConsole = (argv: string[]): boolean => {
  if (argv.length === 0) {
    return true
  }
  if (argv[0] === 'help') {
    return true
  }
  return argv.includes('--help') || argv.includes('-h')
}

export const colorizeFlagDescriptions = (flags: Record<string, unknown> | undefined): void => {
  if (!helpColorsEnabled || flags === undefined) {
    return
  }

  for (const definition of Object.values(flags)) {
    if (typeof definition !== 'object' || definition === null || Array.isArray(definition)) {
      continue
    }

    const optionDefinition = definition as Record<string, unknown>
    const description = optionDefinition['description']
    if (typeof description !== 'string') {
      continue
    }

    optionDefinition['description'] = colorizeHelpDescription(description)
  }
}

export const colorizeHelpFlagGroups = (
  groups: readonly (readonly [string, string])[]
): [string, string][] => {
  return groups.map(([key, label]) => {
    const color = HELP_GROUP_COLOR_BY_KEY[key]
    if (typeof color !== 'string') {
      return [key, label]
    }
    return [key, colorText(label, color)]
  })
}

export const HELP_DEFAULT_VALUE_COLOR_NAME = HELP_DEFAULT_VALUE_COLOR
