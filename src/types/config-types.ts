import * as v from 'valibot'

const ModelArraySchema = v.optional(v.array(v.string()), undefined)

const PricingConfigSchema = v.strictObject({
  maxCents: v.optional(v.pipe(v.number(), v.minValue(0)), undefined)
})

const SttDefaultsSchema = v.strictObject({
  whisper: ModelArraySchema,
  gcloudStt: ModelArraySchema,
  awsStt: ModelArraySchema,
  groqStt: ModelArraySchema,
  elevenlabsStt: ModelArraySchema,
  deepgramStt: ModelArraySchema,
  sonioxStt: ModelArraySchema,
  revStt: ModelArraySchema,
  mistralStt: ModelArraySchema,
  assemblyaiStt: ModelArraySchema,
  gladiaStt: ModelArraySchema,
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
  grok: ModelArraySchema
})

const TtsDefaultsSchema = v.strictObject({
  kittenTts: ModelArraySchema,
  elevenlabsTts: ModelArraySchema,
  minimaxTts: ModelArraySchema,
  groqTts: ModelArraySchema,
  openaiTts: ModelArraySchema,
  geminiTts: ModelArraySchema,
  ttsSpeaker: v.optional(v.string(), undefined),
  groqVoice: v.optional(v.string(), undefined),
  openaiVoice: v.optional(v.string(), undefined),
  geminiVoice: v.optional(v.string(), undefined),
  elevenlabsVoice: v.optional(v.string(), undefined),
  minimaxTtsVoice: v.optional(v.string(), undefined)
})

const ImageDefaultsSchema = v.strictObject({
  geminiImage: ModelArraySchema,
  openaiImage: ModelArraySchema,
  minimaxImage: ModelArraySchema,
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
  videoDuration: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  videoSize: v.optional(v.string(), undefined),
  videoAspectRatio: v.optional(v.string(), undefined),
  videoResolution: v.optional(v.string(), undefined)
})

const MusicDefaultsSchema = v.strictObject({
  elevenlabsMusic: ModelArraySchema,
  minimaxMusic: ModelArraySchema,
  musicDuration: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const ExtractDefaultsSchema = v.strictObject({
  lang: v.optional(v.string(), undefined),
  out: v.optional(v.picklist(['text', 'json', 'tsv', 'hocr']), undefined),
  dpi: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  psm: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), undefined),
  oem: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), undefined),
  rotate: v.optional(v.pipe(v.number(), v.integer()), undefined),
  mistralOcr: ModelArraySchema,
  glmOcr: ModelArraySchema,
  openaiOcr: ModelArraySchema,
  anthropicOcr: ModelArraySchema,
  geminiOcr: ModelArraySchema,
  chapters: v.optional(v.boolean(), undefined),
  length: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  pdfChapterMode: v.optional(v.picklist(['local', 'auto', 'llm']), undefined)
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
  stt: v.optional(SttDefaultsSchema, undefined),
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

export type AutoshowConfig = v.InferOutput<typeof AutoshowConfigSchema>
export type ConfigDefaults = NonNullable<AutoshowConfig['defaults']>
export type PricingConfig = NonNullable<AutoshowConfig['pricing']>
