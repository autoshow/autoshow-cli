import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as v from 'valibot'
import { validateData } from '~/utils/validate/validation'
import type { ModelRegistry } from '~/types'
export type { ModelRegistry } from '~/types'

const SttEstimationSchema = v.object({
  costMultiplier: v.optional(v.number(), undefined),
  msPerSecond: v.optional(v.number(), undefined)
})

const SttBillingSchema = v.object({
  roundingIncrementSeconds: v.optional(v.number(), undefined),
  minimumSeconds: v.optional(v.number(), undefined)
})

const SttLimitsSchema = v.object({
  effectiveBytes: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  directUploadBytes: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  remoteUrlBytes: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  durationSeconds: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  notes: v.optional(v.string(), undefined)
})

const SttModelSchema = v.object({
  description: v.string(),
  costPerHourUSD: v.optional(v.number(), undefined),
  costPerHourCents: v.optional(v.number(), undefined),
  costPerThreeHours: v.optional(v.number(), undefined),
  billing: v.optional(SttBillingSchema, undefined),
  estimation: v.optional(SttEstimationSchema, undefined),
  limits: v.optional(SttLimitsSchema, undefined)
})

const SttServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  models: v.record(v.string(), SttModelSchema)
})

const ExtractLimitsSchema = v.object({
  effectiveBytes: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  imageBytes: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  pdfBytes: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  pageCount: v.optional(v.pipe(v.number(), v.minValue(1)), undefined),
  notes: v.optional(v.string(), undefined)
})

const ExtractModelSchema = v.object({
  description: v.string(),
  costPer1kPagesUSD: v.optional(v.number(), undefined),
  costPer1kPagesCents: v.optional(v.number(), undefined),
  costPerMInputTokensUSD: v.optional(v.number(), undefined),
  costPerMInputTokensCents: v.optional(v.number(), undefined),
  costPerMOutputTokensUSD: v.optional(v.number(), undefined),
  costPerMOutputTokensCents: v.optional(v.number(), undefined),
  limits: v.optional(ExtractLimitsSchema, undefined),
  estimation: v.optional(v.object({
    costMultiplier: v.optional(v.number(), undefined),
    msPerPage: v.optional(v.number(), undefined)
  }), undefined)
})

const ExtractServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  models: v.record(v.string(), ExtractModelSchema)
})

const LlmModelSchema = v.object({
  description: v.string(),
  inputCostPer1MUSD: v.number(),
  inputCostPer1MCents: v.number(),
  outputCostPer1MUSD: v.number(),
  outputCostPer1MCents: v.number(),
  hfDownloadRepo: v.optional(v.string(), undefined),
  estimation: v.optional(v.object({
    costMultiplier: v.optional(v.number(), undefined),
    msPer1KTokens: v.optional(v.number(), undefined)
  }), undefined)
})

const LlmServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  maxTokens: v.optional(v.number(), undefined),
  models: v.record(v.string(), LlmModelSchema)
})

const TtsModelSchema = v.object({
  description: v.string(),
  costPer1kCharsUSD: v.optional(v.number(), undefined),
  costPer1kCharsCents: v.optional(v.number(), undefined),
  inputCostPer1MCharsUSD: v.optional(v.number(), undefined),
  inputCostPer1MCharsCents: v.optional(v.number(), undefined),
  outputCostPer1MCharsUSD: v.optional(v.number(), undefined),
  outputCostPer1MCharsCents: v.optional(v.number(), undefined),
  hfRepo: v.optional(v.string(), undefined),
  modelFamily: v.optional(v.string(), undefined),
  estimation: v.optional(v.object({
    costMultiplier: v.optional(v.number(), undefined),
    msPer1KChars: v.optional(v.number(), undefined)
  }), undefined)
})

const TtsServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  pythonVersion: v.optional(v.string(), undefined),
  speakers: v.optional(v.array(v.string()), undefined),
  languages: v.optional(v.array(v.string()), undefined),
  voices: v.optional(v.array(v.string()), undefined),
  models: v.record(v.string(), TtsModelSchema)
})

const ImageModelSchema = v.object({
  description: v.string(),
  costPerImageUSD: v.number(),
  costPerImageCents: v.number(),
  nativeGeminiImage: v.optional(v.boolean(), undefined),
  estimation: v.optional(v.object({
    costMultiplier: v.optional(v.number(), undefined),
    msPerImage: v.optional(v.number(), undefined)
  }), undefined)
})

const ImageServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  models: v.record(v.string(), ImageModelSchema)
})

const MusicModelSchema = v.object({
  description: v.string(),
  costPerTrackUSD: v.optional(v.number(), undefined),
  costPerTrackCents: v.optional(v.number(), undefined),
  costPerMinuteUSD: v.optional(v.number(), undefined),
  costPerMinuteCents: v.optional(v.number(), undefined),
  lyricsCostPerTrackUSD: v.optional(v.number(), undefined),
  lyricsCostPerTrackCents: v.optional(v.number(), undefined),
  estimation: v.optional(v.object({
    costMultiplier: v.optional(v.number(), undefined),
    msPerSecond: v.optional(v.number(), undefined)
  }), undefined)
})

const MusicServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  models: v.record(v.string(), MusicModelSchema)
})

const VideoModelSchema = v.object({
  description: v.string(),
  baseCostPerSecondUSD: v.optional(v.number(), undefined),
  baseCostPerSecondCents: v.optional(v.number(), undefined),
  baseJobFeeUSD: v.optional(v.number(), undefined),
  baseJobFeeCents: v.optional(v.number(), undefined),
  largeSizeMultiplier: v.optional(v.number(), undefined),
  standardSizeMultiplier: v.optional(v.number(), undefined),
  resolutionMultiplier1080p: v.optional(v.number(), undefined),
  blockSizeSec: v.optional(v.number(), undefined),
  blockCost720pUSD: v.optional(v.number(), undefined),
  blockCost720pCents: v.optional(v.number(), undefined),
  blockCost1080pUSD: v.optional(v.number(), undefined),
  blockCost1080pCents: v.optional(v.number(), undefined),
  estimation: v.optional(v.object({
    costMultiplier: v.optional(v.number(), undefined),
    msPerSecond: v.optional(v.number(), undefined)
  }), undefined)
})

const VideoServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  sizes: v.optional(v.array(v.string()), undefined),
  resolutions: v.optional(v.array(v.string()), undefined),
  billedDurations: v.optional(v.array(v.number()), undefined),
  models: v.record(v.string(), VideoModelSchema)
})

const SttRegistrySchema = v.record(v.string(), SttServiceSchema)
const LlmRegistrySchema = v.record(v.string(), LlmServiceSchema)
const TtsRegistrySchema = v.record(v.string(), TtsServiceSchema)
const ImageRegistrySchema = v.record(v.string(), ImageServiceSchema)
const MusicRegistrySchema = v.record(v.string(), MusicServiceSchema)
const VideoRegistrySchema = v.record(v.string(), VideoServiceSchema)
const ExtractRegistrySchema = v.record(v.string(), ExtractServiceSchema)

export const ModelRegistrySchema = v.object({
  stt: SttRegistrySchema,
  extract: ExtractRegistrySchema,
  llm: LlmRegistrySchema,
  tts: TtsRegistrySchema,
  image: ImageRegistrySchema,
  music: MusicRegistrySchema,
  video: VideoRegistrySchema
})


const STT_PATH = resolve(import.meta.dir, 'stt-config.json')
const OCR_PATH = resolve(import.meta.dir, 'ocr-config.json')
const LLM_PATH = resolve(import.meta.dir, 'llm-config.json')
const TTS_PATH = resolve(import.meta.dir, 'tts-config.json')
const IMAGE_PATH = resolve(import.meta.dir, 'image-config.json')
const MUSIC_PATH = resolve(import.meta.dir, 'music-config.json')
const VIDEO_PATH = resolve(import.meta.dir, 'video-config.json')

let cached: ModelRegistry | undefined

const DEFAULT_COST_MULTIPLIER = 1
const DEFAULT_STT_MS_PER_SECOND = {
  api: 900,
  local: 100,
}
const DEFAULT_EXTRACT_MS_PER_PAGE = 3500
const DEFAULT_LLM_MS_PER_1K_TOKENS = {
  api: 18_000,
  local: 65_000,
}
const DEFAULT_TTS_MS_PER_1K_CHARS = {
  api: 10_000,
  local: 5_000,
}
const DEFAULT_IMAGE_MS_PER_IMAGE = 12_000
const DEFAULT_VIDEO_MS_PER_SECOND = 12_000
const DEFAULT_MUSIC_MS_PER_SECOND = 4_000

export const MODEL_CONFIG_PATHS = {
  stt: STT_PATH,
  extract: OCR_PATH,
  llm: LLM_PATH,
  tts: TTS_PATH,
  image: IMAGE_PATH,
  music: MUSIC_PATH,
  video: VIDEO_PATH,
} as const

export type CostEstimation = {
  costMultiplier: number
}

export type SttEstimation = CostEstimation & {
  msPerSecond: number
}

export type SttBilling = {
  roundingIncrementSeconds?: number
  minimumSeconds?: number
}

export type SttLimits = v.InferOutput<typeof SttLimitsSchema>
export type ExtractLimits = v.InferOutput<typeof ExtractLimitsSchema>

export type ExtractEstimation = CostEstimation & {
  msPerPage: number
}

export type LlmEstimation = CostEstimation & {
  msPer1KTokens: number
}

export type TtsEstimation = CostEstimation & {
  msPer1KChars: number
}

export type ImageEstimation = CostEstimation & {
  msPerImage: number
}

export type MusicEstimation = CostEstimation & {
  msPerSecond: number
}

export type VideoEstimation = CostEstimation & {
  msPerSecond: number
}

export const getModelRegistry = (): ModelRegistry => {
  if (cached) return cached

  const stt = validateData(SttRegistrySchema, JSON.parse(readFileSync(STT_PATH, 'utf-8')), `STT models at ${STT_PATH}`)
  const extract = validateData(ExtractRegistrySchema, JSON.parse(readFileSync(OCR_PATH, 'utf-8')), `extract models at ${OCR_PATH}`)
  const llm = validateData(LlmRegistrySchema, JSON.parse(readFileSync(LLM_PATH, 'utf-8')), `LLM models at ${LLM_PATH}`)
  const tts = validateData(TtsRegistrySchema, JSON.parse(readFileSync(TTS_PATH, 'utf-8')), `TTS models at ${TTS_PATH}`)
  const image = validateData(ImageRegistrySchema, JSON.parse(readFileSync(IMAGE_PATH, 'utf-8')), `image models at ${IMAGE_PATH}`)
  const music = validateData(MusicRegistrySchema, JSON.parse(readFileSync(MUSIC_PATH, 'utf-8')), `music models at ${MUSIC_PATH}`)
  const video = validateData(VideoRegistrySchema, JSON.parse(readFileSync(VIDEO_PATH, 'utf-8')), `video models at ${VIDEO_PATH}`)

  cached = { stt, extract, llm, tts, image, music, video }
  return cached
}


export const getServiceModels = (
  step: keyof ModelRegistry,
  service: string
): string[] => {
  const registry = getModelRegistry()
  const svc = registry[step][service]
  if (!svc) return []
  return Object.keys(svc.models)
}

const getRegistryServiceType = (
  step: keyof ModelRegistry,
  service: string
): 'local' | 'api' | undefined => {
  return getModelRegistry()[step][service]?.type
}


export const getSttCost = (
  service: string,
  model: string
): { costPerHourCents?: number, costPerThreeHoursCents?: number } => {
  const sttModel = getModelRegistry().stt[service]?.models[model]
  if (!sttModel) return {}
  return {
    ...(sttModel.costPerHourCents !== undefined
      ? { costPerHourCents: sttModel.costPerHourCents }
      : sttModel.costPerHourUSD !== undefined
        ? { costPerHourCents: sttModel.costPerHourUSD * 100 }
        : {}),
    ...(sttModel.costPerThreeHours !== undefined ? { costPerThreeHoursCents: sttModel.costPerThreeHours * 100 } : {})
  }
}

export const getSttBilling = (service: string, model: string): SttBilling => {
  const billing = getModelRegistry().stt[service]?.models[model]?.billing
  return {
    ...(billing?.roundingIncrementSeconds !== undefined
      ? { roundingIncrementSeconds: billing.roundingIncrementSeconds }
      : {}),
    ...(billing?.minimumSeconds !== undefined
      ? { minimumSeconds: billing.minimumSeconds }
      : {})
  }
}

export const getSttLimits = (service: string, model: string): SttLimits => {
  const limits = getModelRegistry().stt[service]?.models[model]?.limits
  const effectiveBytes = limits?.effectiveBytes ?? limits?.directUploadBytes ?? limits?.remoteUrlBytes

  return {
    ...(effectiveBytes !== undefined ? { effectiveBytes } : {}),
    ...(limits?.directUploadBytes !== undefined ? { directUploadBytes: limits.directUploadBytes } : {}),
    ...(limits?.remoteUrlBytes !== undefined ? { remoteUrlBytes: limits.remoteUrlBytes } : {}),
    ...(limits?.durationSeconds !== undefined ? { durationSeconds: limits.durationSeconds } : {}),
    ...(limits?.notes !== undefined ? { notes: limits.notes } : {})
  }
}

export const getSttEstimation = (service: string, model: string): SttEstimation => {
  const serviceType = getRegistryServiceType('stt', service) ?? 'api'
  const modelMeta = getModelRegistry().stt[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPerSecond: modelMeta?.estimation?.msPerSecond ?? DEFAULT_STT_MS_PER_SECOND[serviceType],
  }
}

export const getExtractPricing = (
  service: string,
  model: string
): {
  costPer1kPagesCents?: number
  inputCostPer1MCents?: number
  outputCostPer1MCents?: number
} => {
  const extractModel = getModelRegistry().extract[service]?.models[model]
  if (!extractModel) return {}
  return {
    ...(extractModel.costPer1kPagesCents !== undefined
      ? { costPer1kPagesCents: extractModel.costPer1kPagesCents }
      : extractModel.costPer1kPagesUSD !== undefined
        ? { costPer1kPagesCents: extractModel.costPer1kPagesUSD * 100 }
        : {}),
    ...(extractModel.costPerMInputTokensCents !== undefined
      ? { inputCostPer1MCents: extractModel.costPerMInputTokensCents }
      : extractModel.costPerMInputTokensUSD !== undefined
        ? { inputCostPer1MCents: extractModel.costPerMInputTokensUSD * 100 }
        : {}),
    ...(extractModel.costPerMOutputTokensCents !== undefined
      ? { outputCostPer1MCents: extractModel.costPerMOutputTokensCents }
      : extractModel.costPerMOutputTokensUSD !== undefined
        ? { outputCostPer1MCents: extractModel.costPerMOutputTokensUSD * 100 }
        : {})
  }
}

export const getExtractLimits = (
  service: string,
  model: string,
  format?: string
): ExtractLimits => {
  const limits = getModelRegistry().extract[service]?.models[model]?.limits
  const normalizedFormat = format?.toLowerCase()
  const effectiveBytes = limits?.effectiveBytes
    ?? (normalizedFormat === 'pdf'
      ? limits?.pdfBytes
      : normalizedFormat === 'png' || normalizedFormat === 'jpg' || normalizedFormat === 'tif' || normalizedFormat === 'webp' || normalizedFormat === 'bmp' || normalizedFormat === 'gif'
        ? limits?.imageBytes
        : undefined)

  return {
    ...(effectiveBytes !== undefined ? { effectiveBytes } : {}),
    ...(limits?.imageBytes !== undefined ? { imageBytes: limits.imageBytes } : {}),
    ...(limits?.pdfBytes !== undefined ? { pdfBytes: limits.pdfBytes } : {}),
    ...(limits?.pageCount !== undefined ? { pageCount: limits.pageCount } : {}),
    ...(limits?.notes !== undefined ? { notes: limits.notes } : {})
  }
}

export const getExtractEstimation = (service: string, model: string): ExtractEstimation => {
  const modelMeta = getModelRegistry().extract[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPerPage: modelMeta?.estimation?.msPerPage ?? DEFAULT_EXTRACT_MS_PER_PAGE,
  }
}

export const isGroqSttModel = (model: string): boolean => {
  return getModelRegistry().stt['groq']?.models[model] !== undefined
}


export const getLlmCost = (
  service: string,
  model: string
): { inputCostPer1MCents: number, outputCostPer1MCents: number } | undefined => {
  const llmModel = getModelRegistry().llm[service]?.models[model]
  if (!llmModel) return undefined
  return {
    inputCostPer1MCents: llmModel.inputCostPer1MCents,
    outputCostPer1MCents: llmModel.outputCostPer1MCents
  }
}

export const getLlmEstimation = (service: string, model: string): LlmEstimation => {
  const serviceType = getRegistryServiceType('llm', service) ?? 'api'
  const modelMeta = getModelRegistry().llm[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPer1KTokens: modelMeta?.estimation?.msPer1KTokens ?? DEFAULT_LLM_MS_PER_1K_TOKENS[serviceType],
  }
}

export const getLlamaDownloadRepo = (model: string): string | undefined => {
  return getModelRegistry().llm['llama']?.models[model]?.hfDownloadRepo
}


export const getTtsPricing = (
  service: string,
  model: string
): { costPer1kCharsCents?: number, inputCostPer1MCharsCents?: number, outputCostPer1MCharsCents?: number } => {
  const ttsModel = getModelRegistry().tts[service]?.models[model]
  if (!ttsModel) return {}
  return {
    ...(ttsModel.costPer1kCharsCents !== undefined
      ? { costPer1kCharsCents: ttsModel.costPer1kCharsCents }
      : ttsModel.costPer1kCharsUSD !== undefined
        ? { costPer1kCharsCents: ttsModel.costPer1kCharsUSD * 100 }
        : {}),
    ...(ttsModel.inputCostPer1MCharsCents !== undefined
      ? { inputCostPer1MCharsCents: ttsModel.inputCostPer1MCharsCents }
      : ttsModel.inputCostPer1MCharsUSD !== undefined
        ? { inputCostPer1MCharsCents: ttsModel.inputCostPer1MCharsUSD * 100 }
        : {}),
    ...(ttsModel.outputCostPer1MCharsCents !== undefined
      ? { outputCostPer1MCharsCents: ttsModel.outputCostPer1MCharsCents }
      : ttsModel.outputCostPer1MCharsUSD !== undefined
        ? { outputCostPer1MCharsCents: ttsModel.outputCostPer1MCharsUSD * 100 }
        : {})
  }
}

export const getTtsEstimation = (service: string, model: string): TtsEstimation => {
  const serviceType = getRegistryServiceType('tts', service) ?? 'api'
  const modelMeta = getModelRegistry().tts[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPer1KChars: modelMeta?.estimation?.msPer1KChars ?? DEFAULT_TTS_MS_PER_1K_CHARS[serviceType],
  }
}

export const getTtsCost = (service: string, model: string): number => {
  const pricing = getTtsPricing(service, model)
  if (pricing.costPer1kCharsCents !== undefined) return pricing.costPer1kCharsCents
  if (pricing.outputCostPer1MCharsCents !== undefined) return pricing.outputCostPer1MCharsCents / 1000
  return 0
}

export const getKittenHfRepo = (model: string): string | undefined => {
  return getModelRegistry().tts['kitten']?.models[model]?.hfRepo
}

export const getKittenVoices = (): readonly string[] => {
  return getModelRegistry().tts['kitten']?.voices ?? []
}

export const getGroqTtsVoices = (): readonly string[] => {
  return getModelRegistry().tts['groq']?.voices ?? []
}


export const getImageCost = (service: string, model: string): number => {
  const imageModel = getModelRegistry().image[service]?.models[model]
  if (!imageModel) return 0
  if (typeof imageModel.costPerImageCents === 'number') return imageModel.costPerImageCents
  return imageModel.costPerImageUSD * 100
}

export const getImageEstimation = (service: string, model: string): ImageEstimation => {
  const modelMeta = getModelRegistry().image[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPerImage: modelMeta?.estimation?.msPerImage ?? DEFAULT_IMAGE_MS_PER_IMAGE,
  }
}

export const isNativeGeminiImage = (model: string): boolean => {
  return getModelRegistry().image['gemini']?.models[model]?.nativeGeminiImage === true
}

export const getMusicModelMeta = (service: string, model: string): v.InferOutput<typeof MusicModelSchema> | undefined => {
  return getModelRegistry().music[service]?.models[model]
}

export const getMusicEstimation = (service: string, model: string): MusicEstimation => {
  const modelMeta = getModelRegistry().music[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPerSecond: modelMeta?.estimation?.msPerSecond ?? DEFAULT_MUSIC_MS_PER_SECOND,
  }
}


export const getVideoModelMeta = (service: string, model: string): v.InferOutput<typeof VideoModelSchema> | undefined => {
  return getModelRegistry().video[service]?.models[model]
}

export const getVideoEstimation = (service: string, model: string): VideoEstimation => {
  const modelMeta = getModelRegistry().video[service]?.models[model]
  return {
    costMultiplier: modelMeta?.estimation?.costMultiplier ?? DEFAULT_COST_MULTIPLIER,
    msPerSecond: modelMeta?.estimation?.msPerSecond ?? DEFAULT_VIDEO_MS_PER_SECOND,
  }
}
