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
  validateElevenlabsSttModel,
  validateDeepgramSttModel,
  validateSonioxSttModel,
  validateSpeechmaticsSttModel,
  validateRevSttModel,
  validateGroqSttModel,
  validateOpenAISttModel,
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

const readOptionalModelFlag = (flags: Record<string, unknown>, key: string): string | undefined => {
  const value = flags[key]
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length > 0) {
      return trimmed
    }

    return resolveCheapestModelForFlag(key)
  }

  if (value === true) {
    return resolveCheapestModelForFlag(key)
  }

  return undefined
}

const readOptionalStringArrayFlag = (flags: Record<string, unknown>, key: string): string[] | undefined => {
  const value = flags[key]
  if (Array.isArray(value)) {
    const values = value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    return values.length > 0 ? values : undefined
  }
  if (typeof value === 'string' && value.length > 0) {
    return [value]
  }
  return undefined
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
  explicitFlags: Set<string> = new Set()
): RuntimeOptions => {
  const ddArgs = parseDoubleDashArgs(doubleDashArgs)

  const mergedFlags: Record<string, unknown> = { ...ddArgs, ...flags }
  const validateCliValue = <T>(validator: (value: string) => T, value: string): T => {
    try {
      return validator(value)
    } catch (error) {
      throw CLIUsageError(error instanceof Error ? error.message : String(error))
    }
  }
  const readValidated = <T>(key: string, validator: (v: string) => T): T | undefined => {
    const v = readOptionalModelFlag(mergedFlags, key)
    return v === undefined ? undefined : validateCliValue(validator, v)
  }

  const outputFormat = readStringFlag(mergedFlags, 'out', 'json')
  const normalizedOut: OutputFormat = outputFormat === 'text' || outputFormat === 'tsv' || outputFormat === 'hocr' ? outputFormat : 'json'
  const epubLengthThousands = parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'length'), 'length')

  const whisperModel = validateCliValue(validateWhisperModel, readStringFlag(mergedFlags, 'whisper', 'tiny'))
  const groqSttModel = readValidated('groq-stt', validateGroqSttModel)
  const elevenlabsSttModel = readValidated('elevenlabs-stt', validateElevenlabsSttModel)
  const deepgramSttModel = readValidated('deepgram-stt', validateDeepgramSttModel)
  const sonioxSttModel = readValidated('soniox-stt', validateSonioxSttModel)
  const speechmaticsSttModel = readValidated('speechmatics-stt', validateSpeechmaticsSttModel)
  const revSttModel = readValidated('rev-stt', validateRevSttModel)
  const openaiSttModel = readValidated('openai-stt', validateOpenAISttModel)
  const mistralSttModel = readValidated('mistral-stt', validateMistralSttModel)
  const assemblyaiSttModel = readValidated('assemblyai-stt', validateAssemblyaiSttModel)
  const gladiaSttModel = readValidated('gladia-stt', validateGladiaSttModel)
  const mistralOcrModel = readValidated('mistral-ocr', validateMistralOcrModel)
  const glmOcrModel = readValidated('glm-ocr', validateGlmOcrModel)
  const llamaModel = readValidated('llama', validateLlamaModel)
  const openaiModel = readValidated('openai', validateOpenAIModel)
  const groqModel = readValidated('groq', validateGroqModel)
  const geminiModel = readValidated('gemini', validateGeminiModel)
  const anthropicModel = readValidated('anthropic', validateAnthropicModel)
  const minimaxModel = readValidated('minimax', validateMinimaxModel)
  const grokModel = readValidated('grok', validateGrokModel)
  const kittenTtsModelFlag = readOptionalModelFlag(mergedFlags, 'kitten-tts')
  const elevenlabsTtsModelFlag = readOptionalModelFlag(mergedFlags, 'elevenlabs-tts')
  const minimaxTtsModelFlag = readOptionalModelFlag(mergedFlags, 'minimax-tts')
  const groqTtsModelFlag = readOptionalModelFlag(mergedFlags, 'groq-tts')
  const openaiTtsModelFlag = readOptionalModelFlag(mergedFlags, 'openai-tts')
  const geminiTtsModelFlag = readOptionalModelFlag(mergedFlags, 'gemini-tts')
  const hasExplicitTtsEngine = [
    kittenTtsModelFlag,
    elevenlabsTtsModelFlag,
    minimaxTtsModelFlag,
    groqTtsModelFlag,
    openaiTtsModelFlag,
    geminiTtsModelFlag
  ].some((value) => value !== undefined)
  const kittenTtsModelValue = defaults.defaultTtsEngine === 'kitten' && !hasExplicitTtsEngine
    ? DEFAULT_KITTEN_TTS_MODEL
    : kittenTtsModelFlag
  const urlBackendFlag = readOptionalStringFlag(mergedFlags, 'url-backend')
  const urlBackendEnv = readEnv('AUTOSHOW_URL_BACKEND')
  const urlBackend = parseUrlBackend(urlBackendFlag ?? urlBackendEnv)

  return {
    useReverb: readBooleanFlag(mergedFlags, 'reverb'),
    youtubeCaptions: readBooleanFlag(mergedFlags, 'youtube-captions'),
    whisperExplicit: explicitFlags.has('whisper'),
    llamaModel,
    openaiModel,
    groqModel,
    geminiModel,
    anthropicModel,
    minimaxModel,
    grokModel,
    whisperModel,
    groqSttModel,
    elevenlabsSttModel,
    deepgramSttModel,
    sonioxSttModel,
    speechmaticsSttModel,
    revSttModel,
    openaiSttModel,
    mistralSttModel,
    assemblyaiSttModel,
    gladiaSttModel,
    diarizationSpeakerCount: parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'speaker-count'), 'speaker-count'),
    diarizationSpeakerNames: readOptionalStringArrayFlag(mergedFlags, 'speaker-name'),
    diarizationSpeakerReferences: readOptionalStringArrayFlag(mergedFlags, 'speaker-reference'),
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
    mistralOcrModel,
    glmOcrModel,
    epubChapterFiles: readBooleanFlag(mergedFlags, 'chapters'),
    epubChunkLimitChars: epubLengthThousands === undefined ? undefined : epubLengthThousands * 1000,
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
    ttsSpeaker: (() => {
      const raw = readStringFlag(mergedFlags, 'kitten-voice', DEFAULT_KITTEN_TTS_SPEAKER)
      return kittenTtsModelValue !== undefined
        ? validateCliValue(validateKittenTtsSpeaker, raw)
        : raw
    })(),
    kittenTtsModel: kittenTtsModelValue === undefined ? undefined : validateCliValue(validateKittenTtsModel, kittenTtsModelValue),
    groqTtsModel: groqTtsModelFlag === undefined ? undefined : validateCliValue(validateGroqTtsModel, groqTtsModelFlag),
    openaiTtsModel: openaiTtsModelFlag === undefined ? undefined : validateCliValue(validateOpenAITtsModel, openaiTtsModelFlag),
    geminiTtsModel: geminiTtsModelFlag === undefined ? undefined : validateCliValue(validateGeminiTtsModel, geminiTtsModelFlag),
    groqVoiceId: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'groq-voice')
      if (v === undefined) return undefined
      if (groqTtsModelFlag === undefined) return v
      return validateCliValue(validateGroqTtsVoice, v)
    })(),
    openaiVoiceId: readOptionalStringFlag(mergedFlags, 'openai-voice'),
    geminiVoiceId: readOptionalStringFlag(mergedFlags, 'gemini-voice'),
    elevenlabsTtsModel: elevenlabsTtsModelFlag === undefined ? undefined : validateCliValue(validateElevenlabsTtsModel, elevenlabsTtsModelFlag),
    minimaxTtsModel: minimaxTtsModelFlag === undefined ? undefined : validateCliValue(validateMinimaxTtsModel, minimaxTtsModelFlag),
    minimaxTtsVoice: readOptionalStringFlag(mergedFlags, 'minimax-tts-voice'),
    elevenlabsVoiceId: readOptionalStringFlag(mergedFlags, 'elevenlabs-voice'),
    geminiImageModel: readValidated('gemini-image', validateGeminiImageModel),
    openaiImageModel: readValidated('openai-image', validateOpenAIImageModel),
    minimaxImageModel: readValidated('minimax-image', validateMinimaxImageModel),
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
    elevenlabsMusicModel: readValidated('elevenlabs-music', validateElevenlabsMusicModel),
    minimaxMusicModel: readValidated('minimax-music', validateMinimaxMusicModel),
    musicDuration: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'music-duration')
      if (v === undefined) return undefined
      const n = parseInt(v, 10)
      return Number.isFinite(n) ? n : undefined
    })(),
    musicLyricsFile: readOptionalStringFlag(mergedFlags, 'music-lyrics-file'),
    musicInstrumental: readBooleanFlag(mergedFlags, 'music-instrumental'),
    geminiVideoModel: readValidated('gemini-video', validateGeminiVideoModel),
    minimaxVideoModel: readValidated('minimax-video', validateMinimaxVideoModel),
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
