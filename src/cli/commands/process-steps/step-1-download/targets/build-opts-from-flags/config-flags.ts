const CONFIG_INJECTED_FLAGS_KEY = '__autoshowConfigInjectedFlags'

export const readInjectedConfigFlags = (flags: Record<string, unknown>): Set<string> => {
  const value = flags[CONFIG_INJECTED_FLAGS_KEY]
  return new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [])
}

export const hasExplicitOrConfiguredFlag = (
  flagName: string,
  explicitFlags: Set<string>,
  configuredFlags: Set<string>
): boolean => explicitFlags.has(flagName) || configuredFlags.has(flagName)
