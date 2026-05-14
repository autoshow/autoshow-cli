import type { CliCommandDefinition } from './types'

const noop = (): void => {}

export const NATIVE_BUILTIN_COMMANDS = [
  {
    name: 'version',
    description: 'Prints current version',
    flags: {},
    help: { group: 'core' },
    handler: noop
  },
  {
    name: 'help',
    description: 'Show help',
    parameters: [{ key: '[command...]' }],
    flags: {},
    help: {
      group: 'core',
      examples: [
        ['$ bun as help', 'Show help'],
        ['$ bun as help <command>', 'Show help for a specific command'],
        ['$ bun as <command> --help', 'Show help for a specific command']
      ],
      notes: [
        'If no command is specified, show help for the CLI.',
        'If a command is specified, show help for the command.',
        '-h is an alias for --help.'
      ]
    },
    allowExcessParameters: true,
    handler: noop
  }
] as const satisfies readonly CliCommandDefinition[]

export const getNativeBuiltinCommand = (name: string): CliCommandDefinition | undefined =>
  NATIVE_BUILTIN_COMMANDS.find((command) => command.name === name)

export const getNativeRenderableCommands = (
  commands: readonly CliCommandDefinition[]
): readonly CliCommandDefinition[] => [
  ...NATIVE_BUILTIN_COMMANDS,
  ...commands
]
