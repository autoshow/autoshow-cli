import type {
  CliCommandDefinition,
  CliFlagDefinition,
  CliFlagsDefinition,
  CliParameterDefinition,
  CliRootDefinition
} from './types'
import {
  colorText,
  HELP_DEFAULT_VALUE_COLOR_NAME,
  HELP_TYPE_COLOR
} from '~/cli/help-colors'
import { getNativeRenderableCommands } from './builtins'

const ANSI_ESCAPE_PATTERN = /\x1b\[[0-9;]*m/g

const formatType = (definition: CliFlagDefinition): string => {
  const label = Array.isArray(definition.type)
    ? 'Array<String>'
    : definition.type === Boolean
      ? 'Boolean'
      : 'String'
  return colorText(label, HELP_TYPE_COLOR)
}

const formatParameterType = (parameter: CliParameterDefinition): string =>
  parameter.key.includes('...')
    ? 'Array<string>'
    : 'string'

const formatDefaultValue = (value: unknown): string => {
  if (typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value)
  }
  return String(value)
}

const formatDefault = (value: unknown): string =>
  colorText(`[default: ${formatDefaultValue(value)}]`, HELP_DEFAULT_VALUE_COLOR_NAME)

const visibleLength = (value: string): number =>
  value.replace(ANSI_ESCAPE_PATTERN, '').length

const padRight = (value: string, width: number): string =>
  visibleLength(value) >= width ? value : `${value}${' '.repeat(width - visibleLength(value))}`

const flagGroup = (definition: CliFlagDefinition): string | undefined => {
  const group = definition.help?.['group']
  return typeof group === 'string' ? group : undefined
}

const isFlagHidden = (definition: CliFlagDefinition): boolean =>
  definition.help?.hidden === true

const formatFlagName = (name: string, definition: CliFlagDefinition): string => {
  return definition.short ? `--${name}, -${definition.short}` : `--${name}`
}

const renderFlagRows = (flags: CliFlagsDefinition, indent = '  '): string[] => {
  const rows = Object.entries(flags).filter(([, definition]) => !isFlagHidden(definition)).map(([name, definition]) => {
    const defaultSuffix = 'default' in definition ? ` ${formatDefault(definition.default)}` : ''
    return [
      formatFlagName(name, definition),
      formatType(definition),
      `${definition.description}${defaultSuffix}`
    ] as const
  })
  const nameWidth = rows.reduce((width, [name]) => Math.max(width, visibleLength(name)), 0)
  const typeWidth = rows.reduce((width, [, type]) => Math.max(width, visibleLength(type)), 0)
  return rows.map(([name, type, description]) => {
    const prefix = `${indent}${padRight(name, nameWidth)}  ${padRight(type, typeWidth)}  `
    if (!description.includes('\n')) {
      return `${prefix}${description}`
    }
    const continuationPadding = ' '.repeat(visibleLength(prefix))
    const [firstLine, ...rest] = description.split('\n')
    return [
      `${prefix}${firstLine}`,
      ...rest.map((line) => `${continuationPadding}${line}`)
    ].join('\n')
  })
}

const orderGlobalFlags = (flags: CliFlagsDefinition): CliFlagsDefinition => {
  const entries = Object.entries(flags)
  const order = ['version', 'help']
  const orderedEntries = [
    ...order.flatMap((name) => {
      const definition = flags[name]
      return definition ? [[name, definition] as const] : []
    }),
    ...entries.filter(([name]) => !order.includes(name))
  ]
  return Object.fromEntries(orderedEntries) as CliFlagsDefinition
}

const renderGroupedFlags = (
  flags: CliFlagsDefinition,
  groups: CliRootDefinition['flagGroups']
): string[] => {
  const entries = Object.entries(flags)
  if (entries.length === 0) {
    return []
  }

  const groupedKeys = new Set<string>()
  const lines: string[] = []
  for (const [groupKey, label] of groups) {
    const groupFlags = Object.fromEntries(
      entries.filter(([, definition]) => flagGroup(definition) === groupKey)
    ) as CliFlagsDefinition
    if (Object.keys(groupFlags).length === 0) {
      continue
    }
    lines.push(`  ${label}`, ...renderFlagRows(groupFlags, '    '), '  ')
    for (const key of Object.keys(groupFlags)) {
      groupedKeys.add(key)
    }
  }

  const ungrouped = Object.fromEntries(entries.filter(([name]) => !groupedKeys.has(name))) as CliFlagsDefinition
  if (Object.keys(ungrouped).length > 0) {
    lines.push(...renderFlagRows(ungrouped, '  '), '')
  }

  return lines
}

const renderParameters = (command: CliCommandDefinition): string[] => {
  const parameters = command.parameters ?? []
  if (parameters.length === 0) {
    return []
  }

  const rows = parameters.map((parameter) => [
    parameter.key,
    formatParameterType(parameter),
    parameter.description ?? ''
  ] as const)
  const nameWidth = rows.reduce((width, [name]) => Math.max(width, visibleLength(name)), 0)
  const typeWidth = rows.reduce((width, [, type]) => Math.max(width, visibleLength(type)), 0)
  return [
    'Parameters',
    ...rows.map(([name, type, description]) => {
      const prefix = `  ${padRight(name, nameWidth)}  ${padRight(type, typeWidth)}`
      return description.length > 0 ? `${prefix}  ${description}` : prefix
    }),
    ''
  ]
}

const renderExamples = (command: CliCommandDefinition): string[] => {
  const examples = command.help?.examples ?? []
  if (examples.length === 0) {
    return []
  }
  const width = examples.reduce((value, [example]) => Math.max(value, visibleLength(example)), 0)
  return [
    'Examples',
    ...examples.map(([example, description]) => `  ${padRight(example, width)}  -  ${description}`),
    ''
  ]
}

const renderNotes = (command: CliCommandDefinition): string[] => {
  const notes = command.help?.notes ?? []
  if (notes.length === 0) {
    return []
  }
  return ['Notes', ...notes.map((note) => `  ${note}`), '']
}

const formatVersion = (version: string): string =>
  version.startsWith('v') ? version : `v${version}`

export const renderRootHelp = (
  root: CliRootDefinition,
  commands: readonly CliCommandDefinition[]
): string => {
  const lines = [
    `${root.scriptName} ${formatVersion(root.version)} - ${root.description}`,
    '',
    'Usage',
    `  $ ${root.scriptName} <command> [flags]`,
    '',
    'Global Flags',
    ...renderFlagRows(orderGlobalFlags(root.globalFlags), '  '),
    '',
    'Commands'
  ]

  const commandEntries = getNativeRenderableCommands(commands).map((command) => [command, command.help?.group] as const)
  for (const [groupKey, label] of root.commandGroups) {
    const groupCommands = commandEntries
      .filter(([, group]) => group === groupKey)
      .map(([command]) => command)
    if (groupCommands.length === 0) {
      continue
    }
    lines.push(`  ${label}`)
    const nameWidth = groupCommands.reduce((width, command) => Math.max(width, visibleLength(command.name)), 0)
    for (const command of groupCommands) {
      lines.push(`    ${padRight(command.name, nameWidth)}  ${command.description}`)
    }
    lines.push('  ')
  }

  while (lines.at(-1) === '  ') {
    lines.pop()
  }

  return `${lines.join('\n')}\n`
}

export const renderCommandHelp = (
  root: CliRootDefinition,
  command: CliCommandDefinition
): string => {
  const parameterUsage = (command.parameters ?? []).map((parameter) => parameter.key).join(' ')
  const usageParts = [root.scriptName, command.name, parameterUsage, '[flags]'].filter(Boolean)
  const lines = [
    `${root.scriptName} ${command.name} ${formatVersion(root.version)} - ${command.description}`,
    '',
    'Usage',
    `  $ ${usageParts.join(' ')}`,
    ''
  ]

  lines.push(...renderParameters(command))

  const flags = command.flags ?? {}
  if (Object.keys(flags).length > 0) {
    lines.push('Flags')
    lines.push(...renderGroupedFlags(flags, root.flagGroups))
    if (lines.at(-1) !== '') {
      lines.push('')
    }
  }

  lines.push('Global Flags', ...renderFlagRows(orderGlobalFlags(root.globalFlags), '  '), '')

  const examples = renderExamples(command)
  if (examples.length > 0) {
    lines.push(...examples)
  }
  const notes = renderNotes(command)
  if (notes.length > 0) {
    lines.push(...notes)
  }

  while (lines.at(-1) === '') {
    lines.pop()
  }

  return `${lines.join('\n')}\n`
}
