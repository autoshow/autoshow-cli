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

export const renameFlags = (
  flags: CliFlagsDefinition,
  publicNameByInternalName: Record<string, string>
): CliFlagsDefinition => {
  const renamed: CliFlagsDefinition = {}
  for (const [name, definition] of Object.entries(flags)) {
    renamed[publicNameByInternalName[name] ?? name] = definition
  }
  return renamed
}

export const aliasFlags = (
  flags: CliFlagsDefinition,
  publicNameByInternalName: Record<string, string>
): CliFlagsDefinition => {
  const aliased = renameFlags(flags, publicNameByInternalName)

  for (const [internalName, definition] of Object.entries(flags)) {
    if (!(internalName in publicNameByInternalName)) {
      continue
    }
    aliased[internalName] = {
      ...definition,
      help: {
        ...(definition.help ?? {}),
        hidden: true
      }
    }
  }

  return aliased
}

export const omitFlags = (
  flags: CliFlagsDefinition,
  names: readonly string[]
): CliFlagsDefinition => {
  const omitted = new Set(names)
  return Object.fromEntries(
    Object.entries(flags).filter(([name]) => !omitted.has(name))
  ) as CliFlagsDefinition
}
