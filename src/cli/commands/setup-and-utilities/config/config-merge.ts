import type { AutoshowConfig } from '~/types'
import type { RepeatableModelFlag } from '~/types'
import { resolveCheapestModelForFlag } from '~/cli/commands/setup-and-utilities/models/cheapest-models'
import {
  REPEATABLE_MODEL_FLAGS,
  normalizeModelFlagOccurrences,
  parseRepeatableModelFlagOccurrences
} from '~/cli/commands/process-steps/step-1-download/targets/build-opts-from-flags'
import {
  getStep2ProviderConfigPathEntries,
  getStep2ProviderSelectionFlagNames
} from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'

const STT_PROVIDER_FLAGS = getStep2ProviderSelectionFlagNames('stt')
const OCR_PROVIDER_FLAGS = getStep2ProviderSelectionFlagNames('ocr')
const LLM_PROVIDER_FLAGS = ['llama', 'openai', 'groq', 'gemini', 'anthropic', 'minimax', 'grok', 'glm', 'kimi'] as const
const TTS_PROVIDER_FLAGS = ['kitten-tts', 'elevenlabs-tts', 'minimax-tts', 'groq-tts', 'grok-tts', 'mistral-tts', 'openai-tts', 'gemini-tts', 'deepgram-tts', 'speechify-tts', 'gcloud-tts', 'deapi-tts'] as const
const IMAGE_PROVIDER_FLAGS = ['gemini-image', 'openai-image', 'minimax-image', 'glm-image', 'grok-image', 'runway-image', 'bfl-image', 'deapi-image'] as const
const VIDEO_PROVIDER_FLAGS = ['gemini-video', 'minimax-video', 'glm-video', 'grok-video', 'runway-video', 'deapi-video'] as const
const MUSIC_PROVIDER_FLAGS = ['elevenlabs-music', 'minimax-music', 'deapi-music', 'gemini-music'] as const
const REPEATABLE_CONFIG_MODEL_FLAG_SET = new Set<string>(REPEATABLE_MODEL_FLAGS)
const CONFIG_INJECTED_FLAGS_KEY = '__autoshowConfigInjectedFlags'
const STEP2_PROVIDER_CONFIG_PATHS = Object.fromEntries(
  getStep2ProviderConfigPathEntries().map(({ flagName, configPath }) => [flagName, [...configPath]])
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
    if (token === '--') break
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
  const injectedFlags = new Set<string>()
  const d = config.defaults
  if (!d) return merged

  const hasExplicitFlagInGroup = (group: readonly string[]): boolean => group.some(flag => explicitFlags.has(flag))

  const inject = (flagName: string, value: unknown): void => {
    if (value === undefined || explicitFlags.has(flagName)) return
    merged[flagName] = typeof value === 'number' ? String(value) : value
    injectedFlags.add(flagName)
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
    inject('scrapecreators-lang', d.extract.stt.scrapecreatorsLang)
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
      ['grok', d.llm.grok], ['glm', d.llm.glm], ['kimi', d.llm.kimi],
    ])
    inject('llm-provider-concurrency', d.llm.providerConcurrency)
    inject('llm-local-concurrency', d.llm.localConcurrency)
  }

  if (d.post?.tts) {
    injectProviderGroup(TTS_PROVIDER_FLAGS, [
      ['kitten-tts', d.post.tts.kittenTts], ['elevenlabs-tts', d.post.tts.elevenlabsTts],
      ['minimax-tts', d.post.tts.minimaxTts], ['groq-tts', d.post.tts.groqTts],
      ['grok-tts', d.post.tts.grokTts], ['mistral-tts', d.post.tts.mistralTts],
      ['openai-tts', d.post.tts.openaiTts], ['gemini-tts', d.post.tts.geminiTts],
      ['deepgram-tts', d.post.tts.deepgramTts],
      ['speechify-tts', d.post.tts.speechifyTts], ['gcloud-tts', d.post.tts.gcloudTts],
      ['deapi-tts', d.post.tts.deapiTts],
    ])
    inject('kitten-voice', d.post.tts.ttsSpeaker)
    inject('groq-voice', d.post.tts.groqVoice)
    inject('grok-tts-voice', d.post.tts.grokTtsVoice)
    inject('grok-tts-language', d.post.tts.grokTtsLanguage)
    inject('grok-tts-text-normalization', d.post.tts.grokTtsTextNormalization)
    inject('mistral-tts-voice', d.post.tts.mistralTtsVoice)
    inject('mistral-tts-ref-audio', d.post.tts.mistralTtsRefAudio)
    inject('mistral-tts-voice-name', d.post.tts.mistralTtsVoiceName)
    inject('tts-dialogue-format', d.post.tts.ttsDialogueFormat)
    inject('tts-speaker-ref-audio', d.post.tts.ttsSpeakerRefAudio)
    inject('openai-voice', d.post.tts.openaiVoice)
    inject('openai-tts-instructions', d.post.tts.openaiTtsInstructions)
    inject('openai-tts-speed', d.post.tts.openaiTtsSpeed)
    inject('openai-tts-ref-audio', d.post.tts.openaiTtsRefAudio)
    inject('openai-tts-consent-id', d.post.tts.openaiTtsConsentId)
    inject('openai-tts-consent-audio', d.post.tts.openaiTtsConsentAudio)
    inject('openai-tts-consent-language', d.post.tts.openaiTtsConsentLanguage)
    inject('openai-tts-consent-name', d.post.tts.openaiTtsConsentName)
    inject('openai-tts-voice-name', d.post.tts.openaiTtsVoiceName)
    inject('gemini-voice', d.post.tts.geminiVoice)
    inject('deepgram-tts-encoding', d.post.tts.deepgramTtsEncoding)
    inject('deepgram-tts-container', d.post.tts.deepgramTtsContainer)
    inject('deepgram-tts-bit-rate', d.post.tts.deepgramTtsBitRate)
    inject('deepgram-tts-sample-rate', d.post.tts.deepgramTtsSampleRate)
    inject('deepgram-tts-speed', d.post.tts.deepgramTtsSpeed)
    inject('gemini-speaker-1-name', d.post.tts.geminiSpeaker1Name)
    inject('gemini-speaker-1-voice', d.post.tts.geminiSpeaker1Voice)
    inject('gemini-speaker-2-name', d.post.tts.geminiSpeaker2Name)
    inject('gemini-speaker-2-voice', d.post.tts.geminiSpeaker2Voice)
    inject('elevenlabs-voice', d.post.tts.elevenlabsVoice)
    inject('elevenlabs-tts-pvc-voice', d.post.tts.elevenlabsTtsPvcVoice)
    inject('elevenlabs-tts-ref-audio', d.post.tts.elevenlabsTtsRefAudio)
    inject('elevenlabs-tts-voice-name', d.post.tts.elevenlabsTtsVoiceName)
    inject('elevenlabs-tts-clone-remove-background-noise', d.post.tts.elevenlabsTtsCloneRemoveBackgroundNoise)
    inject('elevenlabs-tts-output-format', d.post.tts.elevenlabsTtsOutputFormat)
    inject('elevenlabs-tts-language-code', d.post.tts.elevenlabsTtsLanguageCode)
    inject('elevenlabs-tts-stability', d.post.tts.elevenlabsTtsStability)
    inject('elevenlabs-tts-similarity-boost', d.post.tts.elevenlabsTtsSimilarityBoost)
    inject('elevenlabs-tts-style', d.post.tts.elevenlabsTtsStyle)
    inject('elevenlabs-tts-use-speaker-boost', d.post.tts.elevenlabsTtsUseSpeakerBoost)
    inject('elevenlabs-tts-speed', d.post.tts.elevenlabsTtsSpeed)
    inject('elevenlabs-tts-seed', d.post.tts.elevenlabsTtsSeed)
    inject('elevenlabs-tts-text-normalization', d.post.tts.elevenlabsTtsTextNormalization)
    inject('elevenlabs-tts-pronunciation-dictionary-locator', d.post.tts.elevenlabsTtsPronunciationDictionaryLocators)
    inject('elevenlabs-tts-optimize-streaming-latency', d.post.tts.elevenlabsTtsOptimizeStreamingLatency)
    inject('elevenlabs-tts-pvc-as-ivc', d.post.tts.elevenlabsTtsPvcAsIvc)
    inject('minimax-tts-voice', d.post.tts.minimaxTtsVoice)
    inject('minimax-tts-language-boost', d.post.tts.minimaxTtsLanguageBoost)
    inject('minimax-tts-speed', d.post.tts.minimaxTtsSpeed)
    inject('minimax-tts-volume', d.post.tts.minimaxTtsVolume)
    inject('minimax-tts-pitch', d.post.tts.minimaxTtsPitch)
    inject('minimax-tts-emotion', d.post.tts.minimaxTtsEmotion)
    inject('minimax-tts-english-normalization', d.post.tts.minimaxTtsEnglishNormalization)
    inject('minimax-tts-pronunciation', d.post.tts.minimaxTtsPronunciations)
    inject('deepgram-voice', d.post.tts.deepgramVoice)
    inject('speechify-voice', d.post.tts.speechifyVoice)
    inject('speechify-tts-audio-format', d.post.tts.speechifyTtsAudioFormat)
    inject('speechify-tts-language', d.post.tts.speechifyTtsLanguage)
    inject('gcloud-tts-voice', d.post.tts.gcloudTtsVoice)
    inject('gcloud-tts-language', d.post.tts.gcloudTtsLanguage)
    inject('gcloud-tts-ref-audio', d.post.tts.gcloudTtsRefAudio)
    inject('gcloud-tts-consent-audio', d.post.tts.gcloudTtsConsentAudio)
    inject('gcloud-tts-consent-language', d.post.tts.gcloudTtsConsentLanguage)
    inject('deapi-tts-voice', d.post.tts.deapiTtsVoice)
    inject('deapi-tts-ref-audio', d.post.tts.deapiTtsRefAudio)
    inject('deapi-tts-ref-text', d.post.tts.deapiTtsRefText)
    inject('deapi-tts-language', d.post.tts.deapiTtsLanguage)
    inject('deapi-tts-speed', d.post.tts.deapiTtsSpeed)
    inject('deapi-tts-format', d.post.tts.deapiTtsFormat)
    inject('deapi-tts-sample-rate', d.post.tts.deapiTtsSampleRate)
    inject('deapi-tts-instruction', d.post.tts.deapiTtsInstruction)
    inject('tts-provider-concurrency', d.post.tts.providerConcurrency)
    inject('tts-local-concurrency', d.post.tts.localConcurrency)
  }

  if (d.post?.image) {
    injectProviderGroup(IMAGE_PROVIDER_FLAGS, [
      ['gemini-image', d.post.image.geminiImage], ['openai-image', d.post.image.openaiImage],
      ['minimax-image', d.post.image.minimaxImage], ['glm-image', d.post.image.glmImage],
      ['grok-image', d.post.image.grokImage], ['runway-image', d.post.image.runwayImage],
      ['bfl-image', d.post.image.bflImage], ['deapi-image', d.post.image.deapiImage],
    ])
    inject('image-aspect-ratio', d.post.image.imageAspectRatio)
    inject('image-size', d.post.image.imageSize)
    inject('image-quality', d.post.image.imageQuality)
    inject('image-format', d.post.image.imageFormat)
    inject('image-background', d.post.image.imageBackground)
    inject('imagen-count', d.post.image.imagenCount)
    inject('image-provider-concurrency', d.post.image.providerConcurrency)
    inject('image-local-concurrency', d.post.image.localConcurrency)
  }

  if (d.post?.video) {
    injectProviderGroup(VIDEO_PROVIDER_FLAGS, [
      ['gemini-video', d.post.video.geminiVideo], ['minimax-video', d.post.video.minimaxVideo],
      ['glm-video', d.post.video.glmVideo], ['grok-video', d.post.video.grokVideo],
      ['runway-video', d.post.video.runwayVideo], ['deapi-video', d.post.video.deapiVideo],
    ])
    inject('video-duration', d.post.video.videoDuration)
    inject('video-size', d.post.video.videoSize)
    inject('video-aspect-ratio', d.post.video.videoAspectRatio)
    inject('video-resolution', d.post.video.videoResolution)
    inject('video-provider-concurrency', d.post.video.providerConcurrency)
    inject('video-local-concurrency', d.post.video.localConcurrency)
  }

  if (d.post?.music) {
    injectProviderGroup(MUSIC_PROVIDER_FLAGS, [
      ['elevenlabs-music', d.post.music.elevenlabsMusic], ['minimax-music', d.post.music.minimaxMusic],
      ['deapi-music', d.post.music.deapiMusic], ['gemini-music', d.post.music.geminiMusic],
    ])
    inject('music-duration', d.post.music.musicDuration)
    inject('music-provider-concurrency', d.post.music.providerConcurrency)
    inject('music-local-concurrency', d.post.music.localConcurrency)
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
    inject('ocr-provider-concurrency', d.extract.ocr.providerConcurrency)
    inject('ocr-local-concurrency', d.extract.ocr.localConcurrency)
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
    injectedFlags.add('prompt')
  }

  if (injectedFlags.size > 0) {
    merged[CONFIG_INJECTED_FLAGS_KEY] = [...injectedFlags]
  }

  return merged
}

const FLAG_TO_CONFIG_PATH: Record<string, string[]> = {
  ...STEP2_PROVIDER_CONFIG_PATHS,
  'youtube-captions':  ['defaults', 'extract', 'stt', 'youtubeCaptions'],
  'happyscribe-organization-id': ['defaults', 'extract', 'stt', 'happyscribeOrganizationId'],
  'supadata-lang':     ['defaults', 'extract', 'stt', 'supadataLang'],
  'scrapecreators-lang': ['defaults', 'extract', 'stt', 'scrapecreatorsLang'],
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
  'glm':               ['defaults', 'llm', 'glm'],
  'kimi':              ['defaults', 'llm', 'kimi'],
  'llm-provider-concurrency': ['defaults', 'llm', 'providerConcurrency'],
  'llm-local-concurrency': ['defaults', 'llm', 'localConcurrency'],
  'kitten-tts':        ['defaults', 'post', 'tts', 'kittenTts'],
  'elevenlabs-tts':    ['defaults', 'post', 'tts', 'elevenlabsTts'],
  'minimax-tts':       ['defaults', 'post', 'tts', 'minimaxTts'],
  'groq-tts':          ['defaults', 'post', 'tts', 'groqTts'],
  'grok-tts':          ['defaults', 'post', 'tts', 'grokTts'],
  'mistral-tts':       ['defaults', 'post', 'tts', 'mistralTts'],
  'openai-tts':        ['defaults', 'post', 'tts', 'openaiTts'],
  'gemini-tts':        ['defaults', 'post', 'tts', 'geminiTts'],
  'deepgram-tts':      ['defaults', 'post', 'tts', 'deepgramTts'],
  'speechify-tts':     ['defaults', 'post', 'tts', 'speechifyTts'],
  'gcloud-tts':        ['defaults', 'post', 'tts', 'gcloudTts'],
  'deapi-tts':         ['defaults', 'post', 'tts', 'deapiTts'],
  'kitten-voice':      ['defaults', 'post', 'tts', 'ttsSpeaker'],
  'groq-voice':        ['defaults', 'post', 'tts', 'groqVoice'],
  'grok-tts-voice':    ['defaults', 'post', 'tts', 'grokTtsVoice'],
  'grok-tts-language': ['defaults', 'post', 'tts', 'grokTtsLanguage'],
  'grok-tts-text-normalization': ['defaults', 'post', 'tts', 'grokTtsTextNormalization'],
  'mistral-tts-voice': ['defaults', 'post', 'tts', 'mistralTtsVoice'],
  'mistral-tts-ref-audio': ['defaults', 'post', 'tts', 'mistralTtsRefAudio'],
  'mistral-tts-voice-name': ['defaults', 'post', 'tts', 'mistralTtsVoiceName'],
  'tts-dialogue-format': ['defaults', 'post', 'tts', 'ttsDialogueFormat'],
  'tts-speaker-ref-audio': ['defaults', 'post', 'tts', 'ttsSpeakerRefAudio'],
  'openai-voice':      ['defaults', 'post', 'tts', 'openaiVoice'],
  'openai-tts-instructions': ['defaults', 'post', 'tts', 'openaiTtsInstructions'],
  'openai-tts-speed': ['defaults', 'post', 'tts', 'openaiTtsSpeed'],
  'openai-tts-ref-audio': ['defaults', 'post', 'tts', 'openaiTtsRefAudio'],
  'openai-tts-consent-id': ['defaults', 'post', 'tts', 'openaiTtsConsentId'],
  'openai-tts-consent-audio': ['defaults', 'post', 'tts', 'openaiTtsConsentAudio'],
  'openai-tts-consent-language': ['defaults', 'post', 'tts', 'openaiTtsConsentLanguage'],
  'openai-tts-consent-name': ['defaults', 'post', 'tts', 'openaiTtsConsentName'],
  'openai-tts-voice-name': ['defaults', 'post', 'tts', 'openaiTtsVoiceName'],
  'gemini-voice':      ['defaults', 'post', 'tts', 'geminiVoice'],
  'deepgram-tts-encoding': ['defaults', 'post', 'tts', 'deepgramTtsEncoding'],
  'deepgram-tts-container': ['defaults', 'post', 'tts', 'deepgramTtsContainer'],
  'deepgram-tts-bit-rate': ['defaults', 'post', 'tts', 'deepgramTtsBitRate'],
  'deepgram-tts-sample-rate': ['defaults', 'post', 'tts', 'deepgramTtsSampleRate'],
  'deepgram-tts-speed': ['defaults', 'post', 'tts', 'deepgramTtsSpeed'],
  'gemini-speaker-1-name': ['defaults', 'post', 'tts', 'geminiSpeaker1Name'],
  'gemini-speaker-1-voice': ['defaults', 'post', 'tts', 'geminiSpeaker1Voice'],
  'gemini-speaker-2-name': ['defaults', 'post', 'tts', 'geminiSpeaker2Name'],
  'gemini-speaker-2-voice': ['defaults', 'post', 'tts', 'geminiSpeaker2Voice'],
  'elevenlabs-voice':  ['defaults', 'post', 'tts', 'elevenlabsVoice'],
  'elevenlabs-tts-pvc-voice': ['defaults', 'post', 'tts', 'elevenlabsTtsPvcVoice'],
  'elevenlabs-tts-ref-audio': ['defaults', 'post', 'tts', 'elevenlabsTtsRefAudio'],
  'elevenlabs-tts-voice-name': ['defaults', 'post', 'tts', 'elevenlabsTtsVoiceName'],
  'elevenlabs-tts-clone-remove-background-noise': ['defaults', 'post', 'tts', 'elevenlabsTtsCloneRemoveBackgroundNoise'],
  'elevenlabs-tts-output-format': ['defaults', 'post', 'tts', 'elevenlabsTtsOutputFormat'],
  'elevenlabs-tts-language-code': ['defaults', 'post', 'tts', 'elevenlabsTtsLanguageCode'],
  'elevenlabs-tts-stability': ['defaults', 'post', 'tts', 'elevenlabsTtsStability'],
  'elevenlabs-tts-similarity-boost': ['defaults', 'post', 'tts', 'elevenlabsTtsSimilarityBoost'],
  'elevenlabs-tts-style': ['defaults', 'post', 'tts', 'elevenlabsTtsStyle'],
  'elevenlabs-tts-use-speaker-boost': ['defaults', 'post', 'tts', 'elevenlabsTtsUseSpeakerBoost'],
  'elevenlabs-tts-speed': ['defaults', 'post', 'tts', 'elevenlabsTtsSpeed'],
  'elevenlabs-tts-seed': ['defaults', 'post', 'tts', 'elevenlabsTtsSeed'],
  'elevenlabs-tts-text-normalization': ['defaults', 'post', 'tts', 'elevenlabsTtsTextNormalization'],
  'elevenlabs-tts-pronunciation-dictionary-locator': ['defaults', 'post', 'tts', 'elevenlabsTtsPronunciationDictionaryLocators'],
  'elevenlabs-tts-optimize-streaming-latency': ['defaults', 'post', 'tts', 'elevenlabsTtsOptimizeStreamingLatency'],
  'elevenlabs-tts-pvc-as-ivc': ['defaults', 'post', 'tts', 'elevenlabsTtsPvcAsIvc'],
  'minimax-tts-voice': ['defaults', 'post', 'tts', 'minimaxTtsVoice'],
  'minimax-tts-ref-audio': ['defaults', 'post', 'tts', 'minimaxTtsRefAudio'],
  'minimax-tts-prompt-audio': ['defaults', 'post', 'tts', 'minimaxTtsPromptAudio'],
  'minimax-tts-prompt-text': ['defaults', 'post', 'tts', 'minimaxTtsPromptText'],
  'minimax-tts-clone-noise-reduction': ['defaults', 'post', 'tts', 'minimaxTtsCloneNoiseReduction'],
  'minimax-tts-clone-volume-normalization': ['defaults', 'post', 'tts', 'minimaxTtsCloneVolumeNormalization'],
  'minimax-tts-language-boost': ['defaults', 'post', 'tts', 'minimaxTtsLanguageBoost'],
  'minimax-tts-speed': ['defaults', 'post', 'tts', 'minimaxTtsSpeed'],
  'minimax-tts-volume': ['defaults', 'post', 'tts', 'minimaxTtsVolume'],
  'minimax-tts-pitch': ['defaults', 'post', 'tts', 'minimaxTtsPitch'],
  'minimax-tts-emotion': ['defaults', 'post', 'tts', 'minimaxTtsEmotion'],
  'minimax-tts-english-normalization': ['defaults', 'post', 'tts', 'minimaxTtsEnglishNormalization'],
  'minimax-tts-pronunciation': ['defaults', 'post', 'tts', 'minimaxTtsPronunciations'],
  'deepgram-voice':    ['defaults', 'post', 'tts', 'deepgramVoice'],
  'speechify-voice':   ['defaults', 'post', 'tts', 'speechifyVoice'],
  'speechify-tts-audio-format': ['defaults', 'post', 'tts', 'speechifyTtsAudioFormat'],
  'speechify-tts-language': ['defaults', 'post', 'tts', 'speechifyTtsLanguage'],
  'gcloud-tts-voice':  ['defaults', 'post', 'tts', 'gcloudTtsVoice'],
  'gcloud-tts-language': ['defaults', 'post', 'tts', 'gcloudTtsLanguage'],
  'gcloud-tts-ref-audio': ['defaults', 'post', 'tts', 'gcloudTtsRefAudio'],
  'gcloud-tts-consent-audio': ['defaults', 'post', 'tts', 'gcloudTtsConsentAudio'],
  'gcloud-tts-consent-language': ['defaults', 'post', 'tts', 'gcloudTtsConsentLanguage'],
  'deapi-tts-voice':   ['defaults', 'post', 'tts', 'deapiTtsVoice'],
  'deapi-tts-ref-audio': ['defaults', 'post', 'tts', 'deapiTtsRefAudio'],
  'deapi-tts-ref-text': ['defaults', 'post', 'tts', 'deapiTtsRefText'],
  'deapi-tts-language': ['defaults', 'post', 'tts', 'deapiTtsLanguage'],
  'deapi-tts-speed': ['defaults', 'post', 'tts', 'deapiTtsSpeed'],
  'deapi-tts-format': ['defaults', 'post', 'tts', 'deapiTtsFormat'],
  'deapi-tts-sample-rate': ['defaults', 'post', 'tts', 'deapiTtsSampleRate'],
  'deapi-tts-instruction': ['defaults', 'post', 'tts', 'deapiTtsInstruction'],
  'tts-provider-concurrency': ['defaults', 'post', 'tts', 'providerConcurrency'],
  'tts-local-concurrency': ['defaults', 'post', 'tts', 'localConcurrency'],
  'gemini-image':      ['defaults', 'post', 'image', 'geminiImage'],
  'openai-image':      ['defaults', 'post', 'image', 'openaiImage'],
  'minimax-image':     ['defaults', 'post', 'image', 'minimaxImage'],
  'glm-image':         ['defaults', 'post', 'image', 'glmImage'],
  'grok-image':        ['defaults', 'post', 'image', 'grokImage'],
  'runway-image':      ['defaults', 'post', 'image', 'runwayImage'],
  'bfl-image':         ['defaults', 'post', 'image', 'bflImage'],
  'deapi-image':       ['defaults', 'post', 'image', 'deapiImage'],
  'image-aspect-ratio': ['defaults', 'post', 'image', 'imageAspectRatio'],
  'image-size':        ['defaults', 'post', 'image', 'imageSize'],
  'image-quality':     ['defaults', 'post', 'image', 'imageQuality'],
  'image-format':      ['defaults', 'post', 'image', 'imageFormat'],
  'image-background':  ['defaults', 'post', 'image', 'imageBackground'],
  'imagen-count':      ['defaults', 'post', 'image', 'imagenCount'],
  'image-provider-concurrency': ['defaults', 'post', 'image', 'providerConcurrency'],
  'image-local-concurrency': ['defaults', 'post', 'image', 'localConcurrency'],
  'gemini-video':      ['defaults', 'post', 'video', 'geminiVideo'],
  'minimax-video':     ['defaults', 'post', 'video', 'minimaxVideo'],
  'glm-video':         ['defaults', 'post', 'video', 'glmVideo'],
  'grok-video':        ['defaults', 'post', 'video', 'grokVideo'],
  'runway-video':      ['defaults', 'post', 'video', 'runwayVideo'],
  'deapi-video':       ['defaults', 'post', 'video', 'deapiVideo'],
  'video-duration':    ['defaults', 'post', 'video', 'videoDuration'],
  'video-size':        ['defaults', 'post', 'video', 'videoSize'],
  'video-aspect-ratio': ['defaults', 'post', 'video', 'videoAspectRatio'],
  'video-resolution':  ['defaults', 'post', 'video', 'videoResolution'],
  'video-provider-concurrency': ['defaults', 'post', 'video', 'providerConcurrency'],
  'video-local-concurrency': ['defaults', 'post', 'video', 'localConcurrency'],
  'elevenlabs-music':  ['defaults', 'post', 'music', 'elevenlabsMusic'],
  'minimax-music':     ['defaults', 'post', 'music', 'minimaxMusic'],
  'deapi-music':       ['defaults', 'post', 'music', 'deapiMusic'],
  'gemini-music':      ['defaults', 'post', 'music', 'geminiMusic'],
  'music-duration':    ['defaults', 'post', 'music', 'musicDuration'],
  'music-provider-concurrency': ['defaults', 'post', 'music', 'providerConcurrency'],
  'music-local-concurrency': ['defaults', 'post', 'music', 'localConcurrency'],
  'lang':              ['defaults', 'extract', 'ocr', 'lang'],
  'out':               ['defaults', 'extract', 'ocr', 'out'],
  'dpi':               ['defaults', 'extract', 'ocr', 'dpi'],
  'psm':               ['defaults', 'extract', 'ocr', 'psm'],
  'oem':               ['defaults', 'extract', 'ocr', 'oem'],
  'rotate':            ['defaults', 'extract', 'ocr', 'rotate'],
  'page-separator':    ['defaults', 'extract', 'ocr', 'pageSeparator'],
  'preserve-spaces':   ['defaults', 'extract', 'ocr', 'preserveSpaces'],
  'ocr-provider-concurrency': ['defaults', 'extract', 'ocr', 'providerConcurrency'],
  'ocr-local-concurrency': ['defaults', 'extract', 'ocr', 'localConcurrency'],
  'chapters':          ['defaults', 'extract', 'ocr', 'chapters'],
  'length':            ['defaults', 'extract', 'ocr', 'length'],
  'pdf-chapter-mode':  ['defaults', 'extract', 'ocr', 'pdfChapterMode'],
  'batch-limit':       ['defaults', 'batch', 'limit'],
  'batch-order':       ['defaults', 'batch', 'order'],
  'batch-concurrency': ['defaults', 'batch', 'concurrency'],
  'max-cents':         ['pricing', 'maxCents'],
}

const RUNTIME_ONLY_FLAGS = new Set([
  'price',
  'allow-over-budget',
  'show',
  'reset',
  'config-path',
  'password',
  'elevenlabs-tts-pvc-sample',
  'elevenlabs-tts-pvc-sample-dir',
  'elevenlabs-tts-pvc-language',
  'elevenlabs-tts-pvc-description',
  'elevenlabs-tts-pvc-captcha-out',
  'elevenlabs-tts-pvc-verify-audio',
  'elevenlabs-tts-pvc-wait',
  'speechify-tts-ref-audio',
  'speechify-tts-voice-name',
  'speechify-tts-consent-name',
  'speechify-tts-consent-email',
  'speechify-tts-voice-locale',
  'speechify-tts-voice-gender',
  'gcloud-tts-voice-cloning-key',
  'gcloud-tts-voice-cloning-key-out'
])

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
  return flags[flagName]
}

const parseConfigValue = (flagName: string, rawValue: unknown): unknown => {
  if ((flagName === 'tts-speaker-ref-audio' || flagName === 'minimax-tts-pronunciation' || flagName === 'elevenlabs-tts-pronunciation-dictionary-locator') && typeof rawValue === 'string') {
    return [rawValue]
  }
  if (typeof rawValue !== 'string') return rawValue
  const numericFlags = new Set([
    'speaker-count', 'reverb-verbatimicity', 'imagen-count', 'video-duration',
    'music-duration', 'dpi', 'psm', 'oem', 'rotate', 'length', 'batch-limit', 'batch-concurrency',
    'max-cents',
    'llm-provider-concurrency', 'llm-local-concurrency',
    'stt-provider-concurrency', 'stt-local-concurrency', 'stt-segment-concurrency', 'stt-preflight-concurrency',
    'ocr-provider-concurrency', 'ocr-local-concurrency',
    'tts-provider-concurrency', 'tts-local-concurrency',
    'image-provider-concurrency', 'image-local-concurrency',
    'video-provider-concurrency', 'video-local-concurrency',
    'music-provider-concurrency', 'music-local-concurrency',
    'openai-tts-speed', 'minimax-tts-speed', 'minimax-tts-volume', 'minimax-tts-pitch',
    'deepgram-tts-bit-rate', 'deepgram-tts-sample-rate', 'deepgram-tts-speed',
    'deapi-tts-speed', 'deapi-tts-sample-rate',
    'elevenlabs-tts-stability', 'elevenlabs-tts-similarity-boost', 'elevenlabs-tts-style',
    'elevenlabs-tts-speed', 'elevenlabs-tts-seed', 'elevenlabs-tts-optimize-streaming-latency'
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
  const patch: Record<string, unknown> = {}
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
