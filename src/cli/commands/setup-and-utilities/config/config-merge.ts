import type { AutoshowConfig } from '~/types'
import type { RepeatableModelFlag } from '~/types'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import {
  REPEATABLE_MODEL_FLAGS,
  normalizeModelFlagOccurrences,
  parseRepeatableModelFlagOccurrences
} from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import {
  getStep2ProviderEntry,
  getStep2ProviderConfigPathEntries,
  getStep2ProviderSelectionFlagNames,
  normalizeStep2ProviderFlagName
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'

const STT_PROVIDER_FLAGS = getStep2ProviderSelectionFlagNames('stt')
const OCR_PROVIDER_FLAGS = getStep2ProviderSelectionFlagNames('ocr')
const LLM_PROVIDER_FLAGS = ['llama', 'openai', 'groq', 'gemini', 'anthropic', 'minimax', 'grok'] as const
const TTS_PROVIDER_FLAGS = ['kitten-tts', 'elevenlabs-tts', 'minimax-tts', 'groq-tts', 'openai-tts', 'gemini-tts'] as const
const IMAGE_PROVIDER_FLAGS = ['gemini-image', 'openai-image', 'minimax-image'] as const
const VIDEO_PROVIDER_FLAGS = ['gemini-video', 'minimax-video'] as const
const MUSIC_PROVIDER_FLAGS = ['elevenlabs-music', 'minimax-music'] as const
const REPEATABLE_CONFIG_MODEL_FLAG_SET = new Set<string>(REPEATABLE_MODEL_FLAGS)
const STEP2_PROVIDER_CONFIG_PATHS = Object.fromEntries(
  getStep2ProviderConfigPathEntries({ includeAliases: true }).map(({ flagName, configPath }) => [flagName, [...configPath]])
) as Record<string, string[]>

const readNestedValue = (
  source: Record<string, unknown>,
  path: readonly string[]
): unknown => {
  let current: unknown = source
  for (const segment of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current) || !(segment in current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

const resolveStep2ProviderDefaults = (
  config: AutoshowConfig,
  step: 'stt' | 'ocr'
): [string, unknown][] =>
  getStep2ProviderSelectionFlagNames(step).map((flagName) => [
    flagName,
    STEP2_PROVIDER_CONFIG_PATHS[flagName]
      ? readNestedValue(config as unknown as Record<string, unknown>, STEP2_PROVIDER_CONFIG_PATHS[flagName] as string[])
      : undefined
  ])

export const extractExplicitFlags = (argv: string[]): Set<string> => {
  const explicit = new Set<string>()
  for (const token of argv) {
    if (!token.startsWith('--')) continue
    const withoutDashes = token.slice(2)
    const eqIdx = withoutDashes.indexOf('=')
    const key = normalizeStep2ProviderFlagName(eqIdx === -1 ? withoutDashes : withoutDashes.slice(0, eqIdx))
    if (!key) continue
    explicit.add(key)
    if (key.startsWith('no-') && key.length > 3) {
      explicit.add(normalizeStep2ProviderFlagName(key.slice(3)))
    }
  }
  return explicit
}

export const mergeConfigIntoRawFlags = (
  rawFlags: Record<string, unknown>,
  config: AutoshowConfig,
  explicitFlags: Set<string>
): Record<string, unknown> => {
  const merged: Record<string, unknown> = { ...rawFlags }
  const d = config.defaults
  if (!d) return merged

  const hasExplicitFlagInGroup = (group: readonly string[]): boolean => group.some(flag => explicitFlags.has(flag))

  const inject = (flagName: string, value: unknown): void => {
    if (value === undefined || explicitFlags.has(flagName)) return
    merged[flagName] = typeof value === 'number' ? String(value) : value
  }

  const injectProviderGroup = (group: readonly string[], entries: [string, unknown][]): void => {
    if (hasExplicitFlagInGroup(group)) return
    for (const [flag, val] of entries) inject(flag, val)
  }

  if (d.extract?.stt) {
    inject('youtube-captions', d.extract.stt.youtubeCaptions)
    injectProviderGroup(STT_PROVIDER_FLAGS, resolveStep2ProviderDefaults(config, 'stt'))
    inject('happyscribe-organization-id', d.extract.stt.happyscribeOrganizationId)
    inject('supadata-lang', d.extract.stt.supadataLang)
    inject('aws-region', d.extract.stt.awsRegion)
    inject('aws-bucket', d.extract.stt.awsBucket)
    inject('speaker-count', d.extract.stt.speakerCount)
    inject('split', d.extract.stt.split)
    inject('reverb-verbatimicity', d.extract.stt.reverbVerbatimicity)
    inject('stt-provider-concurrency', d.extract.stt.providerConcurrency)
    inject('stt-local-concurrency', d.extract.stt.localConcurrency)
    inject('stt-segment-concurrency', d.extract.stt.segmentConcurrency)
    inject('stt-preflight-concurrency', d.extract.stt.preflightConcurrency)
    inject('refresh-cache', d.extract.stt.refreshCache)
    inject('no-cache', d.extract.stt.noCache)
  }

  if (d.llm) {
    injectProviderGroup(LLM_PROVIDER_FLAGS, [
      ['llama', d.llm.llama], ['openai', d.llm.openai], ['groq', d.llm.groq],
      ['gemini', d.llm.gemini], ['anthropic', d.llm.anthropic], ['minimax', d.llm.minimax],
      ['grok', d.llm.grok],
    ])
  }

  if (d.post?.tts) {
    injectProviderGroup(TTS_PROVIDER_FLAGS, [
      ['kitten-tts', d.post.tts.kittenTts], ['elevenlabs-tts', d.post.tts.elevenlabsTts],
      ['minimax-tts', d.post.tts.minimaxTts], ['groq-tts', d.post.tts.groqTts],
      ['openai-tts', d.post.tts.openaiTts], ['gemini-tts', d.post.tts.geminiTts],
    ])
    inject('kitten-voice', d.post.tts.ttsSpeaker)
    inject('groq-voice', d.post.tts.groqVoice)
    inject('openai-voice', d.post.tts.openaiVoice)
    inject('gemini-voice', d.post.tts.geminiVoice)
    inject('gemini-speaker-1-name', d.post.tts.geminiSpeaker1Name)
    inject('gemini-speaker-1-voice', d.post.tts.geminiSpeaker1Voice)
    inject('gemini-speaker-2-name', d.post.tts.geminiSpeaker2Name)
    inject('gemini-speaker-2-voice', d.post.tts.geminiSpeaker2Voice)
    inject('elevenlabs-voice', d.post.tts.elevenlabsVoice)
    inject('minimax-tts-voice', d.post.tts.minimaxTtsVoice)
  }

  if (d.post?.image) {
    injectProviderGroup(IMAGE_PROVIDER_FLAGS, [
      ['gemini-image', d.post.image.geminiImage], ['openai-image', d.post.image.openaiImage],
      ['minimax-image', d.post.image.minimaxImage],
    ])
    inject('image-aspect-ratio', d.post.image.imageAspectRatio)
    inject('image-size', d.post.image.imageSize)
    inject('image-quality', d.post.image.imageQuality)
    inject('image-format', d.post.image.imageFormat)
    inject('image-background', d.post.image.imageBackground)
    inject('imagen-count', d.post.image.imagenCount)
  }

  if (d.post?.video) {
    injectProviderGroup(VIDEO_PROVIDER_FLAGS, [
      ['gemini-video', d.post.video.geminiVideo], ['minimax-video', d.post.video.minimaxVideo],
    ])
    inject('video-duration', d.post.video.videoDuration)
    inject('video-size', d.post.video.videoSize)
    inject('video-aspect-ratio', d.post.video.videoAspectRatio)
    inject('video-resolution', d.post.video.videoResolution)
  }

  if (d.post?.music) {
    injectProviderGroup(MUSIC_PROVIDER_FLAGS, [
      ['elevenlabs-music', d.post.music.elevenlabsMusic], ['minimax-music', d.post.music.minimaxMusic],
    ])
    inject('music-duration', d.post.music.musicDuration)
  }

  if (d.extract?.ocr) {
    inject('lang', d.extract.ocr.lang)
    inject('out', d.extract.ocr.out)
    injectProviderGroup(OCR_PROVIDER_FLAGS, resolveStep2ProviderDefaults(config, 'ocr'))
    inject('dpi', d.extract.ocr.dpi)
    inject('psm', d.extract.ocr.psm)
    inject('oem', d.extract.ocr.oem)
    inject('rotate', d.extract.ocr.rotate)
    inject('page-separator', d.extract.ocr.pageSeparator)
    inject('preserve-spaces', d.extract.ocr.preserveSpaces)
    inject('chapters', d.extract.ocr.chapters)
    inject('length', d.extract.ocr.length)
    inject('pdf-chapter-mode', d.extract.ocr.pdfChapterMode)
  }

  if (d.batch) {
    inject('batch-limit', d.batch.limit)
    inject('batch-order', d.batch.order)
    inject('batch-concurrency', d.batch.concurrency)
  }

  if (d.prompts && d.prompts.length > 0 && !explicitFlags.has('prompt')) {
    merged['prompt'] = d.prompts
  }

  return merged
}

const FLAG_TO_CONFIG_PATH: Record<string, string[]> = {
  ...STEP2_PROVIDER_CONFIG_PATHS,
  'youtube-captions':  ['defaults', 'extract', 'stt', 'youtubeCaptions'],
  'happyscribe-organization-id': ['defaults', 'extract', 'stt', 'happyscribeOrganizationId'],
  'supadata-lang':     ['defaults', 'extract', 'stt', 'supadataLang'],
  'aws-region':        ['defaults', 'extract', 'stt', 'awsRegion'],
  'aws-bucket':        ['defaults', 'extract', 'stt', 'awsBucket'],
  'speaker-count':     ['defaults', 'extract', 'stt', 'speakerCount'],
  'split':             ['defaults', 'extract', 'stt', 'split'],
  'reverb-verbatimicity': ['defaults', 'extract', 'stt', 'reverbVerbatimicity'],
  'stt-provider-concurrency': ['defaults', 'extract', 'stt', 'providerConcurrency'],
  'stt-local-concurrency': ['defaults', 'extract', 'stt', 'localConcurrency'],
  'stt-segment-concurrency': ['defaults', 'extract', 'stt', 'segmentConcurrency'],
  'stt-preflight-concurrency': ['defaults', 'extract', 'stt', 'preflightConcurrency'],
  'refresh-cache':     ['defaults', 'extract', 'stt', 'refreshCache'],
  'no-cache':          ['defaults', 'extract', 'stt', 'noCache'],
  'llama':             ['defaults', 'llm', 'llama'],
  'openai':            ['defaults', 'llm', 'openai'],
  'groq':              ['defaults', 'llm', 'groq'],
  'gemini':            ['defaults', 'llm', 'gemini'],
  'anthropic':         ['defaults', 'llm', 'anthropic'],
  'minimax':           ['defaults', 'llm', 'minimax'],
  'grok':              ['defaults', 'llm', 'grok'],
  'kitten-tts':        ['defaults', 'post', 'tts', 'kittenTts'],
  'elevenlabs-tts':    ['defaults', 'post', 'tts', 'elevenlabsTts'],
  'minimax-tts':       ['defaults', 'post', 'tts', 'minimaxTts'],
  'groq-tts':          ['defaults', 'post', 'tts', 'groqTts'],
  'openai-tts':        ['defaults', 'post', 'tts', 'openaiTts'],
  'gemini-tts':        ['defaults', 'post', 'tts', 'geminiTts'],
  'kitten-voice':      ['defaults', 'post', 'tts', 'ttsSpeaker'],
  'groq-voice':        ['defaults', 'post', 'tts', 'groqVoice'],
  'openai-voice':      ['defaults', 'post', 'tts', 'openaiVoice'],
  'gemini-voice':      ['defaults', 'post', 'tts', 'geminiVoice'],
  'gemini-speaker-1-name': ['defaults', 'post', 'tts', 'geminiSpeaker1Name'],
  'gemini-speaker-1-voice': ['defaults', 'post', 'tts', 'geminiSpeaker1Voice'],
  'gemini-speaker-2-name': ['defaults', 'post', 'tts', 'geminiSpeaker2Name'],
  'gemini-speaker-2-voice': ['defaults', 'post', 'tts', 'geminiSpeaker2Voice'],
  'elevenlabs-voice':  ['defaults', 'post', 'tts', 'elevenlabsVoice'],
  'minimax-tts-voice': ['defaults', 'post', 'tts', 'minimaxTtsVoice'],
  'gemini-image':      ['defaults', 'post', 'image', 'geminiImage'],
  'openai-image':      ['defaults', 'post', 'image', 'openaiImage'],
  'minimax-image':     ['defaults', 'post', 'image', 'minimaxImage'],
  'image-aspect-ratio': ['defaults', 'post', 'image', 'imageAspectRatio'],
  'image-size':        ['defaults', 'post', 'image', 'imageSize'],
  'image-quality':     ['defaults', 'post', 'image', 'imageQuality'],
  'image-format':      ['defaults', 'post', 'image', 'imageFormat'],
  'image-background':  ['defaults', 'post', 'image', 'imageBackground'],
  'imagen-count':      ['defaults', 'post', 'image', 'imagenCount'],
  'gemini-video':      ['defaults', 'post', 'video', 'geminiVideo'],
  'minimax-video':     ['defaults', 'post', 'video', 'minimaxVideo'],
  'video-duration':    ['defaults', 'post', 'video', 'videoDuration'],
  'video-size':        ['defaults', 'post', 'video', 'videoSize'],
  'video-aspect-ratio': ['defaults', 'post', 'video', 'videoAspectRatio'],
  'video-resolution':  ['defaults', 'post', 'video', 'videoResolution'],
  'elevenlabs-music':  ['defaults', 'post', 'music', 'elevenlabsMusic'],
  'minimax-music':     ['defaults', 'post', 'music', 'minimaxMusic'],
  'music-duration':    ['defaults', 'post', 'music', 'musicDuration'],
  'lang':              ['defaults', 'extract', 'ocr', 'lang'],
  'out':               ['defaults', 'extract', 'ocr', 'out'],
  'dpi':               ['defaults', 'extract', 'ocr', 'dpi'],
  'psm':               ['defaults', 'extract', 'ocr', 'psm'],
  'oem':               ['defaults', 'extract', 'ocr', 'oem'],
  'rotate':            ['defaults', 'extract', 'ocr', 'rotate'],
  'page-separator':    ['defaults', 'extract', 'ocr', 'pageSeparator'],
  'preserve-spaces':   ['defaults', 'extract', 'ocr', 'preserveSpaces'],
  'chapters':          ['defaults', 'extract', 'ocr', 'chapters'],
  'length':            ['defaults', 'extract', 'ocr', 'length'],
  'pdf-chapter-mode':  ['defaults', 'extract', 'ocr', 'pdfChapterMode'],
  'batch-limit':       ['defaults', 'batch', 'limit'],
  'batch-order':       ['defaults', 'batch', 'order'],
  'batch-concurrency': ['defaults', 'batch', 'concurrency'],
  'max-cents':         ['pricing', 'maxCents'],
}

const RUNTIME_ONLY_FLAGS = new Set(['price', 'allow-over-budget', 'show', 'reset', 'config-path', 'password'])

const setNestedValue = (obj: Record<string, unknown>, path: string[], value: unknown): void => {
  let current = obj
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i] as string
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }
  const lastKey = path[path.length - 1] as string
  current[lastKey] = value
}

const readConfigFlagValue = (
  flags: Record<string, unknown>,
  flagName: string
): unknown => {
  if (flagName in flags) {
    return flags[flagName]
  }

  const entry = getStep2ProviderEntry(flagName)
  if (!entry) {
    return undefined
  }

  for (const alias of entry.aliases) {
    if (alias in flags) {
      return flags[alias]
    }
  }

  return undefined
}

const parseConfigValue = (flagName: string, rawValue: unknown): unknown => {
  if (typeof rawValue !== 'string') return rawValue
  const numericFlags = new Set([
    'speaker-count', 'reverb-verbatimicity', 'imagen-count', 'video-duration',
    'music-duration', 'dpi', 'psm', 'oem', 'rotate', 'length', 'batch-limit', 'batch-concurrency',
    'max-cents',
    'stt-provider-concurrency', 'stt-local-concurrency', 'stt-segment-concurrency', 'stt-preflight-concurrency'
  ])
  if (numericFlags.has(flagName)) {
    const n = Number(rawValue)
    return Number.isFinite(n) ? n : rawValue
  }
  return rawValue
}

const resolveConfigFlagValue = (flagName: string, rawValue: unknown): unknown => {
  if (rawValue === true || rawValue === '') {
    const cheapestModel = resolveCheapestModelForFlag(flagName)
    if (cheapestModel !== undefined) {
      return cheapestModel
    }
  }

  return parseConfigValue(flagName, rawValue)
}

export const buildConfigPatchFromFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  rawArgs: string[] = []
): Record<string, unknown> => {
  const patch: Record<string, unknown> = { version: 2 }
  const rawOccurrences = parseRepeatableModelFlagOccurrences(rawArgs)

  for (const flagName of explicitFlags) {
    if (RUNTIME_ONLY_FLAGS.has(flagName)) continue
    const configPath = FLAG_TO_CONFIG_PATH[flagName]
    if (!configPath) continue
    let value: unknown

    if (REPEATABLE_CONFIG_MODEL_FLAG_SET.has(flagName)) {
      value = normalizeModelFlagOccurrences(flagName as RepeatableModelFlag, flags, rawOccurrences)
      if (!Array.isArray(value) || value.length === 0) {
        continue
      }
    } else {
      const rawValue = readConfigFlagValue(flags, flagName)
      if (rawValue === undefined) continue
      value = resolveConfigFlagValue(flagName, rawValue)
    }

    setNestedValue(patch, configPath, value)
  }

  if (explicitFlags.has('prompt') && !RUNTIME_ONLY_FLAGS.has('prompt')) {
    const promptVal = flags['prompt']
    if (Array.isArray(promptVal)) {
      setNestedValue(patch, ['defaults', 'prompts'], promptVal)
    } else if (typeof promptVal === 'string' && promptVal.length > 0) {
      setNestedValue(patch, ['defaults', 'prompts'], [promptVal])
    }
  }

  return patch
}

export const deepMergeConfig = (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value) &&
        typeof result[key] === 'object' && result[key] !== null && !Array.isArray(result[key])) {
      result[key] = deepMergeConfig(result[key] as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result
}
