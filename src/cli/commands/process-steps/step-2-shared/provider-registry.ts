import type { ClercFlagDefinitionValue, ClercFlagsDefinition } from 'clerc'
import {
  SUPPORTED_WHISPER_MODELS,
  SUPPORTED_GCLOUD_STT_MODELS,
  SUPPORTED_AWS_STT_MODELS,
  SUPPORTED_DEEPINFRA_STT_MODELS,
  SUPPORTED_DEAPI_STT_MODELS,
  SUPPORTED_ELEVENLABS_STT_MODELS,
  SUPPORTED_DEEPGRAM_STT_MODELS,
  SUPPORTED_SONIOX_STT_MODELS,
  SUPPORTED_SPEECHMATICS_STT_MODELS,
  SUPPORTED_REV_STT_MODELS,
  SUPPORTED_GROQ_STT_MODELS,
  SUPPORTED_MISTRAL_STT_MODELS,
  SUPPORTED_ASSEMBLYAI_STT_MODELS,
  SUPPORTED_GLADIA_STT_MODELS,
  SUPPORTED_HAPPYSCRIBE_STT_MODELS,
  SUPPORTED_SUPADATA_STT_MODELS,
  SUPPORTED_MISTRAL_OCR_MODELS,
  SUPPORTED_GLM_OCR_MODELS,
  SUPPORTED_OPENAI_OCR_MODELS,
  SUPPORTED_ANTHROPIC_OCR_MODELS,
  SUPPORTED_GEMINI_OCR_MODELS,
  validateWhisperModel,
  validateGcloudSttModel,
  validateAwsSttModel,
  validateDeepinfraSttModel,
  validateDeapiSttModel,
  validateElevenlabsSttModel,
  validateDeepgramSttModel,
  validateSonioxSttModel,
  validateSpeechmaticsSttModel,
  validateRevSttModel,
  validateGroqSttModel,
  validateMistralSttModel,
  validateAssemblyaiSttModel,
  validateGladiaSttModel,
  validateHappyscribeSttModel,
  validateSupadataSttModel,
  validateMistralOcrModel,
  validateGlmOcrModel,
  validateOpenAIOcrModel,
  validateAnthropicOcrModel,
  validateGeminiOcrModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { buildModelDescription } from '~/cli/commands/setup-and-utilities/models/model-validation'
import type { ProviderSpec, RuntimeOptions, Step2Modality, Step2ProviderSelectionOrigin } from '~/types'

type Step2ShortcutFlag = 'all-stt' | 'all-ocr'
type Step2Command = 'stt' | 'ocr'
type Step2BooleanSelectionKey = 'useReverb' | 'useTesseract' | 'useOcrmypdf' | 'usePaddleOcr'

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

type Step2ProviderRegistryEntryBase = {
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

type Step2BooleanProviderRegistryEntry = Step2ProviderRegistryEntryBase & {
  selection: {
    type: 'boolean'
    runtimeKey: Step2BooleanSelectionKey
    model: string
  }
  flag: ClercFlagDefinitionValue
}

type Step2ModelProviderRegistryEntry = Step2ProviderRegistryEntryBase & {
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

type Step2ProviderConfigPathEntry = {
  flagName: string
  configPath: readonly string[]
}

const createBooleanFlag = (
  description: string
): ClercFlagDefinitionValue => ({
  description,
  type: Boolean,
  default: false,
  negatable: false
})

const createRepeatableModelFlag = (
  description: string,
  defaultValue?: string[]
): ClercFlagDefinitionValue => ({
  description,
  type: [String] as [StringConstructor],
  ...(defaultValue ? { default: defaultValue } : {})
} as ClercFlagDefinitionValue)

const step2ConfigPath = (
  step: Step2Command,
  key: string
): readonly string[] => ['defaults', 'extract', step, key]

const booleanProvider = (
  entry: {
    step: Step2Command
    modality: Step2Modality
    flagName: string
    aliases?: readonly string[] | undefined
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
  aliases: entry.aliases ?? [],
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

const modelProvider = (
  entry: {
    step: Step2Command
    modality: Step2Modality
    flagName: string
    aliases?: readonly string[] | undefined
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
  aliases: entry.aliases ?? [],
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

const STEP2_PROVIDER_REGISTRY = [
  booleanProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'reverb-stt',
    aliases: ['reverb'],
    targetService: 'reverb',
    providerSpecProvider: 'reverb',
    bootstrapProviderId: 'reverb',
    configKey: 'reverb',
    allShortcut: 'all-stt',
    runtimeKey: 'useReverb',
    model: 'reverb',
    description: 'Use Reverb ASR for transcription (alias: --reverb)'
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'gcloud-stt',
    targetService: 'gcloud',
    providerSpecProvider: 'gcloud',
    bootstrapProviderId: 'gcloud-stt',
    configKey: 'gcloudStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'gcloudSttModels',
    runtimeModelKey: 'gcloudSttModel',
    supportedModels: SUPPORTED_GCLOUD_STT_MODELS,
    validateModel: validateGcloudSttModel,
    description: buildModelDescription('Google Cloud STT model', SUPPORTED_GCLOUD_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'aws-stt',
    targetService: 'aws',
    providerSpecProvider: 'aws',
    bootstrapProviderId: 'aws-stt',
    configKey: 'awsStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'awsSttModels',
    runtimeModelKey: 'awsSttModel',
    supportedModels: SUPPORTED_AWS_STT_MODELS,
    validateModel: validateAwsSttModel,
    description: buildModelDescription('AWS Transcribe STT model', SUPPORTED_AWS_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'deepinfra-stt',
    targetService: 'deepinfra',
    providerSpecProvider: 'deepinfra',
    bootstrapProviderId: 'deepinfra-stt',
    configKey: 'deepinfraStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'deepinfraSttModels',
    runtimeModelKey: 'deepinfraSttModel',
    supportedModels: SUPPORTED_DEEPINFRA_STT_MODELS,
    validateModel: validateDeepinfraSttModel,
    description: buildModelDescription('DeepInfra Whisper STT model (API, billed)', SUPPORTED_DEEPINFRA_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'deapi-stt',
    targetService: 'deapi',
    providerSpecProvider: 'deapi',
    bootstrapProviderId: 'deapi-stt',
    configKey: 'deapiStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'deapiSttModels',
    runtimeModelKey: 'deapiSttModel',
    supportedModels: SUPPORTED_DEAPI_STT_MODELS,
    validateModel: validateDeapiSttModel,
    description: buildModelDescription('deAPI STT model', SUPPORTED_DEAPI_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'elevenlabs-stt',
    targetService: 'elevenlabs',
    providerSpecProvider: 'elevenlabs',
    bootstrapProviderId: 'elevenlabs-stt',
    configKey: 'elevenlabsStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'elevenlabsSttModels',
    runtimeModelKey: 'elevenlabsSttModel',
    supportedModels: SUPPORTED_ELEVENLABS_STT_MODELS,
    validateModel: validateElevenlabsSttModel,
    description: buildModelDescription('ElevenLabs STT model', SUPPORTED_ELEVENLABS_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'deepgram-stt',
    targetService: 'deepgram',
    providerSpecProvider: 'deepgram',
    bootstrapProviderId: 'deepgram-stt',
    configKey: 'deepgramStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'deepgramSttModels',
    runtimeModelKey: 'deepgramSttModel',
    supportedModels: SUPPORTED_DEEPGRAM_STT_MODELS,
    validateModel: validateDeepgramSttModel,
    description: buildModelDescription('Deepgram STT model', SUPPORTED_DEEPGRAM_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'soniox-stt',
    targetService: 'soniox',
    providerSpecProvider: 'soniox',
    bootstrapProviderId: 'soniox-stt',
    configKey: 'sonioxStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'sonioxSttModels',
    runtimeModelKey: 'sonioxSttModel',
    supportedModels: SUPPORTED_SONIOX_STT_MODELS,
    validateModel: validateSonioxSttModel,
    description: buildModelDescription('Soniox STT model', SUPPORTED_SONIOX_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'speechmatics-stt',
    targetService: 'speechmatics',
    providerSpecProvider: 'speechmatics',
    bootstrapProviderId: 'speechmatics-stt',
    configKey: 'speechmaticsStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'speechmaticsSttModels',
    runtimeModelKey: 'speechmaticsSttModel',
    supportedModels: SUPPORTED_SPEECHMATICS_STT_MODELS,
    validateModel: validateSpeechmaticsSttModel,
    description: buildModelDescription('Speechmatics STT model', SUPPORTED_SPEECHMATICS_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'rev-stt',
    targetService: 'rev',
    providerSpecProvider: 'rev',
    bootstrapProviderId: 'rev-stt',
    configKey: 'revStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'revSttModels',
    runtimeModelKey: 'revSttModel',
    supportedModels: SUPPORTED_REV_STT_MODELS,
    validateModel: validateRevSttModel,
    description: buildModelDescription('Rev STT model', SUPPORTED_REV_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'groq-stt',
    targetService: 'groq',
    providerSpecProvider: 'groq',
    bootstrapProviderId: 'groq-stt',
    configKey: 'groqStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'groqSttModels',
    runtimeModelKey: 'groqSttModel',
    supportedModels: SUPPORTED_GROQ_STT_MODELS,
    validateModel: validateGroqSttModel,
    description: buildModelDescription('Groq Whisper STT model (API, billed)', SUPPORTED_GROQ_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'mistral-stt',
    targetService: 'mistral',
    providerSpecProvider: 'mistral',
    bootstrapProviderId: 'mistral-stt',
    configKey: 'mistralStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'mistralSttModels',
    runtimeModelKey: 'mistralSttModel',
    supportedModels: SUPPORTED_MISTRAL_STT_MODELS,
    validateModel: validateMistralSttModel,
    description: buildModelDescription('Mistral STT model', SUPPORTED_MISTRAL_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'assemblyai-stt',
    targetService: 'assemblyai',
    providerSpecProvider: 'assemblyai',
    bootstrapProviderId: 'assemblyai-stt',
    configKey: 'assemblyaiStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'assemblyaiSttModels',
    runtimeModelKey: 'assemblyaiSttModel',
    supportedModels: SUPPORTED_ASSEMBLYAI_STT_MODELS,
    validateModel: validateAssemblyaiSttModel,
    description: buildModelDescription('AssemblyAI STT model', SUPPORTED_ASSEMBLYAI_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'gladia-stt',
    targetService: 'gladia',
    providerSpecProvider: 'gladia',
    bootstrapProviderId: 'gladia-stt',
    configKey: 'gladiaStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'gladiaSttModels',
    runtimeModelKey: 'gladiaSttModel',
    supportedModels: SUPPORTED_GLADIA_STT_MODELS,
    validateModel: validateGladiaSttModel,
    description: buildModelDescription('Gladia STT model', SUPPORTED_GLADIA_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'happyscribe-stt',
    targetService: 'happyscribe',
    providerSpecProvider: 'happyscribe',
    bootstrapProviderId: 'happyscribe-stt',
    configKey: 'happyscribeStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'happyscribeSttModels',
    runtimeModelKey: 'happyscribeSttModel',
    supportedModels: SUPPORTED_HAPPYSCRIBE_STT_MODELS,
    validateModel: validateHappyscribeSttModel,
    description: buildModelDescription('Happy Scribe automatic STT model (fixed en-US only)', SUPPORTED_HAPPYSCRIBE_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'supadata-stt',
    targetService: 'supadata',
    providerSpecProvider: 'supadata',
    bootstrapProviderId: 'supadata-stt',
    configKey: 'supadataStt',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'supadataSttModels',
    runtimeModelKey: 'supadataSttModel',
    supportedModels: SUPPORTED_SUPADATA_STT_MODELS,
    validateModel: validateSupadataSttModel,
    description: buildModelDescription('Supadata STT mode', SUPPORTED_SUPADATA_STT_MODELS)
  }),
  modelProvider({
    step: 'stt',
    modality: 'media',
    flagName: 'whisper-stt',
    aliases: ['whisper'],
    targetService: 'whisper',
    providerSpecProvider: 'whisper',
    bootstrapProviderId: 'whisper',
    configKey: 'whisper',
    allShortcut: 'all-stt',
    runtimeModelsKey: 'whisperModels',
    runtimeModelKey: 'whisperModel',
    supportedModels: SUPPORTED_WHISPER_MODELS,
    validateModel: validateWhisperModel,
    description: 'Local whisper.cpp model (free): tiny|base|small|medium|large-v3-turbo (alias: --whisper)'
  }),

  booleanProvider({
    step: 'ocr',
    modality: 'document',
    flagName: 'tesseract-ocr',
    aliases: ['tesseract'],
    targetService: 'tesseract',
    providerSpecProvider: 'tesseract',
    bootstrapProviderId: 'tesseract',
    configKey: 'tesseract',
    allShortcut: 'all-ocr',
    runtimeKey: 'useTesseract',
    model: 'tesseract',
    description: 'Use Tesseract OCR (default local OCR engine for PDF/image; forces OCR mode for EPUB and office documents; alias: --tesseract)'
  }),
  booleanProvider({
    step: 'ocr',
    modality: 'document',
    flagName: 'ocrmypdf',
    targetService: 'ocrmypdf',
    providerSpecProvider: 'ocrmypdf',
    bootstrapProviderId: 'ocrmypdf',
    configKey: 'ocrmypdf',
    allShortcut: 'all-ocr',
    runtimeKey: 'useOcrmypdf',
    model: 'ocrmypdf',
    description: 'Use OCRmyPDF engine for extraction (auto-converts EPUB/image inputs to PDF; installed lazily on first use)'
  }),
  booleanProvider({
    step: 'ocr',
    modality: 'document',
    flagName: 'paddle-ocr',
    targetService: 'paddle-ocr',
    providerSpecProvider: 'paddle-ocr',
    bootstrapProviderId: 'paddle-ocr',
    configKey: 'paddleOcr',
    allShortcut: 'all-ocr',
    runtimeKey: 'usePaddleOcr',
    model: 'paddle-ocr',
    description: 'Use PaddleOCR engine for extraction (PDF, EPUB, image; installed lazily on first use)'
  }),
  modelProvider({
    step: 'ocr',
    modality: 'document',
    flagName: 'mistral-ocr',
    targetService: 'mistral',
    providerSpecProvider: 'mistral-ocr',
    bootstrapProviderId: 'mistral-ocr',
    configKey: 'mistralOcr',
    allShortcut: 'all-ocr',
    runtimeModelsKey: 'mistralOcrModels',
    runtimeModelKey: 'mistralOcrModel',
    supportedModels: SUPPORTED_MISTRAL_OCR_MODELS,
    validateModel: validateMistralOcrModel,
    description: buildModelDescription('Mistral OCR model', SUPPORTED_MISTRAL_OCR_MODELS)
  }),
  modelProvider({
    step: 'ocr',
    modality: 'document',
    flagName: 'glm-ocr',
    targetService: 'glm',
    providerSpecProvider: 'glm-ocr',
    bootstrapProviderId: 'glm-ocr',
    configKey: 'glmOcr',
    allShortcut: 'all-ocr',
    runtimeModelsKey: 'glmOcrModels',
    runtimeModelKey: 'glmOcrModel',
    supportedModels: SUPPORTED_GLM_OCR_MODELS,
    validateModel: validateGlmOcrModel,
    description: buildModelDescription('GLM OCR model', SUPPORTED_GLM_OCR_MODELS)
  }),
  modelProvider({
    step: 'ocr',
    modality: 'document',
    flagName: 'openai-ocr',
    targetService: 'openai',
    providerSpecProvider: 'openai-ocr',
    bootstrapProviderId: 'openai-ocr',
    configKey: 'openaiOcr',
    allShortcut: 'all-ocr',
    runtimeModelsKey: 'openaiOcrModels',
    runtimeModelKey: 'openaiOcrModel',
    supportedModels: SUPPORTED_OPENAI_OCR_MODELS,
    validateModel: validateOpenAIOcrModel,
    description: buildModelDescription('OpenAI OCR model', SUPPORTED_OPENAI_OCR_MODELS)
  }),
  modelProvider({
    step: 'ocr',
    modality: 'document',
    flagName: 'anthropic-ocr',
    targetService: 'anthropic',
    providerSpecProvider: 'anthropic-ocr',
    bootstrapProviderId: 'anthropic-ocr',
    configKey: 'anthropicOcr',
    allShortcut: 'all-ocr',
    runtimeModelsKey: 'anthropicOcrModels',
    runtimeModelKey: 'anthropicOcrModel',
    supportedModels: SUPPORTED_ANTHROPIC_OCR_MODELS,
    validateModel: validateAnthropicOcrModel,
    description: buildModelDescription('Anthropic OCR model', SUPPORTED_ANTHROPIC_OCR_MODELS)
  }),
  modelProvider({
    step: 'ocr',
    modality: 'document',
    flagName: 'gemini-ocr',
    targetService: 'gemini',
    providerSpecProvider: 'gemini-ocr',
    bootstrapProviderId: 'gemini-ocr',
    configKey: 'geminiOcr',
    allShortcut: 'all-ocr',
    runtimeModelsKey: 'geminiOcrModels',
    runtimeModelKey: 'geminiOcrModel',
    supportedModels: SUPPORTED_GEMINI_OCR_MODELS,
    validateModel: validateGeminiOcrModel,
    description: buildModelDescription('Gemini OCR model', SUPPORTED_GEMINI_OCR_MODELS)
  })
] as const satisfies readonly Step2ProviderRegistryEntry[]

const STEP2_PROVIDER_ENTRY_BY_FLAG = new Map<string, Step2ProviderRegistryEntry>()

for (const entry of STEP2_PROVIDER_REGISTRY) {
  STEP2_PROVIDER_ENTRY_BY_FLAG.set(entry.flagName, entry)
  for (const alias of entry.aliases) {
    STEP2_PROVIDER_ENTRY_BY_FLAG.set(alias, entry)
  }
}

const appendProviderSpec = (
  specs: ProviderSpec[],
  spec: ProviderSpec
): void => {
  const key = `${spec.provider}:${spec.model ?? ''}`
  if (specs.some((entry) => `${entry.provider}:${entry.model ?? ''}` === key)) {
    return
  }
  specs.push(spec)
}

const appendProviderSelection = (
  selections: Step2ResolvedProviderSelection[],
  selection: Step2ResolvedProviderSelection
): void => {
  const key = `${selection.providerSpecProvider}:${selection.model}`
  if (selections.some((entry) => `${entry.providerSpecProvider}:${entry.model}` === key)) {
    return
  }
  selections.push(selection)
}

const readRuntimeValue = (
  options: Record<string, unknown>,
  key: keyof RuntimeOptions
): unknown => options[key]

const canonicalizeOriginKey = (flagName: string): string =>
  STEP2_PROVIDER_ENTRY_BY_FLAG.get(flagName)?.flagName ?? flagName

const readSelectionOrigins = (
  options: Record<string, unknown>
): Partial<Record<string, Step2ProviderSelectionOrigin>> => {
  const value = options['step2SelectionOrigins']
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const origins: Partial<Record<string, Step2ProviderSelectionOrigin>> = {}
  for (const [key, origin] of Object.entries(value)) {
    if (origin === 'default' || origin === 'explicit' || origin === 'all-shortcut') {
      origins[canonicalizeOriginKey(key)] = origin
    }
  }
  return origins
}

const includeOrigin = (
  origin: Step2ProviderSelectionOrigin,
  filter?: Step2ProviderSelectionFilter
): boolean => {
  const allowedOrigins = filter?.includeOrigins
  return !allowedOrigins || allowedOrigins.includes(origin)
}

export const getStep2ProviderEntries = (
  step: Step2Command
): Step2ProviderRegistryEntry[] =>
  STEP2_PROVIDER_REGISTRY.filter((entry) => entry.step === step)

export const getStep2ProviderEntry = (
  flagName: string
): Step2ProviderRegistryEntry | undefined => STEP2_PROVIDER_ENTRY_BY_FLAG.get(flagName)

export const normalizeStep2ProviderFlagName = (
  flagName: string
): string => STEP2_PROVIDER_ENTRY_BY_FLAG.get(flagName)?.flagName ?? flagName

export const normalizeStep2ArgvToken = (
  token: string
): string => {
  if (!token.startsWith('--') || token === '--') {
    return token
  }

  const prefix = token.startsWith('--no-') ? '--no-' : '--'
  const withoutPrefix = token.slice(prefix.length)
  const eqIdx = withoutPrefix.indexOf('=')
  const flagName = eqIdx === -1 ? withoutPrefix : withoutPrefix.slice(0, eqIdx)
  const suffix = eqIdx === -1 ? '' : withoutPrefix.slice(eqIdx)
  const normalizedFlagName = normalizeStep2ProviderFlagName(flagName)

  return normalizedFlagName === flagName
    ? token
    : `${prefix}${normalizedFlagName}${suffix}`
}

export const normalizeStep2ArgvAliases = (
  argv: string[]
): string[] => argv.map(normalizeStep2ArgvToken)

export const getStep2ProviderFlags = (
  step: Step2Command
): ClercFlagsDefinition =>
  Object.fromEntries(
    getStep2ProviderEntries(step).map((entry) => [entry.flagName, entry.flag])
  )

export const getStep2ProviderSelectionFlagNames = (
  step: Step2Command,
  options: { includeAliases?: boolean } = {}
): string[] => {
  const flags = getStep2ProviderEntries(step)
    .filter((entry) => entry.resumeSelectable)
    .flatMap((entry) => options.includeAliases ? [entry.flagName, ...entry.aliases] : [entry.flagName])

  return [...new Set(flags)]
}

export const getStep2ProviderConfigPathEntries = (
  options: { includeAliases?: boolean } = {}
): Step2ProviderConfigPathEntry[] =>
  STEP2_PROVIDER_REGISTRY.flatMap((entry) => {
    const names = options.includeAliases ? [entry.flagName, ...entry.aliases] : [entry.flagName]
    return names.map((flagName) => ({
      flagName,
      configPath: entry.configPath
    }))
  })

export const getStep2RepeatableModelFlagNames = (
  options: { includeAliases?: boolean } = {}
): string[] => {
  const flags = STEP2_PROVIDER_REGISTRY
    .filter((entry) => entry.selection.type === 'models')
    .flatMap((entry) => options.includeAliases ? [entry.flagName, ...entry.aliases] : [entry.flagName])

  return [...new Set(flags)]
}

export const getStep2AllShortcutModelExpansions = (
  options: { includeAliases?: boolean } = {}
): Record<string, { shortcut: Step2ShortcutFlag, supported: readonly string[] }> =>
  Object.fromEntries(
    STEP2_PROVIDER_REGISTRY
      .filter((entry) => entry.selection.type === 'models' && entry.allShortcut !== undefined)
      .flatMap((entry) => {
        const names = options.includeAliases ? [entry.flagName, ...entry.aliases] : [entry.flagName]
        return names.map((flagName) => [
          flagName,
          {
            shortcut: entry.allShortcut as Step2ShortcutFlag,
            supported: (entry.selection as Step2ModelProviderRegistryEntry['selection']).supportedModels
          }
        ] as const)
      })
  )

export const isStep2BooleanProviderSelected = (
  flagName: string,
  flags: Record<string, unknown>,
  allShortcutFlags: Partial<Record<Step2ShortcutFlag, boolean>>
): boolean => {
  const entry = getStep2ProviderEntry(flagName)
  if (!entry || entry.selection.type !== 'boolean') {
    return false
  }

  if (
    flags[entry.flagName] === true
    || entry.aliases.some((alias) => flags[alias] === true)
  ) {
    return true
  }

  return entry.allShortcut !== undefined && allShortcutFlags[entry.allShortcut] === true
}

export const collectStep2ProviderSpecs = (
  step: Step2Command,
  options: Record<string, unknown>,
  filter?: Step2ProviderSelectionFilter
): ProviderSpec[] => {
  const specs: ProviderSpec[] = []
  for (const selection of collectStep2ProviderSelections(step, options, filter)) {
    appendProviderSpec(specs, {
      provider: selection.providerSpecProvider,
      model: selection.model
    })
  }
  return specs
}

export const collectStep2ProviderSelections = (
  step: Step2Command,
  options: Record<string, unknown>,
  filter?: Step2ProviderSelectionFilter
): Step2ResolvedProviderSelection[] => {
  const selections: Step2ResolvedProviderSelection[] = []
  const selectionOrigins = readSelectionOrigins(options)
  const hasSelectionOrigins = 'step2SelectionOrigins' in options

  for (const entry of getStep2ProviderEntries(step)) {
    if (entry.selection.type === 'boolean') {
      if (readRuntimeValue(options, entry.selection.runtimeKey) !== true) {
        continue
      }

      const origin = selectionOrigins[entry.flagName] ?? (!hasSelectionOrigins ? 'default' : undefined)
      if (!origin || !includeOrigin(origin, filter)) {
        continue
      }

      appendProviderSelection(selections, {
        flagName: entry.flagName,
        step: entry.step,
        modality: entry.modality,
        targetService: entry.targetService,
        providerSpecProvider: entry.providerSpecProvider,
        bootstrapProviderId: entry.bootstrapProviderId,
        configPath: entry.configPath,
        model: entry.selection.model,
        selectionKind: entry.selection.type,
        origin
      })
      continue
    }

    const models = readRuntimeValue(options, entry.selection.runtimeModelsKey)
    const fallback = readRuntimeValue(options, entry.selection.runtimeModelKey)
    const orderedModels = Array.isArray(models)
      ? models.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : typeof fallback === 'string' && fallback.length > 0
        ? [fallback]
        : []
    const origin = selectionOrigins[entry.flagName] ?? (!hasSelectionOrigins ? 'default' : undefined)

    if (!origin || !includeOrigin(origin, filter)) {
      continue
    }

    for (const model of orderedModels) {
      appendProviderSelection(selections, {
        flagName: entry.flagName,
        step: entry.step,
        modality: entry.modality,
        targetService: entry.targetService,
        providerSpecProvider: entry.providerSpecProvider,
        bootstrapProviderId: entry.bootstrapProviderId,
        configPath: entry.configPath,
        model,
        selectionKind: entry.selection.type,
        origin
      })
    }
  }

  return selections
}

export const getStep2BootstrapProviderId = (
  step: Step2Command,
  targetService: string
): string | undefined =>
  getStep2ProviderEntries(step).find((entry) => entry.targetService === targetService)?.bootstrapProviderId
