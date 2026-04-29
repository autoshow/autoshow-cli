import { CLIUsageError } from '~/utils/error-handler'
import {
  SUPPORTED_OPENAI_MODELS,
  SUPPORTED_GROQ_MODELS,
  SUPPORTED_GEMINI_MODELS,
  SUPPORTED_ANTHROPIC_MODELS,
  SUPPORTED_MINIMAX_MODELS,
  SUPPORTED_GROK_MODELS,
  SUPPORTED_GLM_MODELS,
  SUPPORTED_KIMI_MODELS,
  SUPPORTED_LLAMA_MODELS,
  SUPPORTED_KITTEN_TTS_MODELS,
  SUPPORTED_ELEVENLABS_TTS_MODELS,
  SUPPORTED_MINIMAX_TTS_MODELS,
  SUPPORTED_GROQ_TTS_MODELS,
  SUPPORTED_GROK_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_DEAPI_RUNNABLE_TTS_MODELS,
  DEEPGRAM_DEFAULT_VOICE,
  SUPPORTED_RUNWAY_TTS_MODELS,
  SUPPORTED_GEMINI_IMAGE_MODELS,
  SUPPORTED_DEAPI_IMAGE_MODELS,
  SUPPORTED_GLM_IMAGE_MODELS,
  SUPPORTED_GROK_IMAGE_MODELS,
  SUPPORTED_MINIMAX_IMAGE_MODELS,
  SUPPORTED_OPENAI_IMAGE_MODELS,
  SUPPORTED_RUNWAY_IMAGE_MODELS,
  SUPPORTED_BFL_IMAGE_MODELS,
  SUPPORTED_ELEVENLABS_MUSIC_MODELS,
  SUPPORTED_MINIMAX_MUSIC_MODELS,
  SUPPORTED_DEAPI_MUSIC_MODELS,
  SUPPORTED_GEMINI_MUSIC_MODELS,
  SUPPORTED_GEMINI_VIDEO_MODELS,
  SUPPORTED_DEAPI_VIDEO_MODELS,
  SUPPORTED_GLM_VIDEO_MODELS,
  SUPPORTED_GROK_VIDEO_MODELS,
  SUPPORTED_MINIMAX_VIDEO_MODELS,
  SUPPORTED_RUNWAY_VIDEO_MODELS,
  validateLlamaModel,
  validateOpenAIModel,
  validateGroqModel,
  validateGeminiModel,
  validateAnthropicModel,
  validateMinimaxModel,
  validateGrokModel,
  validateGlmModel,
  validateKimiModel,
  validateWhisperModel,
  validateGcloudSttModel,
  validateAwsSttModel,
  validateDeapiSttModel,
  validateDeepinfraSttModel,
  validateElevenlabsSttModel,
  validateDeepgramSttModel,
  validateSonioxSttModel,
  validateSpeechmaticsSttModel,
  validateRevSttModel,
  validateGroqSttModel,
  validateGrokSttModel,
  validateMistralSttModel,
  validateAssemblyaiSttModel,
  validateGladiaSttModel,
  validateHappyscribeSttModel,
  validateSupadataSttModel,
  validateOpenaiSttModel,
  validateGeminiSttModel,
  validateGlmSttModel,
  validateTogetherSttModel,
  validateFireworksSttModel,
  validateCloudflareSttModel,
  validateGlmOcrModel,
  validateKimiOcrModel,
  validateAnthropicOcrModel,
  validateGeminiOcrModel,
  validateDeepinfraOcrModel,
  validateAwsTextractModel,
  validateGcloudDocaiModel,
  validateDeapiOcrModel,
  validateMistralOcrModel,
  validateOpenAIOcrModel,
  validateKittenTtsModel,
  validateElevenlabsTtsModel,
  validateMinimaxTtsModel,
  validateGroqTtsModel,
  validateGrokTtsModel,
  validateOpenAITtsModel,
  validateGeminiTtsModel,
  validateDeapiTtsModel,
  validateDeepgramTtsModel,
  validateDeepgramTtsVoice,
  validateRunwayTtsModel,
  validateRunwayTtsVoice,
  validateGroqTtsVoice,
  validateGrokTtsVoice,
  validateElevenlabsMusicModel,
  validateMinimaxMusicModel,
  validateDeapiMusicModel,
  validateGeminiMusicModel,
  validateKittenTtsSpeaker,
  validateGeminiImageModel,
  validateDeapiImageModel,
  validateGlmImageModel,
  validateGrokImageModel,
  validateMinimaxImageModel,
  validateOpenAIImageModel,
  validateRunwayImageModel,
  validateBflImageModel,
  validateGeminiVideoModel,
  validateDeapiVideoModel,
  validateMinimaxVideoModel,
  validateGlmVideoModel,
  validateGrokVideoModel,
  validateRunwayVideoModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import {
  getStep2ProviderEntries,
  getStep2AllShortcutModelExpansions,
  isStep2BooleanProviderSelected,
  normalizeStep2ProviderFlagName
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import { readEnv } from '~/utils/validate/env-utils'
import type {
  AllShortcutFlag,
  BatchOrder,
  BuildOptsDefaults,
  FlagOccurrenceValue,
  OutputFormat,
  RepeatableModelFlag,
  RuntimeOptions,
  Step2ProviderSelectionOrigin
} from '~/types'

export const REPEATABLE_MODEL_FLAGS = [
  'whisper-stt',
  'gcloud-stt',
  'aws-stt',
  'deepinfra-stt',
  'deapi-stt',
  'groq-stt',
  'grok-stt',
  'elevenlabs-stt',
  'deepgram-stt',
  'soniox-stt',
  'speechmatics-stt',
  'rev-stt',
  'mistral-stt',
  'assemblyai-stt',
  'gladia-stt',
  'happyscribe-stt',
  'supadata-stt',
  'openai-stt',
  'gemini-stt',
  'glm-stt',
  'together-stt',
  'fireworks-stt',
  'cloudflare-stt',
  'mistral-ocr',
  'glm-ocr',
  'kimi-ocr',
  'openai-ocr',
  'anthropic-ocr',
  'gemini-ocr',
  'deepinfra-ocr',
  'aws-textract',
  'gcloud-docai',
  'deapi-ocr',
  'llama',
  'openai',
  'groq',
  'gemini',
  'anthropic',
  'minimax',
  'grok',
  'glm',
  'kimi',
  'kitten-tts',
  'elevenlabs-tts',
  'minimax-tts',
  'groq-tts',
  'grok-tts',
  'openai-tts',
  'gemini-tts',
  'runway-tts',
  'deapi-tts',
  'deepgram-tts',
  'gemini-image',
  'openai-image',
  'minimax-image',
  'glm-image',
  'grok-image',
  'runway-image',
  'bfl-image',
  'deapi-image',
  'elevenlabs-music',
  'minimax-music',
  'deapi-music',
  'gemini-music',
  'gemini-video',
  'minimax-video',
  'glm-video',
  'grok-video',
  'runway-video',
  'deapi-video'
] as const

const REPEATABLE_MODEL_FLAG_SET = new Set<string>(REPEATABLE_MODEL_FLAGS)
const STEP2_ALL_SHORTCUT_MODEL_EXPANSIONS = getStep2AllShortcutModelExpansions()
const STEP2_PROVIDER_ENTRIES = [
  ...getStep2ProviderEntries('stt'),
  ...getStep2ProviderEntries('ocr')
] as const
const ALL_SHORTCUT_MODEL_EXPANSIONS: Partial<Record<RepeatableModelFlag, { shortcut: AllShortcutFlag, supported: readonly string[] }>> = {
  ...STEP2_ALL_SHORTCUT_MODEL_EXPANSIONS,
  llama: { shortcut: 'all-llm', supported: SUPPORTED_LLAMA_MODELS },
  openai: { shortcut: 'all-llm', supported: SUPPORTED_OPENAI_MODELS },
  groq: { shortcut: 'all-llm', supported: SUPPORTED_GROQ_MODELS },
  gemini: { shortcut: 'all-llm', supported: SUPPORTED_GEMINI_MODELS },
  anthropic: { shortcut: 'all-llm', supported: SUPPORTED_ANTHROPIC_MODELS },
  minimax: { shortcut: 'all-llm', supported: SUPPORTED_MINIMAX_MODELS },
  grok: { shortcut: 'all-llm', supported: SUPPORTED_GROK_MODELS },
  glm: { shortcut: 'all-llm', supported: SUPPORTED_GLM_MODELS },
  kimi: { shortcut: 'all-llm', supported: SUPPORTED_KIMI_MODELS },
  'kitten-tts': { shortcut: 'all-tts', supported: SUPPORTED_KITTEN_TTS_MODELS },
  'elevenlabs-tts': { shortcut: 'all-tts', supported: SUPPORTED_ELEVENLABS_TTS_MODELS },
  'minimax-tts': { shortcut: 'all-tts', supported: SUPPORTED_MINIMAX_TTS_MODELS },
  'groq-tts': { shortcut: 'all-tts', supported: SUPPORTED_GROQ_TTS_MODELS },
  'grok-tts': { shortcut: 'all-tts', supported: SUPPORTED_GROK_TTS_MODELS },
  'openai-tts': { shortcut: 'all-tts', supported: SUPPORTED_OPENAI_TTS_MODELS },
  'gemini-tts': { shortcut: 'all-tts', supported: SUPPORTED_GEMINI_TTS_MODELS },
  'deepgram-tts': { shortcut: 'all-tts', supported: [DEEPGRAM_DEFAULT_VOICE] },
  'runway-tts': { shortcut: 'all-tts', supported: SUPPORTED_RUNWAY_TTS_MODELS },
  'deapi-tts': { shortcut: 'all-tts', supported: SUPPORTED_DEAPI_RUNNABLE_TTS_MODELS },
  'gemini-image': { shortcut: 'all-image', supported: SUPPORTED_GEMINI_IMAGE_MODELS },
  'openai-image': { shortcut: 'all-image', supported: SUPPORTED_OPENAI_IMAGE_MODELS },
  'minimax-image': { shortcut: 'all-image', supported: SUPPORTED_MINIMAX_IMAGE_MODELS },
  'glm-image': { shortcut: 'all-image', supported: SUPPORTED_GLM_IMAGE_MODELS },
  'grok-image': { shortcut: 'all-image', supported: SUPPORTED_GROK_IMAGE_MODELS },
  'runway-image': { shortcut: 'all-image', supported: SUPPORTED_RUNWAY_IMAGE_MODELS },
  'bfl-image': { shortcut: 'all-image', supported: SUPPORTED_BFL_IMAGE_MODELS },
  'deapi-image': { shortcut: 'all-image', supported: SUPPORTED_DEAPI_IMAGE_MODELS },
  'elevenlabs-music': { shortcut: 'all-music', supported: SUPPORTED_ELEVENLABS_MUSIC_MODELS },
  'minimax-music': { shortcut: 'all-music', supported: SUPPORTED_MINIMAX_MUSIC_MODELS },
  'deapi-music': { shortcut: 'all-music', supported: SUPPORTED_DEAPI_MUSIC_MODELS },
  'gemini-music': { shortcut: 'all-music', supported: SUPPORTED_GEMINI_MUSIC_MODELS },
  'gemini-video': { shortcut: 'all-video', supported: SUPPORTED_GEMINI_VIDEO_MODELS },
  'minimax-video': { shortcut: 'all-video', supported: SUPPORTED_MINIMAX_VIDEO_MODELS },
  'glm-video': { shortcut: 'all-video', supported: SUPPORTED_GLM_VIDEO_MODELS },
  'grok-video': { shortcut: 'all-video', supported: SUPPORTED_GROK_VIDEO_MODELS },
  'runway-video': { shortcut: 'all-video', supported: SUPPORTED_RUNWAY_VIDEO_MODELS },
  'deapi-video': { shortcut: 'all-video', supported: SUPPORTED_DEAPI_VIDEO_MODELS }
}

const parseIntWithDefault = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (Number.isFinite(parsed)) return parsed
  return fallback
}

const parseFloatWithDefault = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback
  const parsed = Number.parseFloat(value)
  if (Number.isFinite(parsed)) return parsed
  return fallback
}

const parseOptionalPositiveIntFlag = (
  value: string | undefined,
  flagName: string
): number | undefined => {
  if (value === undefined) {
    return undefined
  }

  if (!/^\d+$/.test(value)) {
    throw CLIUsageError(`Invalid --${flagName} value "${value}". Expected a positive integer.`)
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw CLIUsageError(`Invalid --${flagName} value "${value}". Expected a positive integer.`)
  }

  return parsed
}

const toCamelFlagKey = (key: string): string => {
  return key.replace(/-([a-z0-9])/g, (_match, char: string) => char.toUpperCase())
}

const getStep2FlagLookupKeys = (key: string): string[] => {
  const normalizedKey = normalizeStep2ProviderFlagName(key)
  if (normalizedKey === key) {
    return [key, toCamelFlagKey(key)]
  }

  return [
    normalizedKey,
    toCamelFlagKey(normalizedKey),
    key,
    toCamelFlagKey(key)
  ]
}

const readFlagValue = (flags: Record<string, unknown>, key: string): unknown => {
  for (const candidateKey of getStep2FlagLookupKeys(key)) {
    if (candidateKey in flags) {
      return flags[candidateKey]
    }
  }
  return undefined
}

const readStringFlag = (flags: Record<string, unknown>, key: string, fallback: string): string => {
  const value = readFlagValue(flags, key)
  if (typeof value === 'string' && value.length > 0) {
    return value
  }
  return fallback
}

const readOptionalStringFlag = (flags: Record<string, unknown>, key: string): string | undefined => {
  const value = readFlagValue(flags, key)
  if (typeof value === 'string' && value.length > 0) {
    return value
  }
  return undefined
}

export const parseRepeatableModelFlagOccurrences = (
  args: string[]
): Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>> => {
  const result: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string
    if (!arg.startsWith('--')) {
      continue
    }

    const withoutDashes = arg.slice(2)
    const eqIdx = withoutDashes.indexOf('=')
    const key = normalizeStep2ProviderFlagName(
      eqIdx === -1 ? withoutDashes : withoutDashes.slice(0, eqIdx)
    ) as RepeatableModelFlag
    if (!REPEATABLE_MODEL_FLAG_SET.has(key)) {
      continue
    }

    const occurrenceList = result[key] ?? []
    result[key] = occurrenceList

    if (eqIdx !== -1) {
      const inlineValue = withoutDashes.slice(eqIdx + 1)
      occurrenceList.push(inlineValue.length > 0 ? inlineValue : true)
      continue
    }

    const next = args[i + 1]
    if (typeof next === 'string' && !next.startsWith('--') && next !== '--') {
      occurrenceList.push(next)
      i++
      continue
    }

    occurrenceList.push(true)
  }

  return result
}

const appendUnique = <T>(values: T[], value: T): void => {
  if (!values.includes(value)) {
    values.push(value)
  }
}

export const normalizeModelFlagOccurrences = (
  flagName: RepeatableModelFlag,
  flags: Record<string, unknown>,
  rawOccurrences: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>>
): string[] | undefined => {
  const occurrences = rawOccurrences[flagName]
  const sourceValues: FlagOccurrenceValue[] | undefined = occurrences && occurrences.length > 0
    ? occurrences
    : Array.isArray(flags[flagName])
      ? (flags[flagName] as unknown[]).flatMap((entry) =>
          typeof entry === 'string' || entry === true ? [entry] : []
        )
      : typeof flags[flagName] === 'string' || flags[flagName] === true
        ? [flags[flagName] as string | boolean]
        : undefined

  if (!sourceValues || sourceValues.length === 0) {
    return undefined
  }

  const models: string[] = []
  for (const value of sourceValues) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed.length > 0) {
        appendUnique(models, trimmed)
        continue
      }
    }

    const cheapestModel = resolveCheapestModelForFlag(flagName)
    if (cheapestModel !== undefined) {
      appendUnique(models, cheapestModel)
    }
  }

  return models.length > 0 ? models : undefined
}

const readBooleanFlag = (flags: Record<string, unknown>, key: string): boolean => {
  return readFlagValue(flags, key) === true
}

const readAllShortcutFlags = (flags: Record<string, unknown>): Record<AllShortcutFlag, boolean> => ({
  'all-stt': readBooleanFlag(flags, 'all-stt'),
  'all-ocr': readBooleanFlag(flags, 'all-ocr'),
  'all-llm': readBooleanFlag(flags, 'all-llm'),
  'all-tts': readBooleanFlag(flags, 'all-tts'),
  'all-image': readBooleanFlag(flags, 'all-image'),
  'all-video': readBooleanFlag(flags, 'all-video'),
  'all-music': readBooleanFlag(flags, 'all-music')
})

const expandAllShortcutModels = (
  flagName: RepeatableModelFlag,
  flags: Record<string, unknown>,
  rawOccurrences: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>>,
  allShortcutFlags: Record<AllShortcutFlag, boolean>
): string[] | undefined => {
  const explicitSelections = normalizeModelFlagOccurrences(flagName, flags, rawOccurrences)
  const expansion = ALL_SHORTCUT_MODEL_EXPANSIONS[flagName]
  if (!expansion || !allShortcutFlags[expansion.shortcut]) {
    return explicitSelections
  }

  const mergedSelections = [...expansion.supported]
  for (const value of explicitSelections ?? []) {
    appendUnique(mergedSelections, value)
  }
  return mergedSelections.length > 0 ? mergedSelections : undefined
}

const resolveStep2SelectionOrigins = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  rawOccurrences: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>>,
  allShortcutFlags: Record<AllShortcutFlag, boolean>
): Partial<Record<string, Step2ProviderSelectionOrigin>> => {
  const origins: Partial<Record<string, Step2ProviderSelectionOrigin>> = {}

  for (const entry of STEP2_PROVIDER_ENTRIES) {
    if (entry.selection.type === 'boolean') {
      if (!isStep2BooleanProviderSelected(entry.flagName, flags, allShortcutFlags)) {
        continue
      }

      origins[entry.flagName] = explicitFlags.has(entry.flagName)
        ? 'explicit'
        : entry.allShortcut !== undefined && allShortcutFlags[entry.allShortcut]
          ? 'all-shortcut'
          : 'default'
      continue
    }

    if (entry.allShortcut !== undefined && allShortcutFlags[entry.allShortcut]) {
      origins[entry.flagName] = 'all-shortcut'
      continue
    }

    const models = normalizeModelFlagOccurrences(entry.flagName as RepeatableModelFlag, flags, rawOccurrences)
    if (!models || models.length === 0) {
      continue
    }

    origins[entry.flagName] = explicitFlags.has(entry.flagName) ? 'explicit' : 'default'
  }

  return origins
}

const readBatchOrder = (flags: Record<string, unknown>): BatchOrder => {
  const v = readFlagValue(flags, 'batch-order')
  return v === 'oldest' ? 'oldest' : 'newest'
}

const DEFAULT_KITTEN_TTS_MODEL = 'kitten-tts-nano-0.8-int8'
const DEFAULT_KITTEN_TTS_SPEAKER = 'Jasper'

const parseUrlBackend = (value: string | undefined): 'defuddle' | 'firecrawl' | 'glm-reader' => {
  const normalized = value?.trim().toLowerCase()
  if (!normalized || normalized === 'defuddle') {
    return 'defuddle'
  }
  if (normalized === 'firecrawl') {
    return 'firecrawl'
  }
  if (normalized === 'glm-reader') {
    return 'glm-reader'
  }
  throw CLIUsageError(`Invalid --url-backend value "${value}". Expected "defuddle", "firecrawl", or "glm-reader".`)
}

const parsePdfChapterMode = (value: string | undefined): 'local' | 'auto' | 'llm' => {
  const normalized = value?.trim().toLowerCase()
  if (!normalized || normalized === 'local') {
    return 'local'
  }
  if (normalized === 'auto') {
    return 'auto'
  }
  if (normalized === 'llm') {
    return 'llm'
  }
  throw CLIUsageError(`Invalid --pdf-chapter-mode value "${value}". Expected "local", "auto", or "llm".`)
}

const parseDoubleDashArgs = (args: string[]): Record<string, string | boolean> => {
  const result: Record<string, string | boolean> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string
    if (!arg.startsWith('--')) continue
    const key = normalizeStep2ProviderFlagName(arg.slice(2))
    const next = args[i + 1]
    if (typeof next === 'string' && !next.startsWith('--')) {
      result[key] = next
      i++
    } else {
      result[key] = true
    }
  }
  return result
}

const readOptionalRawStringFlag = (args: string[], flagName: string): string | undefined => {
  for (let i = args.length - 1; i >= 0; i--) {
    const arg = args[i] as string
    if (arg === `--${flagName}`) {
      const next = args[i + 1]
      if (typeof next === 'string' && !next.startsWith('--') && next.length > 0) {
        return next
      }
      continue
    }

    if (arg.startsWith(`--${flagName}=`)) {
      const value = arg.slice(flagName.length + 3)
      if (value.length > 0) {
        return value
      }
    }
  }

  return undefined
}

export const buildOptsFromFlags = (
  skipLLM: boolean,
  flags: Record<string, unknown>,
  doubleDashArgs: string[] = [],
  defaults: BuildOptsDefaults = {},
  explicitFlags: Set<string> = new Set(),
  rawArgs: string[] = []
): RuntimeOptions => {
  const ddArgs = parseDoubleDashArgs(doubleDashArgs)
  const rawModelOccurrences = parseRepeatableModelFlagOccurrences(rawArgs)

  const mergedFlags: Record<string, unknown> = { ...ddArgs, ...flags }
  const allShortcutFlags = readAllShortcutFlags(mergedFlags)
  const validateCliValue = <T>(validator: (value: string) => T, value: string): T => {
    try {
      return validator(value)
    } catch (error) {
      throw CLIUsageError(error instanceof Error ? error.message : String(error))
    }
  }
  const readValidatedMany = <T extends string>(
    key: RepeatableModelFlag,
    validator: (value: string) => T
  ): T[] | undefined => {
    const values = expandAllShortcutModels(key, mergedFlags, rawModelOccurrences, allShortcutFlags)
    if (!values || values.length === 0) {
      return undefined
    }

    const normalized: T[] = []
    for (const value of values) {
      appendUnique(normalized, validateCliValue(validator, value))
    }
    return normalized.length > 0 ? normalized : undefined
  }
  const first = <T>(values: T[] | undefined): T | undefined => values?.[0]

  const outputFormat = readStringFlag(mergedFlags, 'out', 'json')
  const normalizedOut: OutputFormat = outputFormat === 'text' || outputFormat === 'tsv' || outputFormat === 'hocr' ? outputFormat : 'json'
  const epubLengthThousands = parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'length'), 'length')
  const pdfChapterMode = parsePdfChapterMode(readOptionalStringFlag(mergedFlags, 'pdf-chapter-mode'))

  const whisperModels = readValidatedMany('whisper-stt', validateWhisperModel)
  const whisperModel = first(whisperModels) ?? validateCliValue(validateWhisperModel, readStringFlag(mergedFlags, 'whisper-stt', 'tiny'))
  const gcloudSttModels = readValidatedMany('gcloud-stt', validateGcloudSttModel)
  const awsSttModels = readValidatedMany('aws-stt', validateAwsSttModel)
  const deepinfraSttModels = readValidatedMany('deepinfra-stt', validateDeepinfraSttModel)
  const deapiSttModels = readValidatedMany('deapi-stt', validateDeapiSttModel)
  const groqSttModels = readValidatedMany('groq-stt', validateGroqSttModel)
  const grokSttModels = readValidatedMany('grok-stt', validateGrokSttModel)
  const elevenlabsSttModels = readValidatedMany('elevenlabs-stt', validateElevenlabsSttModel)
  const deepgramSttModels = readValidatedMany('deepgram-stt', validateDeepgramSttModel)
  const sonioxSttModels = readValidatedMany('soniox-stt', validateSonioxSttModel)
  const speechmaticsSttModels = readValidatedMany('speechmatics-stt', validateSpeechmaticsSttModel)
  const revSttModels = readValidatedMany('rev-stt', validateRevSttModel)
  const mistralSttModels = readValidatedMany('mistral-stt', validateMistralSttModel)
  const assemblyaiSttModels = readValidatedMany('assemblyai-stt', validateAssemblyaiSttModel)
  const gladiaSttModels = readValidatedMany('gladia-stt', validateGladiaSttModel)
  const happyscribeSttModels = readValidatedMany('happyscribe-stt', validateHappyscribeSttModel)
  const supadataSttModels = readValidatedMany('supadata-stt', validateSupadataSttModel)
  const openaiSttModels = readValidatedMany('openai-stt', validateOpenaiSttModel)
  const geminiSttModels = readValidatedMany('gemini-stt', validateGeminiSttModel)
  const glmSttModels = readValidatedMany('glm-stt', validateGlmSttModel)
  const togetherSttModels = readValidatedMany('together-stt', validateTogetherSttModel)
  const fireworksSttModels = readValidatedMany('fireworks-stt', validateFireworksSttModel)
  const cloudflareSttModels = readValidatedMany('cloudflare-stt', validateCloudflareSttModel)
  const mistralOcrModels = readValidatedMany('mistral-ocr', validateMistralOcrModel)
  const glmOcrModels = readValidatedMany('glm-ocr', validateGlmOcrModel)
  const kimiOcrModels = readValidatedMany('kimi-ocr', validateKimiOcrModel)
  const openaiOcrModels = readValidatedMany('openai-ocr', validateOpenAIOcrModel)
  const anthropicOcrModels = readValidatedMany('anthropic-ocr', validateAnthropicOcrModel)
  const geminiOcrModels = readValidatedMany('gemini-ocr', validateGeminiOcrModel)
  const deepinfraOcrModels = readValidatedMany('deepinfra-ocr', validateDeepinfraOcrModel)
  const awsTextractModels = readValidatedMany('aws-textract', validateAwsTextractModel)
  const gcloudDocaiModels = readValidatedMany('gcloud-docai', validateGcloudDocaiModel)
  const deapiOcrModels = readValidatedMany('deapi-ocr', validateDeapiOcrModel)
  const llamaModels = readValidatedMany('llama', validateLlamaModel)
  const openaiModels = readValidatedMany('openai', validateOpenAIModel)
  const groqModels = readValidatedMany('groq', validateGroqModel)
  const geminiModels = readValidatedMany('gemini', validateGeminiModel)
  const anthropicModels = readValidatedMany('anthropic', validateAnthropicModel)
  const minimaxModels = readValidatedMany('minimax', validateMinimaxModel)
  const grokModels = readValidatedMany('grok', validateGrokModel)
  const glmModels = readValidatedMany('glm', validateGlmModel)
  const kimiModels = readValidatedMany('kimi', validateKimiModel)
  const gcloudSttModel = first(gcloudSttModels)
  const awsSttModel = first(awsSttModels)
  const deepinfraSttModel = first(deepinfraSttModels)
  const deapiSttModel = first(deapiSttModels)
  const groqSttModel = first(groqSttModels)
  const grokSttModel = first(grokSttModels)
  const elevenlabsSttModel = first(elevenlabsSttModels)
  const deepgramSttModel = first(deepgramSttModels)
  const sonioxSttModel = first(sonioxSttModels)
  const speechmaticsSttModel = first(speechmaticsSttModels)
  const revSttModel = first(revSttModels)
  const mistralSttModel = first(mistralSttModels)
  const assemblyaiSttModel = first(assemblyaiSttModels)
  const gladiaSttModel = first(gladiaSttModels)
  const happyscribeSttModel = first(happyscribeSttModels)
  const supadataSttModel = first(supadataSttModels)
  const openaiSttModel = first(openaiSttModels)
  const geminiSttModel = first(geminiSttModels)
  const glmSttModel = first(glmSttModels)
  const togetherSttModel = first(togetherSttModels)
  const fireworksSttModel = first(fireworksSttModels)
  const cloudflareSttModel = first(cloudflareSttModels)
  const mistralOcrModel = first(mistralOcrModels)
  const glmOcrModel = first(glmOcrModels)
  const kimiOcrModel = first(kimiOcrModels)
  const openaiOcrModel = first(openaiOcrModels)
  const anthropicOcrModel = first(anthropicOcrModels)
  const geminiOcrModel = first(geminiOcrModels)
  const deepinfraOcrModel = first(deepinfraOcrModels)
  const awsTextractModel = first(awsTextractModels)
  const gcloudDocaiModel = first(gcloudDocaiModels)
  const deapiOcrModel = first(deapiOcrModels)
  const llamaModel = first(llamaModels)
  const openaiModel = first(openaiModels)
  const groqModel = first(groqModels)
  const geminiModel = first(geminiModels)
  const anthropicModel = first(anthropicModels)
  const minimaxModel = first(minimaxModels)
  const grokModel = first(grokModels)
  const glmModel = first(glmModels)
  const kimiModel = first(kimiModels)
  const kittenTtsModels = readValidatedMany('kitten-tts', validateKittenTtsModel)
  const elevenlabsTtsModels = readValidatedMany('elevenlabs-tts', validateElevenlabsTtsModel)
  const minimaxTtsModels = readValidatedMany('minimax-tts', validateMinimaxTtsModel)
  const groqTtsModels = readValidatedMany('groq-tts', validateGroqTtsModel)
  const grokTtsModels = readValidatedMany('grok-tts', validateGrokTtsModel)
  const openaiTtsModels = readValidatedMany('openai-tts', validateOpenAITtsModel)
  const geminiTtsModels = readValidatedMany('gemini-tts', validateGeminiTtsModel)
  const deepgramTtsModels = readValidatedMany('deepgram-tts', validateDeepgramTtsModel)
  const runwayTtsModels = readValidatedMany('runway-tts', validateRunwayTtsModel)
  const deapiTtsModels = readValidatedMany('deapi-tts', validateDeapiTtsModel)
  const hasExplicitTtsEngine = [
    kittenTtsModels,
    elevenlabsTtsModels,
    minimaxTtsModels,
    groqTtsModels,
    grokTtsModels,
    openaiTtsModels,
    geminiTtsModels,
    deepgramTtsModels,
    runwayTtsModels,
    deapiTtsModels
  ].some((value) => value !== undefined && value.length > 0)
  const kittenTtsModelValues = defaults.defaultTtsEngine === 'kitten' && !hasExplicitTtsEngine
    ? [DEFAULT_KITTEN_TTS_MODEL]
    : kittenTtsModels
  const kittenTtsModelValue = first(kittenTtsModelValues)
  const geminiImageModels = readValidatedMany('gemini-image', validateGeminiImageModel)
  const openaiImageModels = readValidatedMany('openai-image', validateOpenAIImageModel)
  const minimaxImageModels = readValidatedMany('minimax-image', validateMinimaxImageModel)
  const glmImageModels = readValidatedMany('glm-image', validateGlmImageModel)
  const grokImageModels = readValidatedMany('grok-image', validateGrokImageModel)
  const runwayImageModels = readValidatedMany('runway-image', validateRunwayImageModel)
  const bflImageModels = readValidatedMany('bfl-image', validateBflImageModel)
  const deapiImageModels = readValidatedMany('deapi-image', validateDeapiImageModel)
  const elevenlabsMusicModels = readValidatedMany('elevenlabs-music', validateElevenlabsMusicModel)
  const minimaxMusicModels = readValidatedMany('minimax-music', validateMinimaxMusicModel)
  const deapiMusicModels = readValidatedMany('deapi-music', validateDeapiMusicModel)
  const geminiMusicModels = readValidatedMany('gemini-music', validateGeminiMusicModel)
  const geminiVideoModels = readValidatedMany('gemini-video', validateGeminiVideoModel)
  const minimaxVideoModels = readValidatedMany('minimax-video', validateMinimaxVideoModel)
  const glmVideoModels = readValidatedMany('glm-video', validateGlmVideoModel)
  const grokVideoModels = readValidatedMany('grok-video', validateGrokVideoModel)
  const runwayVideoModels = readValidatedMany('runway-video', validateRunwayVideoModel)
  const deapiVideoModels = readValidatedMany('deapi-video', validateDeapiVideoModel)
  const urlBackendFlag = readOptionalStringFlag(mergedFlags, 'url-backend')
  const urlBackendEnv = readEnv('AUTOSHOW_URL_BACKEND')
  const urlBackend = parseUrlBackend(urlBackendFlag ?? urlBackendEnv)
  const useReverb = isStep2BooleanProviderSelected('reverb-stt', mergedFlags, allShortcutFlags)
  const step2SelectionOrigins = resolveStep2SelectionOrigins(mergedFlags, explicitFlags, rawModelOccurrences, allShortcutFlags)
  const whisperExplicit = step2SelectionOrigins['whisper-stt'] === 'explicit' || step2SelectionOrigins['whisper-stt'] === 'all-shortcut'
  const useTesseract = isStep2BooleanProviderSelected('tesseract-ocr', mergedFlags, allShortcutFlags)
  const useOcrmypdf = isStep2BooleanProviderSelected('ocrmypdf', mergedFlags, allShortcutFlags)
  const usePaddleOcr = isStep2BooleanProviderSelected('paddle-ocr', mergedFlags, allShortcutFlags)

  return {
    useReverb,
    youtubeCaptions: readBooleanFlag(mergedFlags, 'youtube-captions'),
    whisperExplicit,
    step2SelectionOrigins,
    llamaModels,
    llamaModel,
    openaiModels,
    openaiModel,
    groqModels,
    groqModel,
    geminiModels,
    geminiModel,
    anthropicModels,
    anthropicModel,
    minimaxModels,
    minimaxModel,
    grokModels,
    grokModel,
    glmModels,
    glmModel,
    kimiModels,
    kimiModel,
    whisperModels,
    whisperModel,
    gcloudSttModels,
    gcloudSttModel,
    awsSttModels,
    awsSttModel,
    awsRegion: readOptionalStringFlag(mergedFlags, 'aws-region'),
    awsBucket: readOptionalStringFlag(mergedFlags, 'aws-bucket'),
    deepinfraSttModels,
    deepinfraSttModel,
    deapiSttModels,
    deapiSttModel,
    groqSttModels,
    groqSttModel,
    grokSttModels,
    grokSttModel,
    elevenlabsSttModels,
    elevenlabsSttModel,
    deepgramSttModels,
    deepgramSttModel,
    sonioxSttModels,
    sonioxSttModel,
    speechmaticsSttModels,
    speechmaticsSttModel,
    revSttModels,
    revSttModel,
    mistralSttModels,
    mistralSttModel,
    assemblyaiSttModels,
    assemblyaiSttModel,
    gladiaSttModels,
    gladiaSttModel,
    happyscribeSttModels,
    happyscribeSttModel,
    happyscribeOrganizationId: readOptionalStringFlag(mergedFlags, 'happyscribe-organization-id'),
    supadataSttModels,
    supadataSttModel,
    openaiSttModels,
    openaiSttModel,
    geminiSttModels,
    geminiSttModel,
    glmSttModels,
    glmSttModel,
    togetherSttModels,
    togetherSttModel,
    fireworksSttModels,
    fireworksSttModel,
    cloudflareSttModels,
    cloudflareSttModel,
    supadataLang: readOptionalStringFlag(mergedFlags, 'supadata-lang'),
    diarizationSpeakerCount: parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'speaker-count'), 'speaker-count'),
    sttProviderConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-provider-concurrency'), 2)),
    sttLocalConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-local-concurrency'), 1)),
    sttSegmentConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-segment-concurrency'), 2)),
    sttPreflightConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-preflight-concurrency'), 4)),
    ocrProviderConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'ocr-provider-concurrency'), 2)),
    ocrLocalConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'ocr-local-concurrency'), 1)),
    llmProviderConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'llm-provider-concurrency'), 2)),
    llmLocalConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'llm-local-concurrency'), 1)),
    refreshCache: readBooleanFlag(mergedFlags, 'refresh-cache'),
    noCache: readBooleanFlag(mergedFlags, 'no-cache'),
    price: readBooleanFlag(mergedFlags, 'price'),
    allowOverBudget: readBooleanFlag(mergedFlags, 'allow-over-budget'),
    reverbVerbatimicity: parseFloatWithDefault(readOptionalStringFlag(mergedFlags, 'reverb-verbatimicity'), 0.5),
    split: readBooleanFlag(mergedFlags, 'split'),
    skipLLM,
    dpi: parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'dpi'), 300),
    lang: readStringFlag(mergedFlags, 'lang', 'eng'),
    psm: parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'psm'), 3),
    oem: parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'oem'), 1),
    out: normalizedOut,
    password: readOptionalStringFlag(mergedFlags, 'password'),
    pageSeparator: readOptionalStringFlag(mergedFlags, 'page-separator'),
    preserveSpaces: readBooleanFlag(mergedFlags, 'preserve-spaces'),
    rotate: parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'rotate'), 0),
    useTesseract,
    useOcrmypdf,
    usePaddleOcr,
    mistralOcrModels,
    mistralOcrModel,
    glmOcrModels,
    glmOcrModel,
    kimiOcrModels,
    kimiOcrModel,
    openaiOcrModels,
    openaiOcrModel,
    anthropicOcrModels,
    anthropicOcrModel,
    geminiOcrModels,
    geminiOcrModel,
    deepinfraOcrModels,
    deepinfraOcrModel,
    awsTextractModels,
    awsTextractModel,
    gcloudDocaiModels,
    gcloudDocaiModel,
    deapiOcrModels,
    deapiOcrModel,
    primaryOcr: readOptionalStringFlag(mergedFlags, 'primary-ocr'),
    epubChapterFiles: readBooleanFlag(mergedFlags, 'chapters'),
    epubChunkLimitChars: epubLengthThousands === undefined ? undefined : epubLengthThousands * 1000,
    pdfChapterMode,
    useEpubBun: readBooleanFlag(mergedFlags, 'epub-bun'),
    useEpubCalibre: readBooleanFlag(mergedFlags, 'epub-calibre'),
    urlBackend,
    urlBackendExplicit: urlBackendFlag !== undefined || urlBackendEnv !== undefined,
    batchLimit: parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'batch-limit'), 5),
    batchAll: readBooleanFlag(mergedFlags, 'batch-all'),
    batchOrder: readBatchOrder(mergedFlags),
    batchConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'batch-concurrency'), 1)),
    keepOriginalMedia: readBooleanFlag(mergedFlags, 'keep-original-media'),
    flatBatch: readBooleanFlag(mergedFlags, 'flat-batch'),
    prompts: (() => {
      const v = mergedFlags['prompt']
      if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string' && s.length > 0)
      if (typeof v === 'string' && v.length > 0) return [v]
      return []
    })(),
    promptFile: readOptionalStringFlag(mergedFlags, 'prompt-file'),
    textInput: readBooleanFlag(mergedFlags, 'text-input'),
    renderedText: readBooleanFlag(mergedFlags, 'rendered-text'),
    renderedOutDir: readOptionalStringFlag(mergedFlags, 'rendered-out-dir'),
    trackList: readOptionalStringFlag(mergedFlags, 'track-list'),
    promptMd: readBooleanFlag(mergedFlags, 'prompt-md'),
    ttsSpeaker: (() => {
      const raw = readStringFlag(mergedFlags, 'kitten-voice', DEFAULT_KITTEN_TTS_SPEAKER)
      return kittenTtsModelValue !== undefined
        ? validateCliValue(validateKittenTtsSpeaker, raw)
        : raw
    })(),
    kittenTtsModels: kittenTtsModelValues,
    kittenTtsModel: kittenTtsModelValue === undefined ? undefined : validateCliValue(validateKittenTtsModel, kittenTtsModelValue),
    groqTtsModels,
    groqTtsModel: first(groqTtsModels),
    grokTtsModels,
    grokTtsModel: first(grokTtsModels),
    grokTtsVoice: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'grok-tts-voice')
      if (v === undefined) return undefined
      if (grokTtsModels === undefined) return v
      return validateCliValue(validateGrokTtsVoice, v)
    })(),
    openaiTtsModels,
    openaiTtsModel: first(openaiTtsModels),
    geminiTtsModels,
    geminiTtsModel: first(geminiTtsModels),
    deepgramTtsModels,
    deepgramTtsModel: first(deepgramTtsModels),
    runwayTtsModels,
    runwayTtsModel: first(runwayTtsModels),
    runwayTtsVoice: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'runway-tts-voice')
      if (v === undefined) return undefined
      if (runwayTtsModels === undefined) return v
      return validateCliValue(validateRunwayTtsVoice, v)
    })(),
    deapiTtsModels,
    deapiTtsModel: first(deapiTtsModels),
    deapiTtsVoice: readOptionalStringFlag(mergedFlags, 'deapi-tts-voice'),
    groqVoiceId: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'groq-voice')
      if (v === undefined) return undefined
      if (groqTtsModels === undefined) return v
      return validateCliValue(validateGroqTtsVoice, v)
    })(),
    openaiVoiceId: readOptionalStringFlag(mergedFlags, 'openai-voice'),
    geminiVoiceId: readOptionalStringFlag(mergedFlags, 'gemini-voice'),
    deepgramVoiceId: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'deepgram-voice')
      if (v === undefined) return undefined
      if (deepgramTtsModels === undefined) return v
      return validateCliValue(validateDeepgramTtsVoice, v)
    })(),
    geminiSpeaker1Name: readOptionalRawStringFlag(rawArgs, 'gemini-speaker-1-name') ?? readOptionalStringFlag(mergedFlags, 'gemini-speaker-1-name'),
    geminiSpeaker1Voice: readOptionalRawStringFlag(rawArgs, 'gemini-speaker-1-voice') ?? readOptionalStringFlag(mergedFlags, 'gemini-speaker-1-voice'),
    geminiSpeaker2Name: readOptionalRawStringFlag(rawArgs, 'gemini-speaker-2-name') ?? readOptionalStringFlag(mergedFlags, 'gemini-speaker-2-name'),
    geminiSpeaker2Voice: readOptionalRawStringFlag(rawArgs, 'gemini-speaker-2-voice') ?? readOptionalStringFlag(mergedFlags, 'gemini-speaker-2-voice'),
    elevenlabsTtsModels,
    elevenlabsTtsModel: first(elevenlabsTtsModels),
    minimaxTtsModels,
    minimaxTtsModel: first(minimaxTtsModels),
    minimaxTtsVoice: readOptionalStringFlag(mergedFlags, 'minimax-tts-voice'),
    elevenlabsVoiceId: readOptionalStringFlag(mergedFlags, 'elevenlabs-voice'),
    geminiImageModels,
    geminiImageModel: first(geminiImageModels),
    openaiImageModels,
    openaiImageModel: first(openaiImageModels),
    minimaxImageModels,
    minimaxImageModel: first(minimaxImageModels),
    glmImageModels,
    glmImageModel: first(glmImageModels),
    grokImageModels,
    grokImageModel: first(grokImageModels),
    runwayImageModels,
    runwayImageModel: first(runwayImageModels),
    bflImageModels,
    bflImageModel: first(bflImageModels),
    deapiImageModels,
    deapiImageModel: first(deapiImageModels),
    imageAspectRatio: readOptionalStringFlag(mergedFlags, 'image-aspect-ratio'),
    imageSize: readOptionalStringFlag(mergedFlags, 'image-size'),
    imageQuality: readOptionalStringFlag(mergedFlags, 'image-quality'),
    imageFormat: readOptionalStringFlag(mergedFlags, 'image-format'),
    imageBackground: readOptionalStringFlag(mergedFlags, 'image-background'),
    imagenCount: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'imagen-count')
      if (v === undefined) return undefined
      const n = parseInt(v, 10)
      return Number.isFinite(n) ? n : undefined
    })(),
    elevenlabsMusicModels,
    elevenlabsMusicModel: first(elevenlabsMusicModels),
    minimaxMusicModels,
    minimaxMusicModel: first(minimaxMusicModels),
    deapiMusicModels,
    deapiMusicModel: first(deapiMusicModels),
    geminiMusicModels,
    geminiMusicModel: first(geminiMusicModels),
    musicDuration: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'music-duration')
      if (v === undefined) return undefined
      const n = parseInt(v, 10)
      return Number.isFinite(n) ? n : undefined
    })(),
    musicLyricsFile: readOptionalStringFlag(mergedFlags, 'music-lyrics-file'),
    musicInstrumental: readBooleanFlag(mergedFlags, 'music-instrumental'),
    geminiVideoModels,
    geminiVideoModel: first(geminiVideoModels),
    minimaxVideoModels,
    minimaxVideoModel: first(minimaxVideoModels),
    glmVideoModels,
    glmVideoModel: first(glmVideoModels),
    grokVideoModels,
    grokVideoModel: first(grokVideoModels),
    runwayVideoModels,
    runwayVideoModel: first(runwayVideoModels),
    deapiVideoModels,
    deapiVideoModel: first(deapiVideoModels),
    videoDuration: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'video-duration')
      if (v === undefined) return undefined
      const n = parseInt(v, 10)
      return Number.isFinite(n) ? n : undefined
    })(),
    videoSize: readOptionalStringFlag(mergedFlags, 'video-size'),
    videoAspectRatio: readOptionalStringFlag(mergedFlags, 'video-aspect-ratio'),
    videoResolution: readOptionalStringFlag(mergedFlags, 'video-resolution'),

    markdown: readBooleanFlag(mergedFlags, 'markdown'),
    save: readBooleanFlag(mergedFlags, 'save'),
  }
}
