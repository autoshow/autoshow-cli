import type {
  CliCommandDefinition,
  CliFlagDefinition,
  CliFlagsDefinition,
  CliFlagValues,
  CliParameterDefinition,
  CliParameterValues,
  CliParseResult,
  CliRawParsed
} from './types'
import {
  NativeInvalidParametersError,
  NativeMissingFlagValueError,
  NativeNoSuchCommandError
} from './errors'
import { getNativeBuiltinCommand } from './builtins'

const createCommandMap = (
  commands: readonly CliCommandDefinition[]
): Map<string, CliCommandDefinition> =>
  new Map(commands.map((command) => [command.name, command]))

const findCommand = (
  commands: Map<string, CliCommandDefinition>,
  name: string
): CliCommandDefinition | undefined =>
  commands.get(name) ?? getNativeBuiltinCommand(name)

const camelize = (value: string): string =>
  value.replace(/-([a-zA-Z0-9])/g, (_match, char: string) => char.toUpperCase())

const parameterName = (parameter: CliParameterDefinition): string =>
  parameter.key.replace(/^[<[{]/, '').replace(/[>\]}]$/, '')

const parameterRequired = (parameter: CliParameterDefinition): boolean =>
  parameter.key.startsWith('<')

const isHelpFlag = (arg: string | undefined): boolean =>
  arg === '--help' || arg === '-h'

const isVersionFlag = (arg: string | undefined): boolean =>
  arg === '--version' || arg === '-v' || arg === '-V'

const isRepeatableStringFlag = (definition: CliFlagDefinition): boolean =>
  Array.isArray(definition.type)

const isBooleanFlag = (definition: CliFlagDefinition): boolean =>
  definition.type === Boolean

const cloneDefaultValue = (value: unknown): unknown =>
  Array.isArray(value) ? [...value] : value

const buildShortFlagMap = (flags: CliFlagsDefinition): Map<string, string> => {
  const aliases = new Map<string, string>()
  for (const [name, definition] of Object.entries(flags)) {
    if (definition.short) {
      aliases.set(definition.short, name)
    }
  }
  return aliases
}

const coerceBooleanValue = (rawValue: string | true): boolean => {
  if (rawValue === true) {
    return true
  }
  const normalized = rawValue.trim().toLowerCase()
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false
  }
  return true
}

const setFlagValue = (
  flags: CliFlagValues,
  name: string,
  definition: CliFlagDefinition,
  value: string | true
): void => {
  if (isBooleanFlag(definition)) {
    flags[name] = coerceBooleanValue(value)
    return
  }

  if (isRepeatableStringFlag(definition)) {
    const current = flags[name]
    const values = Array.isArray(current) ? [...current] : current === undefined ? [] : [current]
    values.push(value)
    flags[name] = values
    return
  }

  if (value === true) {
    throw new NativeMissingFlagValueError(name)
  }
  flags[name] = value
}

const getNextFlagValue = (
  argv: string[],
  index: number,
  name: string,
  definition: CliFlagDefinition
): { value: string | true, consumedNext: boolean } => {
  if (isBooleanFlag(definition) || isRepeatableStringFlag(definition)) {
    const next = argv[index + 1]
    if (isRepeatableStringFlag(definition) && typeof next === 'string' && next !== '--' && !next.startsWith('-')) {
      return { value: next, consumedNext: true }
    }
    return { value: true, consumedNext: false }
  }

  const next = argv[index + 1]
  if (typeof next !== 'string' || next === '--' || next.startsWith('-')) {
    throw new NativeMissingFlagValueError(name)
  }
  return { value: next, consumedNext: true }
}

const parseLongFlag = (
  argv: string[],
  index: number,
  flags: CliFlagValues,
  explicitFlags: Set<string>,
  unknown: Record<string, unknown>,
  definitions: CliFlagsDefinition
): number => {
  const arg = argv[index] as string
  const raw = arg.slice(2)
  const eqIndex = raw.indexOf('=')
  const name = eqIndex === -1 ? raw : raw.slice(0, eqIndex)
  const inlineValue = eqIndex === -1 ? undefined : raw.slice(eqIndex + 1)
  const definition = definitions[name]

  if (definition === undefined) {
    unknown[camelize(name)] = inlineValue ?? true
    return index
  }

  explicitFlags.add(name)
  if (inlineValue !== undefined) {
    setFlagValue(flags, name, definition, inlineValue.length > 0 ? inlineValue : true)
    return index
  }

  const { value, consumedNext } = getNextFlagValue(argv, index, name, definition)
  setFlagValue(flags, name, definition, value)
  return consumedNext ? index + 1 : index
}

const parseShortFlag = (
  argv: string[],
  index: number,
  flags: CliFlagValues,
  explicitFlags: Set<string>,
  unknown: Record<string, unknown>,
  definitions: CliFlagsDefinition,
  shortFlags: Map<string, string>
): number => {
  const arg = argv[index] as string
  const short = arg.slice(1)
  const name = shortFlags.get(short) ?? (short === 'V' ? 'version' : undefined)
  if (name === undefined) {
    unknown[short] = true
    return index
  }

  const definition = definitions[name]
  if (definition === undefined) {
    unknown[short] = true
    return index
  }

  explicitFlags.add(name)
  const { value, consumedNext } = getNextFlagValue(argv, index, name, definition)
  setFlagValue(flags, name, definition, value)
  return consumedNext ? index + 1 : index
}

const buildInitialFlags = (definitions: CliFlagsDefinition): CliFlagValues => {
  const flags = {} as CliFlagValues
  for (const [name, definition] of Object.entries(definitions)) {
    if ('default' in definition) {
      flags[name] = cloneDefaultValue(definition.default)
    }
  }
  return flags
}

const assignParameters = (
  command: CliCommandDefinition,
  positional: string[]
): CliParameterValues => {
  const parameters = {} as CliParameterValues
  const definitions = command.parameters ?? []

  for (let index = 0; index < definitions.length; index++) {
    const definition = definitions[index] as CliParameterDefinition
    const value = positional[index]
    if (value !== undefined) {
      parameters[parameterName(definition)] = value
      continue
    }
    if (parameterRequired(definition)) {
      throw new NativeInvalidParametersError(`Missing required parameter: ${parameterName(definition)}`)
    }
  }

  if (command.allowExcessParameters === false && positional.length > definitions.length) {
    throw new NativeInvalidParametersError(`Unexpected parameter "${positional[definitions.length]}"`)
  }

  return parameters
}

const buildRawParsed = (
  doubleDash: string[],
  explicitFlags: Set<string>,
  unknown: Record<string, unknown>
): CliRawParsed => ({
  doubleDash,
  explicitFlags,
  unknown
})

export const parseNativeCli = (
  argv: string[],
  commands: readonly CliCommandDefinition[],
  globalFlags: CliFlagsDefinition
): CliParseResult => {
  const commandMap = createCommandMap(commands)

  if (argv.length === 0) {
    return {
      mode: 'help',
      argv,
      flags: buildInitialFlags(globalFlags),
      parameters: {} as CliParameterValues,
      rawParsed: buildRawParsed([], new Set(['help']), {})
    }
  }

  const first = argv[0] as string
  if (isHelpFlag(first)) {
    return {
      mode: 'help',
      argv,
      flags: buildInitialFlags(globalFlags),
      parameters: {} as CliParameterValues,
      rawParsed: buildRawParsed([], new Set(['help']), {})
    }
  }
  if (isVersionFlag(first)) {
    return {
      mode: 'version',
      argv,
      flags: buildInitialFlags(globalFlags),
      parameters: {} as CliParameterValues,
      rawParsed: buildRawParsed([], new Set(['version']), {})
    }
  }
  if (first === 'version') {
    if (argv.slice(1).some(isHelpFlag)) {
      const versionCommand = getNativeBuiltinCommand('version')!
      return {
        mode: 'help',
        argv,
        calledAs: 'version',
        command: versionCommand,
        flags: buildInitialFlags(globalFlags),
        parameters: {} as CliParameterValues,
        rawParsed: buildRawParsed([], new Set(['help']), {})
      }
    }
    return {
      mode: 'version',
      argv,
      calledAs: 'version',
      flags: buildInitialFlags(globalFlags),
      parameters: {} as CliParameterValues,
      rawParsed: buildRawParsed([], new Set(), {})
    }
  }
  if (first === 'help') {
    const commandName = argv[1]
    if (isVersionFlag(commandName)) {
      return {
        mode: 'version',
        argv,
        calledAs: 'help',
        flags: buildInitialFlags(globalFlags),
        parameters: {} as CliParameterValues,
        rawParsed: buildRawParsed([], new Set(['version']), {})
      }
    }
    const helpCommandName = isHelpFlag(commandName) ? 'help' : commandName
    const command = typeof helpCommandName === 'string' ? findCommand(commandMap, helpCommandName) : undefined
    if (typeof helpCommandName === 'string' && command === undefined) {
      throw new NativeNoSuchCommandError(helpCommandName)
    }
    return {
      mode: 'help',
      argv,
      ...(command ? { calledAs: command.name, command } : {}),
      flags: buildInitialFlags(globalFlags),
      parameters: {} as CliParameterValues,
      rawParsed: buildRawParsed([], new Set(['help']), {})
    }
  }

  const command = commandMap.get(first)
  if (command === undefined) {
    throw new NativeNoSuchCommandError(first)
  }

  const definitions = {
    ...globalFlags,
    ...(command.flags ?? {})
  }
  const shortFlags = buildShortFlagMap(definitions)
  const flags = buildInitialFlags(definitions)
  const explicitFlags = new Set<string>()
  const unknown: Record<string, unknown> = {}
  const positional: string[] = []
  let doubleDash: string[] = []

  for (let index = 1; index < argv.length; index++) {
    const arg = argv[index] as string
    if (arg === '--') {
      doubleDash = argv.slice(index + 1)
      break
    }
    if (
      (arg === '--help' || arg === '-h') &&
      !(command.passThroughHelpAfterFirstPositional === true && positional.length > 0)
    ) {
      explicitFlags.add('help')
      flags['help'] = true
      return {
        mode: 'help',
        argv,
        calledAs: command.name,
        command,
        flags,
        parameters: {} as CliParameterValues,
        rawParsed: buildRawParsed(doubleDash, explicitFlags, unknown)
      }
    }
    if (arg === '--version' || arg === '-v' || arg === '-V') {
      explicitFlags.add('version')
      flags['version'] = true
      return {
        mode: 'version',
        argv,
        calledAs: command.name,
        command,
        flags,
        parameters: {} as CliParameterValues,
        rawParsed: buildRawParsed(doubleDash, explicitFlags, unknown)
      }
    }
    if (arg.startsWith('--') && arg.length > 2) {
      index = parseLongFlag(argv, index, flags, explicitFlags, unknown, definitions)
      continue
    }
    if (arg.startsWith('-') && arg.length > 1) {
      index = parseShortFlag(argv, index, flags, explicitFlags, unknown, definitions, shortFlags)
      continue
    }
    positional.push(arg)
  }

  const parameters = assignParameters(command, positional)
  return {
    mode: 'command',
    argv,
    calledAs: command.name,
    command,
    flags,
    parameters,
    rawParsed: buildRawParsed(doubleDash, explicitFlags, unknown)
  }
}
