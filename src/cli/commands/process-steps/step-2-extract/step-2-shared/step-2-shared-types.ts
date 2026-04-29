import type { ClercFlagDefinitionValue } from 'clerc'
import type { RuntimeOptions, Step2Modality, Step2ProviderSelectionOrigin } from '~/types'

export type OcrSelectionState = {
  useTesseract?: boolean | undefined
  useOcrmypdf?: boolean | undefined
  usePaddleOcr?: boolean | undefined
  mistralOcrModels?: string[] | undefined
  mistralOcrModel?: string | undefined
  glmOcrModels?: string[] | undefined
  glmOcrModel?: string | undefined
  kimiOcrModels?: string[] | undefined
  kimiOcrModel?: string | undefined
  openaiOcrModels?: string[] | undefined
  openaiOcrModel?: string | undefined
  anthropicOcrModels?: string[] | undefined
  anthropicOcrModel?: string | undefined
  geminiOcrModels?: string[] | undefined
  geminiOcrModel?: string | undefined
  deepinfraOcrModels?: string[] | undefined
  deepinfraOcrModel?: string | undefined
  awsTextractModels?: string[] | undefined
  awsTextractModel?: string | undefined
  gcloudDocaiModels?: string[] | undefined
  gcloudDocaiModel?: string | undefined
  deapiOcrModels?: string[] | undefined
  deapiOcrModel?: string | undefined
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

export type ProviderRunStateBase<TService, TError> = {
  service: TService
  model: string
  artifactDir: string
  status: 'succeeded' | 'missing' | 'failed' | 'skipped'
  attempts: number
  retryable?: boolean | undefined
  lastError?: TError | undefined
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
  | 'grokSttModel'
  | 'grokSttModels'
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
  | 'kimiOcrModel'
  | 'kimiOcrModels'
  | 'openaiOcrModel'
  | 'openaiOcrModels'
  | 'anthropicOcrModel'
  | 'anthropicOcrModels'
  | 'geminiOcrModel'
  | 'geminiOcrModels'
  | 'deepinfraOcrModel'
  | 'deepinfraOcrModels'
  | 'awsTextractModel'
  | 'awsTextractModels'
  | 'gcloudDocaiModel'
  | 'gcloudDocaiModels'
  | 'deapiOcrModel'
  | 'deapiOcrModels'
  | 'useEpubBun'
  | 'useEpubCalibre'
  | 'urlBackend'
> & {
  preparedMarkdown?: string | undefined
  localHtmlDocument?: boolean | undefined
}
