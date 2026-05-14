import { getOutputRoot } from '~/cli/commands/process-steps/output-root'
import { readEnv } from '~/utils/validate/env-utils'
import { CLIUsageError } from '~/utils/error-handler'
import { isStep2BooleanProviderSelected } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import {
  HOSTED_URL_ARTICLE_BACKENDS,
  URL_ARTICLE_BACKENDS
} from '~/cli/commands/process-steps/step-2-extract/step-2-url/url-provider-registry'
import {
  validateDeepgramTtsVoice,
  validateElevenLabsTtsTextNormalization,
  validateGcloudTtsVoice,
  validateGrokTtsLanguage,
  validateGrokTtsVoice,
  validateGroqTtsVoice,
  validateKittenTtsModel,
  validateMinimaxTtsEmotion,
  validateMinimaxTtsLanguageBoost,
  validateKittenTtsSpeaker,
  validateRunwayTtsVoice,
  validateSpeechifyTtsAudioFormat,
  validateSpeechifyTtsVoice
} from '~/cli/commands/setup-and-utilities/models/model-options'
import type { BuildOptsDefaults, OutputFormat, RuntimeOptions } from '~/types'
import {
  parseFloatWithDefault,
  parseIntWithDefault,
  parseOptionalNumberFlag,
  parseOptionalPositiveIntFlag,
  parsePdfChapterMode,
  parseTtsDialogueFormat,
  parseUrlBackend,
  readBatchOrder,
  readBooleanFlag,
  readOptionalRawStringFlag,
  readOptionalStringFlag,
  readOptionalStringListFlag,
  readStringFlag
} from './options/flag-readers'
import { parseRepeatableModelFlagOccurrences, readAllShortcutFlags, resolveStep2SelectionOrigins } from './options/model-flag-selection'
import { DEFAULT_KITTEN_TTS_SPEAKER, readRuntimeModelOptions, validateCliValue } from './options/model-options'

export { REPEATABLE_MODEL_FLAGS, normalizeModelFlagOccurrences, parseRepeatableModelFlagOccurrences } from './options/model-flag-selection'

const CONFIG_INJECTED_FLAGS_KEY = '__autoshowConfigInjectedFlags'

const countSelectedTargets = (
  models: string[] | undefined,
  model: string | undefined
): number => models?.length ?? (model ? 1 : 0)

const countBooleanTarget = (selected: boolean): number => selected ? 1 : 0

const readInjectedConfigFlags = (flags: Record<string, unknown>): Set<string> => {
  const value = flags[CONFIG_INJECTED_FLAGS_KEY]
  return new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [])
}

const hasExplicitOrConfiguredFlag = (
  flagName: string,
  explicitFlags: Set<string>,
  configuredFlags: Set<string>
): boolean => explicitFlags.has(flagName) || configuredFlags.has(flagName)

const resolveProviderConcurrency = (
  flags: Record<string, unknown>,
  flagName: string,
  allShortcutSelected: boolean,
  hostedTargetCount: number,
  explicitFlags: Set<string>,
  configuredFlags: Set<string>
): number => {
  const explicitOrConfigured = hasExplicitOrConfiguredFlag(flagName, explicitFlags, configuredFlags)
  if (allShortcutSelected && !explicitOrConfigured) {
    return Math.max(1, Math.min(8, hostedTargetCount))
  }
  return Math.max(1, parseIntWithDefault(readOptionalStringFlag(flags, flagName), 2))
}

const resolveLocalConcurrency = (
  flags: Record<string, unknown>,
  flagName: string
): number => Math.max(1, parseIntWithDefault(readOptionalStringFlag(flags, flagName), 1))

export const buildOptsFromFlags = (
  skipLLM: boolean,
  flags: Record<string, unknown>,
  _doubleDashArgs: string[] = [],
  defaults: BuildOptsDefaults = {},
  explicitFlags: Set<string> = new Set(),
  rawArgs: string[] = []
): RuntimeOptions => {
  void _doubleDashArgs
  const rawFlagArgs = rawArgs.includes('--') ? rawArgs.slice(0, rawArgs.indexOf('--')) : rawArgs
  const rawModelOccurrences = parseRepeatableModelFlagOccurrences(rawFlagArgs)

  const mergedFlags: Record<string, unknown> = { ...flags }
  const allShortcutFlags = readAllShortcutFlags(mergedFlags)
  const configuredFlags = readInjectedConfigFlags(mergedFlags)
  const outputFormat = readStringFlag(mergedFlags, 'out', 'json')
  const normalizedOut: OutputFormat = outputFormat === 'text' || outputFormat === 'tsv' || outputFormat === 'hocr' ? outputFormat : 'json'
  const epubLengthThousands = parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'length'), 'length')
  const pdfChapterMode = parsePdfChapterMode(readOptionalStringFlag(mergedFlags, 'pdf-chapter-mode'))

  const {
    whisperModels,
    whisperModel,
    gcloudSttModels,
    gcloudSttModel,
    awsSttModels,
    awsSttModel,
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
    supadataSttModels,
    supadataSttModel,
    scrapecreatorsSttModels,
    scrapecreatorsSttModel,
    openaiSttModels,
    openaiSttModel,
    geminiSttModels,
    geminiSttModel,
    glmSttModels,
    glmSttModel,
    togetherSttModels,
    togetherSttModel,
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
    kittenTtsModelValues,
    kittenTtsModelValue,
    elevenlabsTtsModels,
    elevenlabsTtsModel,
    minimaxTtsModels,
    minimaxTtsModel,
    groqTtsModels,
    groqTtsModel,
    grokTtsModels,
    grokTtsModel,
    mistralTtsModels,
    mistralTtsModel,
    openaiTtsModels,
    openaiTtsModel,
    geminiTtsModels,
    geminiTtsModel,
    deepgramTtsModels,
    deepgramTtsModel,
    runwayTtsModels,
    runwayTtsModel,
    speechifyTtsModels,
    speechifyTtsModel,
    gcloudTtsModels,
    gcloudTtsModel,
    deapiTtsModels,
    deapiTtsModel,
    geminiImageModels,
    geminiImageModel,
    openaiImageModels,
    openaiImageModel,
    minimaxImageModels,
    minimaxImageModel,
    glmImageModels,
    glmImageModel,
    grokImageModels,
    grokImageModel,
    runwayImageModels,
    runwayImageModel,
    bflImageModels,
    bflImageModel,
    deapiImageModels,
    deapiImageModel,
    elevenlabsMusicModels,
    elevenlabsMusicModel,
    minimaxMusicModels,
    minimaxMusicModel,
    deapiMusicModels,
    deapiMusicModel,
    geminiMusicModels,
    geminiMusicModel,
    geminiVideoModels,
    geminiVideoModel,
    minimaxVideoModels,
    minimaxVideoModel,
    glmVideoModels,
    glmVideoModel,
    grokVideoModels,
    grokVideoModel,
    runwayVideoModels,
    runwayVideoModel,
    deapiVideoModels,
    deapiVideoModel
  } = readRuntimeModelOptions(mergedFlags, rawModelOccurrences, allShortcutFlags, defaults)
  const urlBackendFlag = readOptionalStringFlag(mergedFlags, 'url-backend')
  const urlBackendEnv = readEnv('AUTOSHOW_URL_BACKEND')
  const allUrlSelected = allShortcutFlags['all-url']
  if (allUrlSelected && (urlBackendFlag !== undefined || urlBackendEnv !== undefined)) {
    throw CLIUsageError('Cannot use --all-url with --url-backend')
  }
  const urlBackend = parseUrlBackend(urlBackendFlag ?? urlBackendEnv)
  const urlBackends = allUrlSelected ? [...URL_ARTICLE_BACKENDS] : undefined
  const useReverb = isStep2BooleanProviderSelected('reverb-stt', mergedFlags, allShortcutFlags)
  const step2SelectionOrigins = resolveStep2SelectionOrigins(mergedFlags, explicitFlags, rawModelOccurrences, allShortcutFlags)
  const whisperExplicit = step2SelectionOrigins['whisper-stt'] === 'explicit' || step2SelectionOrigins['whisper-stt'] === 'all-shortcut'
  const useTesseract = isStep2BooleanProviderSelected('tesseract-ocr', mergedFlags, allShortcutFlags)
  const useOcrmypdf = isStep2BooleanProviderSelected('ocrmypdf', mergedFlags, allShortcutFlags)
  const usePaddleOcr = isStep2BooleanProviderSelected('paddle-ocr', mergedFlags, allShortcutFlags)
  const hostedOcrTargetCount =
    countSelectedTargets(mistralOcrModels, mistralOcrModel)
    + countSelectedTargets(glmOcrModels, glmOcrModel)
    + countSelectedTargets(kimiOcrModels, kimiOcrModel)
    + countSelectedTargets(openaiOcrModels, openaiOcrModel)
    + countSelectedTargets(anthropicOcrModels, anthropicOcrModel)
    + countSelectedTargets(geminiOcrModels, geminiOcrModel)
    + countSelectedTargets(deepinfraOcrModels, deepinfraOcrModel)
    + countSelectedTargets(awsTextractModels, awsTextractModel)
    + countSelectedTargets(gcloudDocaiModels, gcloudDocaiModel)
  const hostedLlmTargetCount =
    countSelectedTargets(openaiModels, openaiModel)
    + countSelectedTargets(groqModels, groqModel)
    + countSelectedTargets(geminiModels, geminiModel)
    + countSelectedTargets(anthropicModels, anthropicModel)
    + countSelectedTargets(minimaxModels, minimaxModel)
    + countSelectedTargets(grokModels, grokModel)
    + countSelectedTargets(glmModels, glmModel)
    + countSelectedTargets(kimiModels, kimiModel)
  const hostedTtsTargetCount =
    countSelectedTargets(elevenlabsTtsModels, elevenlabsTtsModel)
    + countSelectedTargets(minimaxTtsModels, minimaxTtsModel)
    + countSelectedTargets(groqTtsModels, groqTtsModel)
    + countSelectedTargets(grokTtsModels, grokTtsModel)
    + countSelectedTargets(mistralTtsModels, mistralTtsModel)
    + countSelectedTargets(openaiTtsModels, openaiTtsModel)
    + countSelectedTargets(geminiTtsModels, geminiTtsModel)
    + countSelectedTargets(deepgramTtsModels, deepgramTtsModel)
    + countSelectedTargets(runwayTtsModels, runwayTtsModel)
    + countSelectedTargets(speechifyTtsModels, speechifyTtsModel)
    + countSelectedTargets(gcloudTtsModels, gcloudTtsModel)
    + countSelectedTargets(deapiTtsModels, deapiTtsModel)
  const hostedImageTargetCount =
    countSelectedTargets(geminiImageModels, geminiImageModel)
    + countSelectedTargets(openaiImageModels, openaiImageModel)
    + countSelectedTargets(minimaxImageModels, minimaxImageModel)
    + countSelectedTargets(glmImageModels, glmImageModel)
    + countSelectedTargets(grokImageModels, grokImageModel)
    + countSelectedTargets(runwayImageModels, runwayImageModel)
    + countSelectedTargets(bflImageModels, bflImageModel)
    + countSelectedTargets(deapiImageModels, deapiImageModel)
  const hostedVideoTargetCount =
    countSelectedTargets(geminiVideoModels, geminiVideoModel)
    + countSelectedTargets(minimaxVideoModels, minimaxVideoModel)
    + countSelectedTargets(glmVideoModels, glmVideoModel)
    + countSelectedTargets(grokVideoModels, grokVideoModel)
    + countSelectedTargets(runwayVideoModels, runwayVideoModel)
    + countSelectedTargets(deapiVideoModels, deapiVideoModel)
  const hostedMusicTargetCount =
    countSelectedTargets(elevenlabsMusicModels, elevenlabsMusicModel)
    + countSelectedTargets(minimaxMusicModels, minimaxMusicModel)
    + countSelectedTargets(deapiMusicModels, deapiMusicModel)
    + countSelectedTargets(geminiMusicModels, geminiMusicModel)
  const localTtsTargetCount = countSelectedTargets(kittenTtsModelValues, kittenTtsModelValue)
  const localOcrTargetCount = countBooleanTarget(useTesseract) + countBooleanTarget(useOcrmypdf) + countBooleanTarget(usePaddleOcr)
  void localOcrTargetCount
  void localTtsTargetCount

  return {
    outputRootDir: getOutputRoot(),
    configPath: readOptionalStringFlag(mergedFlags, 'config-path'),
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
    scrapecreatorsSttModels,
    scrapecreatorsSttModel,
    openaiSttModels,
    openaiSttModel,
    geminiSttModels,
    geminiSttModel,
    glmSttModels,
    glmSttModel,
    togetherSttModels,
    togetherSttModel,
    supadataLang: readOptionalStringFlag(mergedFlags, 'supadata-lang'),
    scrapecreatorsLang: readOptionalStringFlag(mergedFlags, 'scrapecreators-lang') ?? 'en',
    diarizationSpeakerCount: parseOptionalPositiveIntFlag(readOptionalStringFlag(mergedFlags, 'speaker-count'), 'speaker-count'),
    sttProviderConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-provider-concurrency'), 2)),
    sttLocalConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-local-concurrency'), 1)),
    sttSegmentConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-segment-concurrency'), 2)),
    sttPreflightConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'stt-preflight-concurrency'), 4)),
    ocrProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'ocr-provider-concurrency', allShortcutFlags['all-ocr'], hostedOcrTargetCount, explicitFlags, configuredFlags),
    ocrLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'ocr-local-concurrency'),
    llmProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'llm-provider-concurrency', allShortcutFlags['all-llm'], hostedLlmTargetCount, explicitFlags, configuredFlags),
    llmLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'llm-local-concurrency'),
    ttsProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'tts-provider-concurrency', allShortcutFlags['all-tts'], hostedTtsTargetCount, explicitFlags, configuredFlags),
    ttsLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'tts-local-concurrency'),
    imageProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'image-provider-concurrency', allShortcutFlags['all-image'], hostedImageTargetCount, explicitFlags, configuredFlags),
    imageLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'image-local-concurrency'),
    videoProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'video-provider-concurrency', allShortcutFlags['all-video'], hostedVideoTargetCount, explicitFlags, configuredFlags),
    videoLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'video-local-concurrency'),
    musicProviderConcurrency: resolveProviderConcurrency(mergedFlags, 'music-provider-concurrency', allShortcutFlags['all-music'], hostedMusicTargetCount, explicitFlags, configuredFlags),
    musicLocalConcurrency: resolveLocalConcurrency(mergedFlags, 'music-local-concurrency'),
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
    primaryOcr: readOptionalStringFlag(mergedFlags, 'primary-ocr'),
    epubChapterFiles: readBooleanFlag(mergedFlags, 'chapters'),
    epubChunkLimitChars: epubLengthThousands === undefined ? undefined : epubLengthThousands * 1000,
    pdfChapterMode,
    useEpubBun: readBooleanFlag(mergedFlags, 'epub-bun'),
    useEpubCalibre: readBooleanFlag(mergedFlags, 'epub-calibre'),
    urlBackend,
    urlBackendExplicit: urlBackendFlag !== undefined || urlBackendEnv !== undefined,
    urlBackends,
    urlProviderConcurrency: resolveProviderConcurrency(
      mergedFlags,
      'url-provider-concurrency',
      allUrlSelected,
      Math.min(4, HOSTED_URL_ARTICLE_BACKENDS.length),
      explicitFlags,
      configuredFlags
    ),
    batchLimit: parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'batch-limit'), 5),
    batchAll: readBooleanFlag(mergedFlags, 'batch-all'),
    batchOrder: readBatchOrder(mergedFlags),
    batchConcurrency: Math.max(1, parseIntWithDefault(readOptionalStringFlag(mergedFlags, 'batch-concurrency'), 1)),
    keepOriginalMedia: readBooleanFlag(mergedFlags, 'keep-original-media'),
    bestQuality: readBooleanFlag(mergedFlags, 'best-quality'),
    flatBatch: readBooleanFlag(mergedFlags, 'flat-batch'),
    ytDlpPassthroughArgs: undefined,
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
    groqTtsModel,
    grokTtsModels,
    grokTtsModel,
    grokTtsVoice: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'grok-tts-voice')
      if (v === undefined) return undefined
      if (grokTtsModels === undefined) return v
      return validateCliValue(validateGrokTtsVoice, v)
    })(),
    grokTtsLanguage: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'grok-tts-language')
      if (v === undefined) return undefined
      return validateCliValue(validateGrokTtsLanguage, v)
    })(),
    grokTtsTextNormalization: readBooleanFlag(mergedFlags, 'grok-tts-text-normalization'),
    mistralTtsModels,
    mistralTtsModel,
    mistralTtsVoice: readOptionalStringFlag(mergedFlags, 'mistral-tts-voice'),
    mistralTtsRefAudio: readOptionalStringFlag(mergedFlags, 'mistral-tts-ref-audio'),
    mistralTtsVoiceName: readOptionalRawStringFlag(rawFlagArgs, 'mistral-tts-voice-name') ?? readOptionalStringFlag(mergedFlags, 'mistral-tts-voice-name'),
    ttsDialogueFormat: parseTtsDialogueFormat(readOptionalStringFlag(mergedFlags, 'tts-dialogue-format')),
    ttsSpeakerRefAudios: readOptionalStringListFlag(mergedFlags, 'tts-speaker-ref-audio'),
    openaiTtsModels,
    openaiTtsModel,
    geminiTtsModels,
    geminiTtsModel,
    deepgramTtsModels,
    deepgramTtsModel,
    runwayTtsModels,
    runwayTtsModel,
    runwayTtsVoice: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'runway-tts-voice')
      if (v === undefined) return undefined
      if (runwayTtsModels === undefined) return v
      return validateCliValue(validateRunwayTtsVoice, v)
    })(),
    speechifyTtsModels,
    speechifyTtsModel,
    speechifyVoice: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'speechify-voice')
      if (v === undefined) return undefined
      if (speechifyTtsModels === undefined) return v
      return validateCliValue(validateSpeechifyTtsVoice, v)
    })(),
    speechifyTtsAudioFormat: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'speechify-tts-audio-format')
      if (v === undefined) return undefined
      return validateCliValue(validateSpeechifyTtsAudioFormat, v)
    })(),
    speechifyTtsLanguage: readOptionalStringFlag(mergedFlags, 'speechify-tts-language'),
    speechifyTtsRefAudio: readOptionalStringFlag(mergedFlags, 'speechify-tts-ref-audio'),
    speechifyTtsVoiceName: readOptionalRawStringFlag(rawFlagArgs, 'speechify-tts-voice-name') ?? readOptionalStringFlag(mergedFlags, 'speechify-tts-voice-name'),
    speechifyTtsConsentName: readOptionalRawStringFlag(rawFlagArgs, 'speechify-tts-consent-name') ?? readOptionalStringFlag(mergedFlags, 'speechify-tts-consent-name'),
    speechifyTtsConsentEmail: readOptionalStringFlag(mergedFlags, 'speechify-tts-consent-email'),
    speechifyTtsVoiceLocale: readOptionalStringFlag(mergedFlags, 'speechify-tts-voice-locale'),
    speechifyTtsVoiceGender: readOptionalStringFlag(mergedFlags, 'speechify-tts-voice-gender'),
    gcloudTtsModels,
    gcloudTtsModel,
    gcloudTtsVoice: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'gcloud-tts-voice')
      if (v === undefined) return undefined
      if (gcloudTtsModels === undefined) return v
      return validateCliValue(validateGcloudTtsVoice, v)
    })(),
    gcloudTtsLanguage: readOptionalStringFlag(mergedFlags, 'gcloud-tts-language'),
    gcloudTtsRefAudio: readOptionalStringFlag(mergedFlags, 'gcloud-tts-ref-audio'),
    gcloudTtsConsentAudio: readOptionalStringFlag(mergedFlags, 'gcloud-tts-consent-audio'),
    gcloudTtsConsentLanguage: readOptionalStringFlag(mergedFlags, 'gcloud-tts-consent-language'),
    gcloudTtsVoiceCloningKey: readOptionalStringFlag(mergedFlags, 'gcloud-tts-voice-cloning-key'),
    gcloudTtsVoiceCloningKeyOut: readOptionalStringFlag(mergedFlags, 'gcloud-tts-voice-cloning-key-out'),
    deapiTtsModels,
    deapiTtsModel,
    deapiTtsVoice: readOptionalStringFlag(mergedFlags, 'deapi-tts-voice'),
    deapiTtsRefAudio: readOptionalStringFlag(mergedFlags, 'deapi-tts-ref-audio'),
    deapiTtsRefText: readOptionalRawStringFlag(rawFlagArgs, 'deapi-tts-ref-text') ?? readOptionalStringFlag(mergedFlags, 'deapi-tts-ref-text'),
    deapiTtsLanguage: readOptionalStringFlag(mergedFlags, 'deapi-tts-language'),
    deapiTtsSpeed: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'deapi-tts-speed'), 'deapi-tts-speed', { min: 0.5, max: 2 }),
    deapiTtsFormat: readOptionalStringFlag(mergedFlags, 'deapi-tts-format'),
    deapiTtsSampleRate: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'deapi-tts-sample-rate'), 'deapi-tts-sample-rate', { min: 1, max: 192000, integer: true }),
    deapiTtsInstruction: readOptionalRawStringFlag(rawFlagArgs, 'deapi-tts-instruction') ?? readOptionalStringFlag(mergedFlags, 'deapi-tts-instruction'),
    groqVoiceId: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'groq-voice')
      if (v === undefined) return undefined
      if (groqTtsModels === undefined) return v
      return validateCliValue(validateGroqTtsVoice, v)
    })(),
    openaiVoiceId: readOptionalStringFlag(mergedFlags, 'openai-voice'),
    openaiTtsInstructions: readOptionalRawStringFlag(rawFlagArgs, 'openai-tts-instructions') ?? readOptionalStringFlag(mergedFlags, 'openai-tts-instructions'),
    openaiTtsSpeed: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'openai-tts-speed'), 'openai-tts-speed', { min: 0.25, max: 4 }),
    openaiTtsRefAudio: readOptionalStringFlag(mergedFlags, 'openai-tts-ref-audio'),
    openaiTtsConsentId: readOptionalStringFlag(mergedFlags, 'openai-tts-consent-id'),
    openaiTtsConsentAudio: readOptionalStringFlag(mergedFlags, 'openai-tts-consent-audio'),
    openaiTtsConsentLanguage: readOptionalStringFlag(mergedFlags, 'openai-tts-consent-language'),
    openaiTtsConsentName: readOptionalRawStringFlag(rawFlagArgs, 'openai-tts-consent-name') ?? readOptionalStringFlag(mergedFlags, 'openai-tts-consent-name'),
    openaiTtsVoiceName: readOptionalRawStringFlag(rawFlagArgs, 'openai-tts-voice-name') ?? readOptionalStringFlag(mergedFlags, 'openai-tts-voice-name'),
    geminiVoiceId: readOptionalStringFlag(mergedFlags, 'gemini-voice'),
    deepgramVoiceId: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'deepgram-voice')
      if (v === undefined) return undefined
      if (deepgramTtsModels === undefined) return v
      return validateCliValue(validateDeepgramTtsVoice, v)
    })(),
    deepgramTtsEncoding: readOptionalStringFlag(mergedFlags, 'deepgram-tts-encoding'),
    deepgramTtsContainer: readOptionalStringFlag(mergedFlags, 'deepgram-tts-container'),
    deepgramTtsBitRate: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'deepgram-tts-bit-rate'), 'deepgram-tts-bit-rate', { min: 1, max: 1000000, integer: true }),
    deepgramTtsSampleRate: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'deepgram-tts-sample-rate'), 'deepgram-tts-sample-rate', { min: 1, max: 192000, integer: true }),
    deepgramTtsSpeed: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'deepgram-tts-speed'), 'deepgram-tts-speed', { min: 0.5, max: 2 }),
    geminiSpeaker1Name: readOptionalRawStringFlag(rawFlagArgs, 'gemini-speaker-1-name') ?? readOptionalStringFlag(mergedFlags, 'gemini-speaker-1-name'),
    geminiSpeaker1Voice: readOptionalRawStringFlag(rawFlagArgs, 'gemini-speaker-1-voice') ?? readOptionalStringFlag(mergedFlags, 'gemini-speaker-1-voice'),
    geminiSpeaker2Name: readOptionalRawStringFlag(rawFlagArgs, 'gemini-speaker-2-name') ?? readOptionalStringFlag(mergedFlags, 'gemini-speaker-2-name'),
    geminiSpeaker2Voice: readOptionalRawStringFlag(rawFlagArgs, 'gemini-speaker-2-voice') ?? readOptionalStringFlag(mergedFlags, 'gemini-speaker-2-voice'),
    elevenlabsTtsModels,
    elevenlabsTtsModel,
    elevenlabsTtsPvcVoice: readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-pvc-voice'),
    elevenlabsTtsRefAudio: readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-ref-audio'),
    elevenlabsTtsVoiceName: readOptionalRawStringFlag(rawFlagArgs, 'elevenlabs-tts-voice-name') ?? readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-voice-name'),
    elevenlabsTtsCloneRemoveBackgroundNoise: readBooleanFlag(mergedFlags, 'elevenlabs-tts-clone-remove-background-noise'),
    elevenlabsTtsOutputFormat: readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-output-format'),
    elevenlabsTtsLanguageCode: readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-language-code'),
    elevenlabsTtsStability: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-stability'), 'elevenlabs-tts-stability', { min: 0, max: 1 }),
    elevenlabsTtsSimilarityBoost: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-similarity-boost'), 'elevenlabs-tts-similarity-boost', { min: 0, max: 1 }),
    elevenlabsTtsStyle: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-style'), 'elevenlabs-tts-style', { min: 0, max: 1 }),
    elevenlabsTtsUseSpeakerBoost: readBooleanFlag(mergedFlags, 'elevenlabs-tts-use-speaker-boost'),
    elevenlabsTtsSpeed: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-speed'), 'elevenlabs-tts-speed', { min: 0.7, max: 1.2 }),
    elevenlabsTtsSeed: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-seed'), 'elevenlabs-tts-seed', { min: 0, max: 4294967295, integer: true }),
    elevenlabsTtsTextNormalization: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-text-normalization')
      if (v === undefined) return undefined
      return validateCliValue(validateElevenLabsTtsTextNormalization, v)
    })(),
    elevenlabsTtsPronunciationDictionaryLocators: readOptionalStringListFlag(mergedFlags, 'elevenlabs-tts-pronunciation-dictionary-locator'),
    elevenlabsTtsOptimizeStreamingLatency: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-optimize-streaming-latency'), 'elevenlabs-tts-optimize-streaming-latency', { min: 0, max: 4, integer: true }),
    elevenlabsTtsPvcAsIvc: readBooleanFlag(mergedFlags, 'elevenlabs-tts-pvc-as-ivc'),
    elevenlabsTtsPvcSamples: readOptionalStringListFlag(mergedFlags, 'elevenlabs-tts-pvc-sample'),
    elevenlabsTtsPvcSampleDir: readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-pvc-sample-dir'),
    elevenlabsTtsPvcLanguage: readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-pvc-language'),
    elevenlabsTtsPvcDescription: readOptionalRawStringFlag(rawFlagArgs, 'elevenlabs-tts-pvc-description') ?? readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-pvc-description'),
    elevenlabsTtsPvcCaptchaOut: readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-pvc-captcha-out'),
    elevenlabsTtsPvcVerifyAudio: readOptionalStringFlag(mergedFlags, 'elevenlabs-tts-pvc-verify-audio'),
    elevenlabsTtsPvcWait: readBooleanFlag(mergedFlags, 'elevenlabs-tts-pvc-wait'),
    minimaxTtsModels,
    minimaxTtsModel,
    minimaxTtsVoice: readOptionalStringFlag(mergedFlags, 'minimax-tts-voice'),
    minimaxTtsLanguageBoost: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'minimax-tts-language-boost')
      if (v === undefined) return undefined
      return validateCliValue(validateMinimaxTtsLanguageBoost, v)
    })(),
    minimaxTtsSpeed: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'minimax-tts-speed'), 'minimax-tts-speed', { min: 0.5, max: 2 }),
    minimaxTtsVolume: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'minimax-tts-volume'), 'minimax-tts-volume', { min: 0, max: 10, exclusiveMin: true }),
    minimaxTtsPitch: parseOptionalNumberFlag(readOptionalStringFlag(mergedFlags, 'minimax-tts-pitch'), 'minimax-tts-pitch', { min: -12, max: 12, integer: true }),
    minimaxTtsEmotion: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'minimax-tts-emotion')
      if (v === undefined) return undefined
      return validateCliValue(validateMinimaxTtsEmotion, v)
    })(),
    minimaxTtsEnglishNormalization: readBooleanFlag(mergedFlags, 'minimax-tts-english-normalization'),
    minimaxTtsPronunciations: readOptionalStringListFlag(mergedFlags, 'minimax-tts-pronunciation'),
    elevenlabsVoiceId: readOptionalStringFlag(mergedFlags, 'elevenlabs-voice'),
    geminiImageModels,
    geminiImageModel,
    openaiImageModels,
    openaiImageModel,
    minimaxImageModels,
    minimaxImageModel,
    glmImageModels,
    glmImageModel,
    grokImageModels,
    grokImageModel,
    runwayImageModels,
    runwayImageModel,
    bflImageModels,
    bflImageModel,
    deapiImageModels,
    deapiImageModel,
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
    elevenlabsMusicModel,
    minimaxMusicModels,
    minimaxMusicModel,
    deapiMusicModels,
    deapiMusicModel,
    geminiMusicModels,
    geminiMusicModel,
    musicDuration: (() => {
      const v = readOptionalStringFlag(mergedFlags, 'music-duration')
      if (v === undefined) return undefined
      const n = parseInt(v, 10)
      return Number.isFinite(n) ? n : undefined
    })(),
    musicLyricsFile: readOptionalStringFlag(mergedFlags, 'music-lyrics-file'),
    musicInstrumental: readBooleanFlag(mergedFlags, 'music-instrumental'),
    geminiVideoModels,
    geminiVideoModel,
    minimaxVideoModels,
    minimaxVideoModel,
    glmVideoModels,
    glmVideoModel,
    grokVideoModels,
    grokVideoModel,
    runwayVideoModels,
    runwayVideoModel,
    deapiVideoModels,
    deapiVideoModel,
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
