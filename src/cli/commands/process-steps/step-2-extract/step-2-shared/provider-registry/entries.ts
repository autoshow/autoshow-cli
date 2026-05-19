import type { CliFlagsDefinition } from '~/cli/native'
import type {
  Step2Command,
  Step2ModelProviderRegistryEntry,
  Step2ProviderConfigPathEntry,
  Step2ProviderRegistryEntry,
  Step2ShortcutFlag
} from '~/types'
import { STEP2_OCR_PROVIDER_REGISTRY } from './ocr-providers'
import { STEP2_STT_PROVIDER_REGISTRY } from './stt-providers'

export const STEP2_PROVIDER_REGISTRY = [
  ...STEP2_STT_PROVIDER_REGISTRY,
  ...STEP2_OCR_PROVIDER_REGISTRY
] as const satisfies readonly Step2ProviderRegistryEntry[]

const STEP2_PROVIDER_ENTRY_BY_FLAG = new Map<string, Step2ProviderRegistryEntry>()

for (const entry of STEP2_PROVIDER_REGISTRY) {
  STEP2_PROVIDER_ENTRY_BY_FLAG.set(entry.flagName, entry)
}

export const getStep2ProviderEntries = (
  step: Step2Command
): Step2ProviderRegistryEntry[] =>
  STEP2_PROVIDER_REGISTRY.filter((entry) => entry.step === step)

export const getStep2ProviderEntry = (
  flagName: string
): Step2ProviderRegistryEntry | undefined => STEP2_PROVIDER_ENTRY_BY_FLAG.get(flagName)

export const getStep2ProviderFlags = (
  step: Step2Command
): CliFlagsDefinition =>
  Object.fromEntries(
    getStep2ProviderEntries(step).map((entry) => [entry.flagName, entry.flag])
  )

export const getStep2ProviderSelectionFlagNames = (
  step: Step2Command
): string[] => {
  const flags = getStep2ProviderEntries(step)
    .filter((entry) => entry.resumeSelectable)
    .map((entry) => entry.flagName)

  return [...new Set(flags)]
}

export const getStep2ProviderConfigPathEntries = (): Step2ProviderConfigPathEntry[] =>
  STEP2_PROVIDER_REGISTRY.map((entry) => ({
    flagName: entry.flagName,
    configPath: entry.configPath
  }))

export const getStep2AllShortcutModelExpansions = (): Record<string, { shortcut: Step2ShortcutFlag, supported: readonly string[] }> =>
  Object.fromEntries(
    STEP2_PROVIDER_REGISTRY
      .filter((entry) => entry.selection.type === 'models' && entry.allShortcut !== undefined)
      .map((entry) => [
        entry.flagName,
        {
          shortcut: entry.allShortcut as Step2ShortcutFlag,
          supported: (entry.selection as Step2ModelProviderRegistryEntry['selection']).supportedModels
        }
      ] as const)
  )

export const getStep2BootstrapProviderId = (
  step: Step2Command,
  targetService: string
): string | undefined =>
  getStep2ProviderEntries(step).find((entry) => entry.targetService === targetService)?.bootstrapProviderId
