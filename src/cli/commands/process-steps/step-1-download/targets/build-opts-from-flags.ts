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
  defaults: BuildOptsDefaults = {}
): RuntimeOptions => {
  const ddArgs = parseDoubleDashArgs(doubleDashArgs)

  const mergedFlags: Record<string, unknown> = { ...ddArgs, ...flags }
  const jsonOutput = readBooleanFlag(mergedFlags, 'json-output')
  const mdOutput = readBooleanFlag(mergedFlags, 'md-output')

  if (jsonOutput && mdOutput) {
    throw CLIUsageError('Cannot use both --json-output and --md-output at the same time.')
  }

  const outputFormat = readStringFlag(mergedFlags, 'out', 'json')
  const normalizedOut: OutputFormat = outputFormat === 'text' || outputFormat === 'tsv' || outputFormat === 'hocr' ? outputFormat : 'json'

  const whisperModel = validateWhisperModel(readStringFlag(mergedFlags, 'whisper', 'tiny'))
  const groqSttModel = (() => {
    const v = readOptionalStringFlag(mergedFlags, 'groq-stt')
    return v === undefined ? undefined : validateGroqSttModel(v)
  })()
  const elevenlabsSttModel = (() => {
    const v = readOptionalStringFlag(mergedFlags, 'elevenlabs-stt')
    return v === undefined ? undefined : validateElevenlabsSttModel(v)
  })()
  const openaiSttModel = (() => {
    const v = readOptionalStringFlag(mergedFlags, 'openai-stt')
    return v === undefined ? undefined : validateOpenAISttModel(v)
  })()
  const mistralSttModel = (() => {
    const v = readOptionalStringFlag(mergedFlags, 'mistral-stt')
    return v === undefined ? undefined : validateMistralSttModel(v)
  })()
  const assemblyaiSttModel = (() => {
    const v = readOptionalStringFlag(mergedFlags, 'assemblyai-stt')
    return v === undefined ? undefined : validateAssemblyaiSttModel(v)
  })()
  const mistralOcrModel = (() => {
    const v = readOptionalStringFlag(mergedFlags, 'mistral-ocr')
    return v === undefined ? undefined : validateMistralOcrModel(v)
  })()
  const llamaModelFlag = readOptionalStringFlag(mergedFlags, 'llama')
  const llamaModel = llamaModelFlag === undefined ? undefined : validateLlamaModel(llamaModelFlag)
  const openaiModelFlag = readOptionalStringFlag(mergedFlags, 'openai')
  const openaiModel = openaiModelFlag === undefined ? undefined : validateOpenAIModel(openaiModelFlag)
  const groqModelFlag = readOptionalStringFlag(mergedFlags, 'groq')
  const groqModel = groqModelFlag === undefined ? undefined : validateGroqModel(groqModelFlag)
  const geminiModelFlag = readOptionalStringFlag(mergedFlags, 'gemini')
  const geminiModel = geminiModelFlag === undefined ? undefined : validateGeminiModel(geminiModelFlag)
  const anthropicModelFlag = readOptionalStringFlag(mergedFlags, 'anthropic')
  const anthropicModel = anthropicModelFlag === undefined ? undefined : validateAnthropicModel(anthropicModelFlag)
  const minimaxModelFlag = readOptionalStringFlag(mergedFlags, 'minimax')
  const minimaxModel = minimaxModelFlag === undefined ? undefined : validateMinimaxModel(minimaxModelFlag)
  const grokModelFlag = readOptionalStringFlag(mergedFlags, 'grok')
  const grokModel = grokModelFlag === undefined ? undefined : validateGrokModel(grokModelFlag)
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
    openaiSttModel,
    mistralSttModel,
    assemblyaiSttModel,
    diarizationSpeakerCount: parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'speaker-count'), 'speaker-count'),
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
    kittenTtsModel: (() => {
      return kittenTtsModelValue === undefined ? undefined : validateKittenTtsModel(kittenTtsModelValue)
    })(),
    groqTtsModel: (() => {
      return groqTtsModelFlag === undefined ? undefined : validateGroqTtsModel(groqTtsModelFlag)
    })(),
    openaiTtsModel: (() => {
      return openaiTtsModelFlag === undefined ? undefined : validateOpenAITtsModel(openaiTtsModelFlag)
    })(),
    geminiTtsModel: (() => {
      return geminiTtsModelFlag === undefined ? undefined : validateGeminiTtsModel(geminiTtsModelFlag)
    })(),
    groqVoiceId: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'groq-voice')
      if (v === undefined) return undefined
      if (groqTtsModelFlag === undefined) return v
      return validateGroqTtsVoice(v)
    })(),
    openaiVoiceId: readOptionalStringFlag(mergedFlags, 'openai-voice'),
    geminiVoiceId: readOptionalStringFlag(mergedFlags, 'gemini-voice'),
    elevenlabsTtsModel: (() => {
      return elevenlabsTtsModelFlag === undefined ? undefined : validateElevenlabsTtsModel(elevenlabsTtsModelFlag)
    })(),
    minimaxTtsModel: (() => {
      return minimaxTtsModelFlag === undefined ? undefined : validateMinimaxTtsModel(minimaxTtsModelFlag)
    })(),
    minimaxTtsVoice: readOptionalStringFlag(mergedFlags, 'minimax-tts-voice'),
    elevenlabsVoiceId: readOptionalStringFlag(mergedFlags, 'elevenlabs-voice'),
    geminiImageModel: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'gemini-image')
      return v === undefined ? undefined : validateGeminiImageModel(v)
    })(),
    openaiImageModel: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'openai-image')
      return v === undefined ? undefined : validateOpenAIImageModel(v)
    })(),
    minimaxImageModel: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'minimax-image')
      return v === undefined ? undefined : validateMinimaxImageModel(v)
    })(),
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
    elevenlabsMusicModel: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'elevenlabs-music')
      return v === undefined ? undefined : validateElevenlabsMusicModel(v)
    })(),
    minimaxMusicModel: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'minimax-music')
      return v === undefined ? undefined : validateMinimaxMusicModel(v)
    })(),
    musicDuration: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'music-duration')
      if (v === undefined) return undefined
      const n = parseInt(v, 10)
      return Number.isFinite(n) ? n : undefined
    })(),
    musicLyricsFile: readOptionalStringFlag(mergedFlags, 'music-lyrics-file'),
    musicInstrumental: readBooleanFlag(mergedFlags, 'music-instrumental'),
    geminiVideoModel: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'gemini-video')
      return v === undefined ? undefined : validateGeminiVideoModel(v)
    })(),
    minimaxVideoModel: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'minimax-video')
      return v === undefined ? undefined : validateMinimaxVideoModel(v)
    })(),
    videoDuration: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'video-duration')
      if (v === undefined) return undefined
      const n = parseInt(v, 10)
      return Number.isFinite(n) ? n : undefined
    })(),
    videoSize: readOptionalStringFlag(mergedFlags, 'video-size'),
    videoAspectRatio: readOptionalStringFlag(mergedFlags, 'video-aspect-ratio'),
    videoResolution: readOptionalStringFlag(mergedFlags, 'video-resolution'),

    save: readBooleanFlag(mergedFlags, 'save'),
  }
}
