import type { ClercFlagDefinitionValue, ClercFlagsDefinition } from 'clerc'

export const withHelpGroup = (flags: ClercFlagsDefinition, group: string): ClercFlagsDefinition => {
  const grouped: ClercFlagsDefinition = {}
  for (const [name, definition] of Object.entries(flags)) {
    const flagDefinition = definition as ClercFlagDefinitionValue
    if (typeof flagDefinition === 'function' || Array.isArray(flagDefinition)) {
      grouped[name] = flagDefinition
      continue
    }

    const existingHelp = (flagDefinition as { help?: Record<string, unknown> }).help
    grouped[name] = {
      ...(flagDefinition as object),
      help: {
        ...(typeof existingHelp === 'object' && existingHelp !== null ? existingHelp : {}),
        group
      }
    } as ClercFlagDefinitionValue
  }
  return grouped
}
