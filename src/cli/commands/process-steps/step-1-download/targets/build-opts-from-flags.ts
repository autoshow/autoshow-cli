import { CLIUsageError } from '~/utils/error-handler'
import {
  validateLlamaModel,
  validateOpenAIModel,
  validateGroqModel,
  validateGeminiModel,
  validateAnthropicModel,
  validateMinimaxModel,
  validateGrokModel,
  validateWhisperModel,
  validateGcloudSttModel,
  validateAwsSttModel,
  validateElevenlabsSttModel,
  validateDeepgramSttModel,
  validateSonioxSttModel,
  validateSpeechmaticsSttModel,
  validateRevSttModel,
  validateGroqSttModel,
  validateMistralSttModel,
  validateAssemblyaiSttModel,
  validateGladiaSttModel,
  validateGlmOcrModel,
  validateMistralOcrModel,
  validateKittenTtsModel,
  validateElevenlabsTtsModel,
  validateMinimaxTtsModel,
  validateGroqTtsModel,
  validateOpenAITtsModel,
  validateGeminiTtsModel,
  validateGroqTtsVoice,
  validateElevenlabsMusicModel,
  validateMinimaxMusicModel,
  validateKittenTtsSpeaker,
  validateGeminiImageModel,
  validateMinimaxImageModel,
  validateOpenAIImageModel,
  validateGeminiVideoModel,
  validateMinimaxVideoModel
} from '~/cli/commands/setup-and-utilities/models/model-options'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import { readEnv } from '~/utils/validate/env-utils'
import type { BatchOrder, BuildOptsDefaults, OutputFormat, RuntimeOptions } from '~/types'

export const REPEATABLE_MODEL_FLAGS = [
  'whisper',
  'gcloud-stt',
  'aws-stt',
  'groq-stt',
  'elevenlabs-stt',
  'deepgram-stt',
  'soniox-stt',
  'speechmatics-stt',
  'rev-stt',
  'mistral-stt',
  'assemblyai-stt',
  'gladia-stt',
  'mistral-ocr',
  'glm-ocr',
  'llama',
  'openai',
  'groq',
  'gemini',
  'anthropic',
  'minimax',
  'grok',
  'kitten-tts',
  'elevenlabs-tts',
  'minimax-tts',
  'groq-tts',
  'openai-tts',
  'gemini-tts',
  'gemini-image',
  'openai-image',
  'minimax-image',
  'elevenlabs-music',
  'minimax-music',
  'gemini-video',
  'minimax-video'
] as const

export type RepeatableModelFlag = typeof REPEATABLE_MODEL_FLAGS[number]
type FlagOccurrenceValue = string | boolean

const REPEATABLE_MODEL_FLAG_SET = new Set<string>(REPEATABLE_MODEL_FLAGS)

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

const readStringFlag = (flags: Record<string, unknown>, key: string, fallback: string): string => {
  const value = flags[key]
  if (typeof value === 'string' && value.length > 0) {
    return value
  }
  return fallback
}

const readOptionalStringFlag = (flags: Record<string, unknown>, key: string): string | undefined => {
  const value = flags[key]
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
    const key = (eqIdx === -1 ? withoutDashes : withoutDashes.slice(0, eqIdx)) as RepeatableModelFlag
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
  return flags[key] === true
}

const readBatchOrder = (flags: Record<string, unknown>): BatchOrder => {
  const v = flags['batch-order']
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
    const key = arg.slice(2)
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
    const values = normalizeModelFlagOccurrences(key, mergedFlags, rawModelOccurrences)
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

  const whisperModels = readValidatedMany('whisper', validateWhisperModel)
  const whisperModel = first(whisperModels) ?? validateCliValue(validateWhisperModel, readStringFlag(mergedFlags, 'whisper', 'tiny'))
  const gcloudSttModels = readValidatedMany('gcloud-stt', validateGcloudSttModel)
  const awsSttModels = readValidatedMany('aws-stt', validateAwsSttModel)
  const groqSttModels = readValidatedMany('groq-stt', validateGroqSttModel)
  const elevenlabsSttModels = readValidatedMany('elevenlabs-stt', validateElevenlabsSttModel)
  const deepgramSttModels = readValidatedMany('deepgram-stt', validateDeepgramSttModel)
  const sonioxSttModels = readValidatedMany('soniox-stt', validateSonioxSttModel)
  const speechmaticsSttModels = readValidatedMany('speechmatics-stt', validateSpeechmaticsSttModel)
  const revSttModels = readValidatedMany('rev-stt', validateRevSttModel)
  const mistralSttModels = readValidatedMany('mistral-stt', validateMistralSttModel)
  const assemblyaiSttModels = readValidatedMany('assemblyai-stt', validateAssemblyaiSttModel)
  const gladiaSttModels = readValidatedMany('gladia-stt', validateGladiaSttModel)
  const mistralOcrModels = readValidatedMany('mistral-ocr', validateMistralOcrModel)
  const glmOcrModels = readValidatedMany('glm-ocr', validateGlmOcrModel)
  const llamaModels = readValidatedMany('llama', validateLlamaModel)
  const openaiModels = readValidatedMany('openai', validateOpenAIModel)
  const groqModels = readValidatedMany('groq', validateGroqModel)
  const geminiModels = readValidatedMany('gemini', validateGeminiModel)
  const anthropicModels = readValidatedMany('anthropic', validateAnthropicModel)
  const minimaxModels = readValidatedMany('minimax', validateMinimaxModel)
  const grokModels = readValidatedMany('grok', validateGrokModel)
  const gcloudSttModel = first(gcloudSttModels)
  const awsSttModel = first(awsSttModels)
  const groqSttModel = first(groqSttModels)
  const elevenlabsSttModel = first(elevenlabsSttModels)
  const deepgramSttModel = first(deepgramSttModels)
  const sonioxSttModel = first(sonioxSttModels)
  const speechmaticsSttModel = first(speechmaticsSttModels)
  const revSttModel = first(revSttModels)
  const mistralSttModel = first(mistralSttModels)
  const assemblyaiSttModel = first(assemblyaiSttModels)
  const gladiaSttModel = first(gladiaSttModels)
  const mistralOcrModel = first(mistralOcrModels)
  const glmOcrModel = first(glmOcrModels)
  const llamaModel = first(llamaModels)
  const openaiModel = first(openaiModels)
  const groqModel = first(groqModels)
  const geminiModel = first(geminiModels)
  const anthropicModel = first(anthropicModels)
  const minimaxModel = first(minimaxModels)
  const grokModel = first(grokModels)
  const kittenTtsModels = readValidatedMany('kitten-tts', validateKittenTtsModel)
  const elevenlabsTtsModels = readValidatedMany('elevenlabs-tts', validateElevenlabsTtsModel)
  const minimaxTtsModels = readValidatedMany('minimax-tts', validateMinimaxTtsModel)
  const groqTtsModels = readValidatedMany('groq-tts', validateGroqTtsModel)
  const openaiTtsModels = readValidatedMany('openai-tts', validateOpenAITtsModel)
  const geminiTtsModels = readValidatedMany('gemini-tts', validateGeminiTtsModel)
  const hasExplicitTtsEngine = [
    kittenTtsModels,
    elevenlabsTtsModels,
    minimaxTtsModels,
    groqTtsModels,
    openaiTtsModels,
    geminiTtsModels
  ].some((value) => value !== undefined && value.length > 0)
  const kittenTtsModelValues = defaults.defaultTtsEngine === 'kitten' && !hasExplicitTtsEngine
    ? [DEFAULT_KITTEN_TTS_MODEL]
    : kittenTtsModels
  const kittenTtsModelValue = first(kittenTtsModelValues)
  const geminiImageModels = readValidatedMany('gemini-image', validateGeminiImageModel)
  const openaiImageModels = readValidatedMany('openai-image', validateOpenAIImageModel)
  const minimaxImageModels = readValidatedMany('minimax-image', validateMinimaxImageModel)
  const elevenlabsMusicModels = readValidatedMany('elevenlabs-music', validateElevenlabsMusicModel)
  const minimaxMusicModels = readValidatedMany('minimax-music', validateMinimaxMusicModel)
  const geminiVideoModels = readValidatedMany('gemini-video', validateGeminiVideoModel)
  const minimaxVideoModels = readValidatedMany('minimax-video', validateMinimaxVideoModel)
  const urlBackendFlag = readOptionalStringFlag(mergedFlags, 'url-backend')
  const urlBackendEnv = readEnv('AUTOSHOW_URL_BACKEND')
  const urlBackend = parseUrlBackend(urlBackendFlag ?? urlBackendEnv)

  return {
    useReverb: readBooleanFlag(mergedFlags, 'reverb'),
    youtubeCaptions: readBooleanFlag(mergedFlags, 'youtube-captions'),
    whisperExplicit: explicitFlags.has('whisper'),
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
    whisperModels,
    whisperModel,
    gcloudSttModels,
    gcloudSttModel,
    awsSttModels,
    awsSttModel,
    awsRegion: readOptionalStringFlag(mergedFlags, 'aws-region'),
    awsBucket: readOptionalStringFlag(mergedFlags, 'aws-bucket'),
    groqSttModels,
    groqSttModel,
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
    diarizationSpeakerCount: parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'speaker-count'), 'speaker-count'),
    sttProviderConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-provider-concurrency'), 2)),
    sttLocalConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-local-concurrency'), 1)),
    sttSegmentConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-segment-concurrency'), 2)),
    sttPreflightConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-preflight-concurrency'), 4)),
    resumeMissing: readOptionalStringFlag(mergedFlags, 'resume-missing'),
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
    useOcrmypdf: readBooleanFlag(mergedFlags, 'ocrmypdf'),
    usePaddleOcr: readBooleanFlag(mergedFlags, 'paddle-ocr'),
    mistralOcrModels,
    mistralOcrModel,
    glmOcrModels,
    glmOcrModel,
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
    openaiTtsModels,
    openaiTtsModel: first(openaiTtsModels),
    geminiTtsModels,
    geminiTtsModel: first(geminiTtsModels),
    groqVoiceId: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'groq-voice')
      if (v === undefined) return undefined
      if (groqTtsModels === undefined) return v
      return validateCliValue(validateGroqTtsVoice, v)
    })(),
    openaiVoiceId: readOptionalStringFlag(mergedFlags, 'openai-voice'),
    geminiVoiceId: readOptionalStringFlag(mergedFlags, 'gemini-voice'),
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
