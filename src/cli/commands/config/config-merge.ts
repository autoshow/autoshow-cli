import type { AutoshowConfig } from '~/types'
import { CLIUsageError } from '~/utils/error-handler'

const STT_PROVIDER_FLAGS = ['groq-stt', 'elevenlabs-stt', 'openai-stt', 'mistral-stt', 'assemblyai-stt'] as const
const LLM_PROVIDER_FLAGS = ['llama', 'openai', 'groq', 'gemini', 'anthropic', 'minimax'] as const
const TTS_PROVIDER_FLAGS = ['kitten-tts', 'elevenlabs-tts', 'minimax-tts', 'groq-tts', 'openai-tts', 'gemini-tts'] as const
const IMAGE_PROVIDER_FLAGS = ['gemini-image', 'openai-image', 'minimax-image'] as const
const VIDEO_PROVIDER_FLAGS = ['gemini-video', 'minimax-video'] as const
const MUSIC_PROVIDER_FLAGS = ['elevenlabs-music', 'minimax-music'] as const

export const extractExplicitFlags = (argv: string[]): Set<string> => {
  const explicit = new Set<string>()
  for (const token of argv) {
    if (!token.startsWith('--')) continue
    const withoutDashes = token.slice(2)
    const eqIdx = withoutDashes.indexOf('=')
    const key = eqIdx === -1 ? withoutDashes : withoutDashes.slice(0, eqIdx)
    if (!key) continue
    explicit.add(key)
    if (key.startsWith('no-') && key.length > 3) {
      explicit.add(key.slice(3))
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

  if (d.stt) {
    inject('whisper', d.stt.whisper)
    injectProviderGroup(STT_PROVIDER_FLAGS, [
      ['groq-stt', d.stt.groqStt], ['elevenlabs-stt', d.stt.elevenlabsStt],
      ['openai-stt', d.stt.openaiStt], ['mistral-stt', d.stt.mistralStt],
      ['assemblyai-stt', d.stt.assemblyaiStt],
    ])
    inject('speaker-count', d.stt.speakerCount)
    inject('split', d.stt.split)
    inject('reverb-verbatimicity', d.stt.reverbVerbatimicity)
  }

  if (d.llm) {
    injectProviderGroup(LLM_PROVIDER_FLAGS, [
      ['llama', d.llm.llama], ['openai', d.llm.openai], ['groq', d.llm.groq],
      ['gemini', d.llm.gemini], ['anthropic', d.llm.anthropic], ['minimax', d.llm.minimax],
    ])
    inject('structured', d.llm.structured)
    inject('structured-strict', d.llm.structuredStrict)
    inject('structured-compat-retries', d.llm.structuredCompatRetries)
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

  if (d.extract) {
    inject('lang', d.extract.lang)
    inject('out', d.extract.out)
    inject('dpi', d.extract.dpi)
    inject('psm', d.extract.psm)
    inject('oem', d.extract.oem)
    inject('rotate', d.extract.rotate)
    inject('mistral-ocr', d.extract.mistralOcr)
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
  'whisper':           ['defaults', 'stt', 'whisper'],
  'groq-stt':          ['defaults', 'stt', 'groqStt'],
  'elevenlabs-stt':    ['defaults', 'stt', 'elevenlabsStt'],
  'openai-stt':        ['defaults', 'stt', 'openaiStt'],
  'mistral-stt':       ['defaults', 'stt', 'mistralStt'],
  'assemblyai-stt':    ['defaults', 'stt', 'assemblyaiStt'],
  'speaker-count':     ['defaults', 'stt', 'speakerCount'],
  'split':             ['defaults', 'stt', 'split'],
  'reverb-verbatimicity': ['defaults', 'stt', 'reverbVerbatimicity'],
  'llama':             ['defaults', 'llm', 'llama'],
  'openai':            ['defaults', 'llm', 'openai'],
  'groq':              ['defaults', 'llm', 'groq'],
  'gemini':            ['defaults', 'llm', 'gemini'],
  'anthropic':         ['defaults', 'llm', 'anthropic'],
  'minimax':           ['defaults', 'llm', 'minimax'],
  'structured':        ['defaults', 'llm', 'structured'],
  'structured-strict': ['defaults', 'llm', 'structuredStrict'],
  'structured-compat-retries': ['defaults', 'llm', 'structuredCompatRetries'],
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
  'lang':              ['defaults', 'extract', 'lang'],
  'out':               ['defaults', 'extract', 'out'],
  'dpi':               ['defaults', 'extract', 'dpi'],
  'psm':               ['defaults', 'extract', 'psm'],
  'oem':               ['defaults', 'extract', 'oem'],
  'rotate':            ['defaults', 'extract', 'rotate'],
  'mistral-ocr':       ['defaults', 'extract', 'mistralOcr'],
  'batch-limit':       ['defaults', 'batch', 'limit'],
  'batch-order':       ['defaults', 'batch', 'order'],
  'batch-concurrency': ['defaults', 'batch', 'concurrency'],
  'max-cents':         ['pricing', 'maxCents'],
  'max-usd':           ['pricing', 'maxUsd']
}

const RUNTIME_ONLY_FLAGS = new Set(['price', 'allow-over-budget', 'show', 'reset', 'config-path'])

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

const parseConfigValue = (flagName: string, rawValue: unknown): unknown => {
  if (typeof rawValue !== 'string') return rawValue
  const numericFlags = new Set([
    'speaker-count', 'reverb-verbatimicity', 'imagen-count', 'video-duration',
    'music-duration', 'dpi', 'psm', 'oem', 'rotate', 'batch-limit', 'batch-concurrency',
    'max-cents', 'max-usd', 'structured-compat-retries'
  ])
  if (numericFlags.has(flagName)) {
    const n = Number(rawValue)
    return Number.isFinite(n) ? n : rawValue
  }
  return rawValue
}

export const buildConfigPatchFromFlags = (
  flags: Record<string, unknown>,
  explicitFlags: Set<string>
): Record<string, unknown> => {
  const patch: Record<string, unknown> = {}

  if (explicitFlags.has('json-output') && explicitFlags.has('md-output')) {
    throw CLIUsageError('Cannot use both --json-output and --md-output at the same time.')
  }

  if (explicitFlags.has('json-output')) {
    setNestedValue(patch, ['defaults', 'llm', 'structured'], true)
  } else if (explicitFlags.has('md-output')) {
    setNestedValue(patch, ['defaults', 'llm', 'structured'], false)
  }

  for (const flagName of explicitFlags) {
    if (RUNTIME_ONLY_FLAGS.has(flagName)) continue
    if (flagName === 'json-output' || flagName === 'md-output') continue
    const configPath = FLAG_TO_CONFIG_PATH[flagName]
    if (!configPath) continue
    const rawValue = flags[flagName]
    if (rawValue === undefined) continue
    const value = parseConfigValue(flagName, rawValue)
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
