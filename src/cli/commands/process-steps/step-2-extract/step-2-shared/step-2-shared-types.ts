import type { ClercFlagDefinitionValue } from 'clerc'
import type { ProviderSpec, RuntimeOptions, Step2Modality, Step2ProviderSelectionOrigin } from '~/types'

export type OcrSelectionState = {
  useTesseract?: boolean | undefined
  useOcrmypdf?: boolean | undefined
  usePaddleOcr?: boolean | undefined
  mistralOcrModels?: string[] | undefined
  mistralOcrModel?: string | undefined
  glmOcrModels?: string[] | undefined
  glmOcrModel?: string | undefined
  openaiOcrModels?: string[] | undefined
  openaiOcrModel?: string | undefined
  anthropicOcrModels?: string[] | undefined
  anthropicOcrModel?: string | undefined
  geminiOcrModels?: string[] | undefined
  geminiOcrModel?: string | undefined
}

export type ResolvedStep2Provider = {
  service: string
  model: string
  origin?: Step2ProviderSelectionOrigin | undefined
}

export type Step2ShortcutFlag = 'all-stt' | 'all-ocr'
export type Step2Command = 'stt' | 'ocr'
export type Step2BooleanSelectionKey = 'useReverb' | 'useTesseract' | 'useOcrmypdf' | 'usePaddleOcr'

export type Step2ProviderSelectionFilter = {
  includeOrigins?: readonly Step2ProviderSelectionOrigin[] | undefined
}

export type Step2ResolvedProviderSelection = {
  flagName: string
  step: Step2Command
  modality: Step2Modality
  targetService: string
  providerSpecProvider: string
  bootstrapProviderId: string
  configPath: readonly string[]
  model: string
  selectionKind: 'boolean' | 'models'
  origin: Step2ProviderSelectionOrigin
}

export type Step2ProviderRegistryEntryBase = {
  step: Step2Command
  modality: Step2Modality
  flagName: string
  aliases: readonly string[]
  targetService: string
  providerSpecProvider: string
  bootstrapProviderId: string
  configPath: readonly string[]
  resumeSelectable: true
  allShortcut?: Step2ShortcutFlag
}

export type Step2BooleanProviderRegistryEntry = Step2ProviderRegistryEntryBase & {
  selection: {
    type: 'boolean'
    runtimeKey: Step2BooleanSelectionKey
    model: string
  }
  flag: ClercFlagDefinitionValue
}

export type Step2ModelProviderRegistryEntry = Step2ProviderRegistryEntryBase & {
  selection: {
    type: 'models'
    runtimeModelsKey: keyof RuntimeOptions
    runtimeModelKey: keyof RuntimeOptions
    supportedModels: readonly string[]
    validateModel: (value: string) => string
  }
  flag: ClercFlagDefinitionValue
}

export type Step2ProviderRegistryEntry =
  | Step2BooleanProviderRegistryEntry
  | Step2ModelProviderRegistryEntry

export type Step2ProviderConfigPathEntry = {
  flagName: string
  configPath: readonly string[]
}

export type Step2ProviderEntriesByStep = Record<Step2Command, Step2ProviderRegistryEntry[]>

export type Step2AllShortcutModelExpansions = Partial<Record<string, { shortcut: Step2ShortcutFlag, supported: readonly string[] }>>

export type Step2ProviderCapabilitySpec = {
  provider: ProviderSpec['provider']
  kind: Step2Modality
  local: boolean
}

export type SttStep2ResolutionOptions = Pick<
  RuntimeOptions,
  | 'useReverb'
  | 'step2SelectionOrigins'
  | 'whisperModel'
  | 'whisperModels'
  | 'gcloudSttModel'
  | 'gcloudSttModels'
  | 'awsSttModel'
  | 'awsSttModels'
  | 'deepinfraSttModel'
  | 'deepinfraSttModels'
  | 'deapiSttModel'
  | 'deapiSttModels'
  | 'elevenlabsSttModel'
  | 'elevenlabsSttModels'
  | 'deepgramSttModel'
  | 'deepgramSttModels'
  | 'sonioxSttModel'
  | 'sonioxSttModels'
  | 'speechmaticsSttModel'
  | 'speechmaticsSttModels'
  | 'revSttModel'
  | 'revSttModels'
  | 'groqSttModel'
  | 'groqSttModels'
  | 'mistralSttModel'
  | 'mistralSttModels'
  | 'assemblyaiSttModel'
  | 'assemblyaiSttModels'
  | 'gladiaSttModel'
  | 'gladiaSttModels'
  | 'happyscribeSttModel'
  | 'happyscribeSttModels'
  | 'supadataSttModel'
  | 'supadataSttModels'
>

export type OcrStep2ResolutionOptions = Pick<
  RuntimeOptions,
  | 'useTesseract'
  | 'useOcrmypdf'
  | 'usePaddleOcr'
  | 'step2SelectionOrigins'
  | 'mistralOcrModel'
  | 'mistralOcrModels'
  | 'glmOcrModel'
  | 'glmOcrModels'
  | 'openaiOcrModel'
  | 'openaiOcrModels'
  | 'anthropicOcrModel'
  | 'anthropicOcrModels'
  | 'geminiOcrModel'
  | 'geminiOcrModels'
  | 'useEpubBun'
  | 'useEpubCalibre'
  | 'urlBackend'
> & {
  preparedMarkdown?: string | undefined
  localHtmlDocument?: boolean | undefined
}
