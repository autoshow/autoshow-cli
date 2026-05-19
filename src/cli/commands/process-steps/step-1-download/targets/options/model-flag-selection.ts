import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
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
  SUPPORTED_MISTRAL_TTS_MODELS,
  SUPPORTED_OPENAI_TTS_MODELS,
  SUPPORTED_GEMINI_TTS_MODELS,
  SUPPORTED_DEAPI_RUNNABLE_TTS_MODELS,
  SUPPORTED_SPEECHIFY_TTS_MODELS,
  SUPPORTED_HUME_TTS_MODELS,
  SUPPORTED_CARTESIA_TTS_MODELS,
  SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS,
  DEEPGRAM_DEFAULT_VOICE,
  SUPPORTED_GEMINI_IMAGE_MODELS,
  SUPPORTED_DEAPI_IMAGE_MODELS,
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
  SUPPORTED_RUNWAY_VIDEO_MODELS
} from '~/cli/commands/setup-and-utilities/models/model-options'
import {
  getStep2ProviderEntries,
  getStep2AllShortcutModelExpansions,
  isStep2BooleanProviderSelected
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import type { AllShortcutFlag, FlagOccurrenceValue, RepeatableModelFlag, Step2ProviderSelectionOrigin } from '~/types'
import { readBooleanFlag } from './flag-readers'

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
  'scrapecreators-stt',
  'openai-stt',
  'gemini-stt',
  'glm-stt',
  'together-stt',
  'mistral-ocr',
  'glm-ocr',
  'kimi-ocr',
  'openai-ocr',
  'anthropic-ocr',
  'gemini-ocr',
  'deepinfra-ocr',
  'aws-textract',
  'gcloud-docai',
  'unstructured-ocr',
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
  'mistral-tts',
  'openai-tts',
  'gemini-tts',
  'speechify-tts',
  'hume-tts',
  'cartesia-tts',
  'gcloud-tts',
  'deapi-tts',
  'deepgram-tts',
  'gemini-image',
  'openai-image',
  'minimax-image',
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
  'mistral-tts': { shortcut: 'all-tts', supported: SUPPORTED_MISTRAL_TTS_MODELS },
  'openai-tts': { shortcut: 'all-tts', supported: SUPPORTED_OPENAI_TTS_MODELS },
  'gemini-tts': { shortcut: 'all-tts', supported: SUPPORTED_GEMINI_TTS_MODELS },
  'deepgram-tts': { shortcut: 'all-tts', supported: [DEEPGRAM_DEFAULT_VOICE] },
  'speechify-tts': { shortcut: 'all-tts', supported: SUPPORTED_SPEECHIFY_TTS_MODELS },
  'hume-tts': { shortcut: 'all-tts', supported: SUPPORTED_HUME_TTS_MODELS },
  'cartesia-tts': { shortcut: 'all-tts', supported: SUPPORTED_CARTESIA_TTS_MODELS },
  'gcloud-tts': { shortcut: 'all-tts', supported: SUPPORTED_GCLOUD_PREBUILT_TTS_MODELS },
  'deapi-tts': { shortcut: 'all-tts', supported: SUPPORTED_DEAPI_RUNNABLE_TTS_MODELS },
  'gemini-image': { shortcut: 'all-image', supported: SUPPORTED_GEMINI_IMAGE_MODELS },
  'openai-image': { shortcut: 'all-image', supported: SUPPORTED_OPENAI_IMAGE_MODELS },
  'minimax-image': { shortcut: 'all-image', supported: SUPPORTED_MINIMAX_IMAGE_MODELS },
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

export const parseRepeatableModelFlagOccurrences = (
  args: string[]
): Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>> => {
  const result: Partial<Record<RepeatableModelFlag, FlagOccurrenceValue[]>> = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string
    if (arg === '--') {
      break
    }
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

export const appendUnique = <T>(values: T[], value: T): void => {
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

export const readAllShortcutFlags = (flags: Record<string, unknown>): Record<AllShortcutFlag, boolean> => ({
  'all-stt': readBooleanFlag(flags, 'all-stt'),
  'all-ocr': readBooleanFlag(flags, 'all-ocr'),
  'all-url': readBooleanFlag(flags, 'all-url'),
  'all-llm': readBooleanFlag(flags, 'all-llm'),
  'all-tts': readBooleanFlag(flags, 'all-tts'),
  'all-image': readBooleanFlag(flags, 'all-image'),
  'all-video': readBooleanFlag(flags, 'all-video'),
  'all-music': readBooleanFlag(flags, 'all-music')
})

export const expandAllShortcutModels = (
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

export const resolveStep2SelectionOrigins = (
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
