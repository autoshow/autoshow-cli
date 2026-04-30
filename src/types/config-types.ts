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
  openaiStt: ModelArraySchema,
  geminiStt: ModelArraySchema,
  glmStt: ModelArraySchema,
  supadataLang: v.optional(v.string(), undefined),
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
  runwayTts: ModelArraySchema,
  deapiTts: ModelArraySchema,
  deapiTtsVoice: v.optional(v.string(), undefined),
  deapiTtsRefAudio: v.optional(v.string(), undefined),
  deapiTtsRefText: v.optional(v.string(), undefined),
  runwayTtsVoice: v.optional(v.string(), undefined),
  ttsSpeaker: v.optional(v.string(), undefined),
  groqVoice: v.optional(v.string(), undefined),
  grokTtsVoice: v.optional(v.string(), undefined),
  mistralTtsVoice: v.optional(v.string(), undefined),
  mistralTtsRefAudio: v.optional(v.string(), undefined),
  openaiVoice: v.optional(v.string(), undefined),
  openaiTtsRefAudio: v.optional(v.string(), undefined),
  openaiTtsConsentId: v.optional(v.string(), undefined),
  openaiTtsConsentAudio: v.optional(v.string(), undefined),
  openaiTtsConsentLanguage: v.optional(v.string(), undefined),
  openaiTtsConsentName: v.optional(v.string(), undefined),
  openaiTtsVoiceName: v.optional(v.string(), undefined),
  geminiVoice: v.optional(v.string(), undefined),
  deepgramVoice: v.optional(v.string(), undefined),
  geminiSpeaker1Name: v.optional(v.string(), undefined),
  geminiSpeaker1Voice: v.optional(v.string(), undefined),
  geminiSpeaker2Name: v.optional(v.string(), undefined),
  geminiSpeaker2Voice: v.optional(v.string(), undefined),
  elevenlabsVoice: v.optional(v.string(), undefined),
  minimaxTtsVoice: v.optional(v.string(), undefined),
  minimaxTtsRefAudio: v.optional(v.string(), undefined),
  minimaxTtsPromptAudio: v.optional(v.string(), undefined),
  minimaxTtsPromptText: v.optional(v.string(), undefined),
  minimaxTtsCloneNoiseReduction: v.optional(v.boolean(), undefined),
  minimaxTtsCloneVolumeNormalization: v.optional(v.boolean(), undefined)
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
  imagenCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const VideoDefaultsSchema = v.strictObject({
  geminiVideo: ModelArraySchema,
  minimaxVideo: ModelArraySchema,
  glmVideo: ModelArraySchema,
  grokVideo: ModelArraySchema,
  runwayVideo: ModelArraySchema,
  videoDuration: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  videoSize: v.optional(v.string(), undefined),
  videoAspectRatio: v.optional(v.string(), undefined),
  videoResolution: v.optional(v.string(), undefined)
})

const MusicDefaultsSchema = v.strictObject({
  elevenlabsMusic: ModelArraySchema,
  minimaxMusic: ModelArraySchema,
  deapiMusic: ModelArraySchema,
  musicDuration: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
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
  deapiOcr: ModelArraySchema,
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
  version: v.literal(2),
  defaults: v.optional(ConfigDefaultsSchema, undefined),
  pricing: v.optional(PricingConfigSchema, undefined)
})

export type {
  AutoshowConfig
} from '~/cli/commands/setup-and-utilities/setup-and-utilities-types'
