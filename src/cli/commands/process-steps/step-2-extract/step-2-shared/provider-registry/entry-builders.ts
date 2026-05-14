import type { CliFlagDefinition } from '~/cli/native'
import type {
  RuntimeOptions,
  Step2BooleanProviderRegistryEntry,
  Step2BooleanSelectionKey,
  Step2Command,
  Step2ModelProviderRegistryEntry,
  Step2Modality,
  Step2ShortcutFlag
} from '~/types'

const createBooleanFlag = (
  description: string
): CliFlagDefinition => ({
  description,
  type: Boolean,
  default: false,
  negatable: false
})

const createRepeatableModelFlag = (
  description: string,
  defaultValue?: string[]
): CliFlagDefinition => ({
  description,
  type: [String] as [StringConstructor],
  ...(defaultValue ? { default: defaultValue } : {})
} as CliFlagDefinition)

const step2ConfigPath = (
  step: Step2Command,
  key: string
): readonly string[] => ['defaults', 'extract', step, key]

export const booleanProvider = (
  entry: {
    step: Step2Command
    modality: Step2Modality
    flagName: string
    targetService: string
    providerSpecProvider: string
    bootstrapProviderId: string
    configKey: string
    allShortcut?: Step2ShortcutFlag | undefined
    runtimeKey: Step2BooleanSelectionKey
    model: string
    description: string
  }
): Step2BooleanProviderRegistryEntry => ({
  step: entry.step,
  modality: entry.modality,
  flagName: entry.flagName,
  targetService: entry.targetService,
  providerSpecProvider: entry.providerSpecProvider,
  bootstrapProviderId: entry.bootstrapProviderId,
  configPath: step2ConfigPath(entry.step, entry.configKey),
  resumeSelectable: true,
  ...(entry.allShortcut ? { allShortcut: entry.allShortcut } : {}),
  selection: {
    type: 'boolean',
    runtimeKey: entry.runtimeKey,
    model: entry.model
  },
  flag: createBooleanFlag(entry.description)
})

export const modelProvider = (
  entry: {
    step: Step2Command
    modality: Step2Modality
    flagName: string
    targetService: string
    providerSpecProvider: string
    bootstrapProviderId: string
    configKey: string
    allShortcut?: Step2ShortcutFlag | undefined
    runtimeModelsKey: keyof RuntimeOptions
    runtimeModelKey: keyof RuntimeOptions
    supportedModels: readonly string[]
    validateModel: (value: string) => string
    description: string
  }
): Step2ModelProviderRegistryEntry => ({
  step: entry.step,
  modality: entry.modality,
  flagName: entry.flagName,
  targetService: entry.targetService,
  providerSpecProvider: entry.providerSpecProvider,
  bootstrapProviderId: entry.bootstrapProviderId,
  configPath: step2ConfigPath(entry.step, entry.configKey),
  resumeSelectable: true,
  ...(entry.allShortcut ? { allShortcut: entry.allShortcut } : {}),
  selection: {
    type: 'models',
    runtimeModelsKey: entry.runtimeModelsKey,
    runtimeModelKey: entry.runtimeModelKey,
    supportedModels: entry.supportedModels,
    validateModel: entry.validateModel
  },
  flag: createRepeatableModelFlag(entry.description)
})
