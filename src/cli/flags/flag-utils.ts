import type { CliFlagDefinition, CliFlagsDefinition } from '~/cli/native'

export const withHelpGroup = (flags: CliFlagsDefinition, group: string): CliFlagsDefinition => {
  const grouped: CliFlagsDefinition = {}
  for (const [name, definition] of Object.entries(flags)) {
    const flagDefinition = definition as CliFlagDefinition
    const existingHelp = flagDefinition.help
    grouped[name] = {
      ...flagDefinition,
      help: {
        ...(typeof existingHelp === 'object' && existingHelp !== null ? existingHelp : {}),
        group
      }
    }
  }
  return grouped
}
