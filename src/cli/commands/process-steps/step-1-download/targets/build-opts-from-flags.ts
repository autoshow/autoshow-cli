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
  validateGroqSttModel,
  validateOpenAISttModel,
  validateMistralSttModel,
  validateAssemblyaiSttModel,
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
} from '~/cli/commands/models/model-options'
import type { BatchOrder, OutputFormat, RuntimeOptions } from '~/types'

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

const parseNonNegativeIntFlag = (
  value: string | undefined,
  flagName: string,
  fallback: number
): number => {
  if (value === undefined) {
    return fallback
  }

  if (!/^\d+$/.test(value)) {
    throw CLIUsageError(`Invalid --${flagName} value "${value}". Expected a non-negative integer.`)
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw CLIUsageError(`Invalid --${flagName} value "${value}". Expected a non-negative integer.`)
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

const readBooleanFlagWithDefault = (flags: Record<string, unknown>, key: string, fallback: boolean): boolean => {
  const value = flags[key]
  if (value === true) return true
  if (value === false) return false
  return fallback
}

const readBatchOrder = (flags: Record<string, unknown>): BatchOrder => {
  const v = flags['batch-order']
  return v === 'oldest' ? 'oldest' : 'newest'
}

const DEFAULT_KITTEN_TTS_MODEL = 'kitten-tts-nano-0.8-int8'
const DEFAULT_KITTEN_TTS_SPEAKER = 'Jasper'

type BuildOptsDefaults = {
  defaultTtsEngine?: 'kitten'
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
  const readValidated = <T>(key: string, validator: (v: string) => T): T | undefined => {
    const v = readOptionalStringFlag(mergedFlags, key)
    return v === undefined ? undefined : validator(v)
  }

  const jsonOutput = readBooleanFlag(mergedFlags, 'json-output')
  const mdOutput = readBooleanFlag(mergedFlags, 'md-output')

  if (jsonOutput && mdOutput) {
    throw CLIUsageError('Cannot use both --json-output and --md-output at the same time.')
  }

  const outputFormat = readStringFlag(mergedFlags, 'out', 'json')
  const normalizedOut: OutputFormat = outputFormat === 'text' || outputFormat === 'tsv' || outputFormat === 'hocr' ? outputFormat : 'json'

  const whisperModel = validateWhisperModel(readStringFlag(mergedFlags, 'whisper', 'tiny'))
  const groqSttModel = readValidated('groq-stt', validateGroqSttModel)
  const elevenlabsSttModel = readValidated('elevenlabs-stt', validateElevenlabsSttModel)
  const deepgramSttModel = readValidated('deepgram-stt', validateDeepgramSttModel)
  const sonioxSttModel = readValidated('soniox-stt', validateSonioxSttModel)
  const openaiSttModel = readValidated('openai-stt', validateOpenAISttModel)
  const mistralSttModel = readValidated('mistral-stt', validateMistralSttModel)
  const assemblyaiSttModel = readValidated('assemblyai-stt', validateAssemblyaiSttModel)
  const mistralOcrModel = readValidated('mistral-ocr', validateMistralOcrModel)
  const llamaModel = readValidated('llama', validateLlamaModel)
  const openaiModel = readValidated('openai', validateOpenAIModel)
  const groqModel = readValidated('groq', validateGroqModel)
  const geminiModel = readValidated('gemini', validateGeminiModel)
  const anthropicModel = readValidated('anthropic', validateAnthropicModel)
  const minimaxModel = readValidated('minimax', validateMinimaxModel)
  const grokModel = readValidated('grok', validateGrokModel)
  const kittenTtsModelFlag = readOptionalStringFlag(mergedFlags, 'kitten-tts')
  const elevenlabsTtsModelFlag = readOptionalStringFlag(mergedFlags, 'elevenlabs-tts')
  const minimaxTtsModelFlag = readOptionalStringFlag(mergedFlags, 'minimax-tts')
  const groqTtsModelFlag = readOptionalStringFlag(mergedFlags, 'groq-tts')
  const openaiTtsModelFlag = readOptionalStringFlag(mergedFlags, 'openai-tts')
  const geminiTtsModelFlag = readOptionalStringFlag(mergedFlags, 'gemini-tts')
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

  return {
    useReverb: readBooleanFlag(mergedFlags, 'reverb'),
    whisperExplicit: explicitFlags.has('whisper'),
    useOpenAI: openaiModel !== undefined,
    useGemini: geminiModel !== undefined,
    useAnthropic: anthropicModel !== undefined,
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
    openaiSttModel,
    mistralSttModel,
    assemblyaiSttModel,
    diarizationSpeakerCount: parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'speaker-count'), 'speaker-count'),
    diarizationSpeakerNames: readOptionalStringArrayFlag(mergedFlags, 'speaker-name'),
    diarizationSpeakerReferences: readOptionalStringArrayFlag(mergedFlags, 'speaker-reference'),
    sttProviderConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-provider-concurrency'), 2)),
    sttLocalConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-local-concurrency'), 1)),
    sttSegmentConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-segment-concurrency'), 2)),
    sttPreflightConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-preflight-concurrency'), 4)),
    resumeMissingFrom: readOptionalStringFlag(mergedFlags, 'resume-missing-from'),
    refreshCache: readBooleanFlag(mergedFlags, 'refresh-cache'),
    noCache: readBooleanFlag(mergedFlags, 'no-cache'),
    price: readBooleanFlag(mergedFlags, 'price') || readBooleanFlag(mergedFlags, 'dry-run'),
    allowOverBudget: readBooleanFlag(mergedFlags, 'allow-over-budget'),
    reverbVerbatimicity: parseFloatWithDefault(readOptionalStringFlag(mergedFlags, 'reverb-verbatimicity'), 0.5),
    split: readBooleanFlag(mergedFlags, 'split'),
    skipLLM,
    structured: jsonOutput
      ? true
      : mdOutput
        ? false
        : readBooleanFlagWithDefault(mergedFlags, 'structured', true),
    structuredStrict: readBooleanFlagWithDefault(mergedFlags, 'structured-strict', true),
    structuredCompatRetries: parseNonNegativeIntFlag(readOptionalStringFlag(mergedFlags, 'structured-compat-retries'), 'structured-compat-retries', 2),
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
    useEpubBun: readBooleanFlag(mergedFlags, 'epub-bun'),
    useEpubCalibre: readBooleanFlag(mergedFlags, 'epub-calibre'),
    batchLimit: parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'batch-limit'), 5),
    batchAll: readBooleanFlag(mergedFlags, 'batch-all'),
    batchOrder: readBatchOrder(mergedFlags),
    batchConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'batch-concurrency'), 1)),
    prompts: (() => {
      const v = mergedFlags['prompt']
      if (Array.isArray(v)) return v.filter((s): s is string => typeof s === 'string' && s.length > 0)
      if (typeof v === 'string' && v.length > 0) return [v]
      return []
    })(),
    ttsSpeaker: (() => {
      const raw = readStringFlag(mergedFlags, 'kitten-voice', DEFAULT_KITTEN_TTS_SPEAKER)
      if (kittenTtsModelValue !== undefined) {
        const speaker = raw === 'Ryan' ? DEFAULT_KITTEN_TTS_SPEAKER : raw
        return validateKittenTtsSpeaker(speaker)
      }
      return raw
    })(),
    kittenTtsModel: kittenTtsModelValue === undefined ? undefined : validateKittenTtsModel(kittenTtsModelValue),
    groqTtsModel: groqTtsModelFlag === undefined ? undefined : validateGroqTtsModel(groqTtsModelFlag),
    openaiTtsModel: openaiTtsModelFlag === undefined ? undefined : validateOpenAITtsModel(openaiTtsModelFlag),
    geminiTtsModel: geminiTtsModelFlag === undefined ? undefined : validateGeminiTtsModel(geminiTtsModelFlag),
    groqVoiceId: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'groq-voice')
      if (v === undefined) return undefined
      if (groqTtsModelFlag === undefined) return v
      return validateGroqTtsVoice(v)
    })(),
    openaiVoiceId: readOptionalStringFlag(mergedFlags, 'openai-voice'),
    geminiVoiceId: readOptionalStringFlag(mergedFlags, 'gemini-voice'),
    elevenlabsTtsModel: elevenlabsTtsModelFlag === undefined ? undefined : validateElevenlabsTtsModel(elevenlabsTtsModelFlag),
    minimaxTtsModel: minimaxTtsModelFlag === undefined ? undefined : validateMinimaxTtsModel(minimaxTtsModelFlag),
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
