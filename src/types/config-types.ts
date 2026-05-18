import * as v from 'valibot'

const ModelArraySchema = v.optional(v.array(v.string()), undefined)

const PricingConfigSchema = v.strictObject({
  maxCents: v.optional(v.pipe(v.number(), v.minValue(0)), undefined)
})

const ExtractSttDefaultsSchema = v.strictObject({
  whisper: ModelArraySchema,
  reverb: v.optional(v.boolean(), undefined),
  youtubeCaptions: v.optional(v.boolean(), undefined),
  gcloudStt: ModelArraySchema,
  awsStt: ModelArraySchema,
  deepinfraStt: ModelArraySchema,
  deapiStt: ModelArraySchema,
  groqStt: ModelArraySchema,
  grokStt: ModelArraySchema,
  elevenlabsStt: ModelArraySchema,
  deepgramStt: ModelArraySchema,
  sonioxStt: ModelArraySchema,
  revStt: ModelArraySchema,
  mistralStt: ModelArraySchema,
  assemblyaiStt: ModelArraySchema,
  gladiaStt: ModelArraySchema,
  happyscribeStt: ModelArraySchema,
  happyscribeOrganizationId: v.optional(v.string(), undefined),
  supadataStt: ModelArraySchema,
  scrapecreatorsStt: ModelArraySchema,
  openaiStt: ModelArraySchema,
  geminiStt: ModelArraySchema,
  glmStt: ModelArraySchema,
  supadataLang: v.optional(v.string(), undefined),
  scrapecreatorsLang: v.optional(v.string(), undefined),
  speechmaticsStt: ModelArraySchema,
  awsRegion: v.optional(v.string(), undefined),
  awsBucket: v.optional(v.string(), undefined),
  speakerCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  split: v.optional(v.boolean(), undefined),
  reverbVerbatimicity: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)), undefined),
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  localConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  segmentConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  preflightConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  refreshCache: v.optional(v.boolean(), undefined),
  noCache: v.optional(v.boolean(), undefined)
})

const LlmDefaultsSchema = v.strictObject({
  llama: ModelArraySchema,
  openai: ModelArraySchema,
  groq: ModelArraySchema,
  gemini: ModelArraySchema,
  anthropic: ModelArraySchema,
  minimax: ModelArraySchema,
  grok: ModelArraySchema,
  glm: ModelArraySchema,
  kimi: ModelArraySchema,
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  localConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const TtsDefaultsSchema = v.strictObject({
  kittenTts: ModelArraySchema,
  elevenlabsTts: ModelArraySchema,
  minimaxTts: ModelArraySchema,
  groqTts: ModelArraySchema,
  grokTts: ModelArraySchema,
  mistralTts: ModelArraySchema,
  openaiTts: ModelArraySchema,
  geminiTts: ModelArraySchema,
  deepgramTts: ModelArraySchema,
  speechifyTts: ModelArraySchema,
  humeTts: ModelArraySchema,
  humeTtsVoice: v.optional(v.string(), undefined),
  humeTtsVoiceProvider: v.optional(v.picklist(['HUME_AI', 'CUSTOM_VOICE']), undefined),
  cartesiaTts: ModelArraySchema,
  cartesiaTtsVoice: v.optional(v.string(), undefined),
  cartesiaTtsLanguage: v.optional(v.string(), undefined),
  gcloudTts: ModelArraySchema,
  deapiTts: ModelArraySchema,
  deapiTtsVoice: v.optional(v.string(), undefined),
  deapiTtsRefAudio: v.optional(v.string(), undefined),
  deapiTtsRefText: v.optional(v.string(), undefined),
  deapiTtsLanguage: v.optional(v.string(), undefined),
  deapiTtsSpeed: v.optional(v.pipe(v.number(), v.minValue(0.5), v.maxValue(2)), undefined),
  deapiTtsFormat: v.optional(v.string(), undefined),
  deapiTtsSampleRate: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  deapiTtsInstruction: v.optional(v.string(), undefined),
  speechifyVoice: v.optional(v.string(), undefined),
  speechifyTtsAudioFormat: v.optional(v.picklist(['mp3', 'ogg', 'aac', 'wav', 'pcm']), undefined),
  speechifyTtsLanguage: v.optional(v.string(), undefined),
  gcloudTtsVoice: v.optional(v.string(), undefined),
  gcloudTtsLanguage: v.optional(v.string(), undefined),
  gcloudTtsRefAudio: v.optional(v.string(), undefined),
  gcloudTtsConsentAudio: v.optional(v.string(), undefined),
  gcloudTtsConsentLanguage: v.optional(v.string(), undefined),
  ttsSpeaker: v.optional(v.string(), undefined),
  groqVoice: v.optional(v.string(), undefined),
  grokTtsVoice: v.optional(v.string(), undefined),
  grokTtsLanguage: v.optional(v.string(), undefined),
  grokTtsTextNormalization: v.optional(v.boolean(), undefined),
  mistralTtsVoice: v.optional(v.string(), undefined),
  mistralTtsRefAudio: v.optional(v.string(), undefined),
  mistralTtsVoiceName: v.optional(v.string(), undefined),
  ttsDialogueFormat: v.optional(v.picklist(['screenplay', 'labeled']), undefined),
  ttsSpeakerRefAudio: v.optional(v.array(v.string()), undefined),
  openaiVoice: v.optional(v.string(), undefined),
  openaiTtsInstructions: v.optional(v.string(), undefined),
  openaiTtsSpeed: v.optional(v.pipe(v.number(), v.minValue(0.25), v.maxValue(4)), undefined),
  openaiTtsRefAudio: v.optional(v.string(), undefined),
  openaiTtsConsentId: v.optional(v.string(), undefined),
  openaiTtsConsentAudio: v.optional(v.string(), undefined),
  openaiTtsConsentLanguage: v.optional(v.string(), undefined),
  openaiTtsConsentName: v.optional(v.string(), undefined),
  openaiTtsVoiceName: v.optional(v.string(), undefined),
  geminiVoice: v.optional(v.string(), undefined),
  deepgramVoice: v.optional(v.string(), undefined),
  deepgramTtsEncoding: v.optional(v.string(), undefined),
  deepgramTtsContainer: v.optional(v.string(), undefined),
  deepgramTtsBitRate: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  deepgramTtsSampleRate: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  deepgramTtsSpeed: v.optional(v.pipe(v.number(), v.minValue(0.5), v.maxValue(2)), undefined),
  geminiSpeaker1Name: v.optional(v.string(), undefined),
  geminiSpeaker1Voice: v.optional(v.string(), undefined),
  geminiSpeaker2Name: v.optional(v.string(), undefined),
  geminiSpeaker2Voice: v.optional(v.string(), undefined),
  elevenlabsVoice: v.optional(v.string(), undefined),
  elevenlabsTtsPvcVoice: v.optional(v.string(), undefined),
  elevenlabsTtsRefAudio: v.optional(v.string(), undefined),
  elevenlabsTtsVoiceName: v.optional(v.string(), undefined),
  elevenlabsTtsCloneRemoveBackgroundNoise: v.optional(v.boolean(), undefined),
  elevenlabsTtsOutputFormat: v.optional(v.string(), undefined),
  elevenlabsTtsLanguageCode: v.optional(v.string(), undefined),
  elevenlabsTtsStability: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)), undefined),
  elevenlabsTtsSimilarityBoost: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)), undefined),
  elevenlabsTtsStyle: v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)), undefined),
  elevenlabsTtsUseSpeakerBoost: v.optional(v.boolean(), undefined),
  elevenlabsTtsSpeed: v.optional(v.pipe(v.number(), v.minValue(0.7), v.maxValue(1.2)), undefined),
  elevenlabsTtsSeed: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), undefined),
  elevenlabsTtsTextNormalization: v.optional(v.picklist(['auto', 'on', 'off']), undefined),
  elevenlabsTtsPronunciationDictionaryLocators: v.optional(v.array(v.string()), undefined),
  elevenlabsTtsOptimizeStreamingLatency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(4)), undefined),
  elevenlabsTtsPvcAsIvc: v.optional(v.boolean(), undefined),
  minimaxTtsVoice: v.optional(v.string(), undefined),
  minimaxTtsLanguageBoost: v.optional(v.string(), undefined),
  minimaxTtsSpeed: v.optional(v.pipe(v.number(), v.minValue(0.5), v.maxValue(2)), undefined),
  minimaxTtsVolume: v.optional(v.pipe(v.number(), v.check(value => value > 0, 'Expected a number greater than 0'), v.maxValue(10)), undefined),
  minimaxTtsPitch: v.optional(v.pipe(v.number(), v.integer(), v.minValue(-12), v.maxValue(12)), undefined),
  minimaxTtsEmotion: v.optional(v.string(), undefined),
  minimaxTtsEnglishNormalization: v.optional(v.boolean(), undefined),
  minimaxTtsPronunciations: v.optional(v.array(v.string()), undefined),
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  localConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const ImageDefaultsSchema = v.strictObject({
  geminiImage: ModelArraySchema,
  openaiImage: ModelArraySchema,
  minimaxImage: ModelArraySchema,
  glmImage: ModelArraySchema,
  grokImage: ModelArraySchema,
  runwayImage: ModelArraySchema,
  bflImage: ModelArraySchema,
  deapiImage: ModelArraySchema,
  imageAspectRatio: v.optional(v.string(), undefined),
  imageSize: v.optional(v.string(), undefined),
  imageQuality: v.optional(v.string(), undefined),
  imageFormat: v.optional(v.string(), undefined),
  imageBackground: v.optional(v.string(), undefined),
  imageCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  imageInputs: v.optional(v.array(v.string()), undefined),
  imageMask: v.optional(v.string(), undefined),
  imageResponseMode: v.optional(v.string(), undefined),
  geminiPersonGeneration: v.optional(v.string(), undefined),
  geminiSearchGrounding: v.optional(v.boolean(), undefined),
  imageCompression: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(100)), undefined),
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  localConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const VideoDefaultsSchema = v.strictObject({
  geminiVideo: ModelArraySchema,
  minimaxVideo: ModelArraySchema,
  glmVideo: ModelArraySchema,
  grokVideo: ModelArraySchema,
  runwayVideo: ModelArraySchema,
  deapiVideo: ModelArraySchema,
  videoDuration: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  videoSize: v.optional(v.string(), undefined),
  videoAspectRatio: v.optional(v.string(), undefined),
  videoResolution: v.optional(v.string(), undefined),
  videoMode: v.optional(v.string(), undefined),
  videoInputImage: v.optional(v.string(), undefined),
  videoLastFrame: v.optional(v.string(), undefined),
  videoReferenceImages: v.optional(v.array(v.string()), undefined),
  videoInputVideo: v.optional(v.string(), undefined),
  grokVideoStorageFilename: v.optional(v.string(), undefined),
  grokVideoStorageExpiresAfter: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2592000)), undefined),
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  localConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const MusicDefaultsSchema = v.strictObject({
  elevenlabsMusic: ModelArraySchema,
  minimaxMusic: ModelArraySchema,
  deapiMusic: ModelArraySchema,
  geminiMusic: ModelArraySchema,
  musicDuration: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  localConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const ExtractOcrDefaultsSchema = v.strictObject({
  lang: v.optional(v.string(), undefined),
  out: v.optional(v.picklist(['text', 'json', 'tsv', 'hocr']), undefined),
  tesseract: v.optional(v.boolean(), undefined),
  ocrmypdf: v.optional(v.boolean(), undefined),
  paddleOcr: v.optional(v.boolean(), undefined),
  dpi: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  psm: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), undefined),
  oem: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), undefined),
  rotate: v.optional(v.pipe(v.number(), v.integer()), undefined),
  pageSeparator: v.optional(v.string(), undefined),
  preserveSpaces: v.optional(v.boolean(), undefined),
  providerConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  localConcurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  mistralOcr: ModelArraySchema,
  glmOcr: ModelArraySchema,
  kimiOcr: ModelArraySchema,
  openaiOcr: ModelArraySchema,
  anthropicOcr: ModelArraySchema,
  geminiOcr: ModelArraySchema,
  deepinfraOcr: ModelArraySchema,
  awsTextract: ModelArraySchema,
  gcloudDocai: ModelArraySchema,
  gcloudDocaiLocation: v.optional(v.string(), undefined),
  gcloudDocaiOcrProcessorId: v.optional(v.string(), undefined),
  gcloudDocaiLayoutProcessorId: v.optional(v.string(), undefined),
  gcloudDocaiBucket: v.optional(v.string(), undefined),
  chapters: v.optional(v.boolean(), undefined),
  length: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  pdfChapterMode: v.optional(v.picklist(['local', 'auto', 'llm']), undefined)
})

const ExtractDefaultsSchema = v.strictObject({
  stt: v.optional(ExtractSttDefaultsSchema, undefined),
  ocr: v.optional(ExtractOcrDefaultsSchema, undefined)
})

const BatchDefaultsSchema = v.strictObject({
  limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  order: v.optional(v.picklist(['newest', 'oldest']), undefined),
  concurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const PostDefaultsSchema = v.strictObject({
  tts: v.optional(TtsDefaultsSchema, undefined),
  image: v.optional(ImageDefaultsSchema, undefined),
  video: v.optional(VideoDefaultsSchema, undefined),
  music: v.optional(MusicDefaultsSchema, undefined)
})

const ConfigDefaultsSchema = v.strictObject({
  llm: v.optional(LlmDefaultsSchema, undefined),
  post: v.optional(PostDefaultsSchema, undefined),
  extract: v.optional(ExtractDefaultsSchema, undefined),
  batch: v.optional(BatchDefaultsSchema, undefined),
  prompts: v.optional(v.array(v.string()), undefined)
})

export const AutoshowConfigSchema = v.strictObject({
  defaults: v.optional(ConfigDefaultsSchema, undefined),
  pricing: v.optional(PricingConfigSchema, undefined)
})

export type {
  AutoshowConfig
} from '~/cli/commands/setup-and-utilities/setup-and-utilities-types'
