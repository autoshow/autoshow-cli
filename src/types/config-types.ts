import * as v from 'valibot'

const PricingConfigSchema = v.object({
  maxCents: v.optional(v.pipe(v.number(), v.minValue(0)), undefined),
  maxUsd: v.optional(v.pipe(v.number(), v.minValue(0)), undefined)
})

const SttDefaultsSchema = v.object({
  whisper: v.optional(v.string(), undefined),
  groqStt: v.optional(v.string(), undefined),
  elevenlabsStt: v.optional(v.string(), undefined),
  deepgramStt: v.optional(v.string(), undefined),
  sonioxStt: v.optional(v.string(), undefined),
  revStt: v.optional(v.string(), undefined),
  openaiStt: v.optional(v.string(), undefined),
  mistralStt: v.optional(v.string(), undefined),
  assemblyaiStt: v.optional(v.string(), undefined),
  gladiaStt: v.optional(v.string(), undefined),
  speechmaticsStt: v.optional(v.string(), undefined),
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

const LlmDefaultsSchema = v.object({
  llama: v.optional(v.string(), undefined),
  openai: v.optional(v.string(), undefined),
  groq: v.optional(v.string(), undefined),
  gemini: v.optional(v.string(), undefined),
  anthropic: v.optional(v.string(), undefined),
  minimax: v.optional(v.string(), undefined)
})

const TtsDefaultsSchema = v.object({
  kittenTts: v.optional(v.string(), undefined),
  elevenlabsTts: v.optional(v.string(), undefined),
  minimaxTts: v.optional(v.string(), undefined),
  groqTts: v.optional(v.string(), undefined),
  openaiTts: v.optional(v.string(), undefined),
  geminiTts: v.optional(v.string(), undefined),
  ttsSpeaker: v.optional(v.string(), undefined),
  groqVoice: v.optional(v.string(), undefined),
  openaiVoice: v.optional(v.string(), undefined),
  geminiVoice: v.optional(v.string(), undefined),
  elevenlabsVoice: v.optional(v.string(), undefined),
  minimaxTtsVoice: v.optional(v.string(), undefined)
})

const ImageDefaultsSchema = v.object({
  geminiImage: v.optional(v.string(), undefined),
  openaiImage: v.optional(v.string(), undefined),
  minimaxImage: v.optional(v.string(), undefined),
  imageAspectRatio: v.optional(v.string(), undefined),
  imageSize: v.optional(v.string(), undefined),
  imageQuality: v.optional(v.string(), undefined),
  imageFormat: v.optional(v.string(), undefined),
  imageBackground: v.optional(v.string(), undefined),
  imagenCount: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const VideoDefaultsSchema = v.object({
  geminiVideo: v.optional(v.string(), undefined),
  minimaxVideo: v.optional(v.string(), undefined),
  videoDuration: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  videoSize: v.optional(v.string(), undefined),
  videoAspectRatio: v.optional(v.string(), undefined),
  videoResolution: v.optional(v.string(), undefined)
})

const MusicDefaultsSchema = v.object({
  elevenlabsMusic: v.optional(v.string(), undefined),
  minimaxMusic: v.optional(v.string(), undefined),
  musicDuration: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const ExtractDefaultsSchema = v.object({
  lang: v.optional(v.string(), undefined),
  out: v.optional(v.picklist(['text', 'json', 'tsv', 'hocr']), undefined),
  dpi: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  psm: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), undefined),
  oem: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0)), undefined),
  rotate: v.optional(v.pipe(v.number(), v.integer()), undefined),
  mistralOcr: v.optional(v.string(), undefined),
  glmOcr: v.optional(v.string(), undefined)
})

const BatchDefaultsSchema = v.object({
  limit: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined),
  order: v.optional(v.picklist(['newest', 'oldest']), undefined),
  concurrency: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1)), undefined)
})

const PostDefaultsSchema = v.object({
  tts: v.optional(TtsDefaultsSchema, undefined),
  image: v.optional(ImageDefaultsSchema, undefined),
  video: v.optional(VideoDefaultsSchema, undefined),
  music: v.optional(MusicDefaultsSchema, undefined)
})

const ConfigDefaultsSchema = v.object({
  stt: v.optional(SttDefaultsSchema, undefined),
  llm: v.optional(LlmDefaultsSchema, undefined),
  post: v.optional(PostDefaultsSchema, undefined),
  extract: v.optional(ExtractDefaultsSchema, undefined),
  batch: v.optional(BatchDefaultsSchema, undefined),
  prompts: v.optional(v.array(v.string()), undefined)
})

export const AutoshowConfigSchema = v.object({
  version: v.literal(2),
  defaults: v.optional(ConfigDefaultsSchema, undefined),
  pricing: v.optional(PricingConfigSchema, undefined)
})

export type AutoshowConfig = v.InferOutput<typeof AutoshowConfigSchema>
export type ConfigDefaults = NonNullable<AutoshowConfig['defaults']>
export type PricingConfig = NonNullable<AutoshowConfig['pricing']>
