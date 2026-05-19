import {
  parseIntWithDefault,
  readOptionalStringFlag
} from '../options/flag-readers'
import { hasExplicitOrConfiguredFlag } from './config-flags'

export const resolveProviderConcurrency = (
  flags: Record<string, unknown>,
  flagName: string,
  allShortcutSelected: boolean,
  hostedTargetCount: number,
  explicitFlags: Set<string>,
  configuredFlags: Set<string>
): number => {
  const explicitOrConfigured = hasExplicitOrConfiguredFlag(flagName, explicitFlags, configuredFlags)
  if (allShortcutSelected && !explicitOrConfigured) {
    return Math.max(1, Math.min(8, hostedTargetCount))
  }
  return Math.max(1, parseIntWithDefault(readOptionalStringFlag(flags, flagName), 2))
}

export const resolveLocalConcurrency = (
  flags: Record<string, unknown>,
  flagName: string
): number => Math.max(1, parseIntWithDefault(readOptionalStringFlag(flags, flagName), 1))
