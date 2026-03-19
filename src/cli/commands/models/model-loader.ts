import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as v from 'valibot'
import { validateData } from '~/utils/validate/validation'
import type { ModelRegistry } from '~/types'
export type { ModelRegistry } from '~/types'

const SttModelSchema = v.object({
  description: v.string(),
  costPerHourUSD: v.optional(v.number(), undefined),
  costPerHourCents: v.optional(v.number(), undefined),
  costPerThreeHours: v.optional(v.number(), undefined)
})

const SttServiceSchema = v.object({
  description: v.string(),
  type: v.picklist(['local', 'api']),
  models: v.record(v.string(), SttModelSchema)
})

const ExtractModelSchema = v.object({
  description: v.string(),
  costPer1kPagesUSD: v.optional(v.number(), undefined),
  costPer1kPagesCents: v.optional(v.number(), undefined)
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
  hfDownloadRepo: v.optional(v.string(), undefined)
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
  modelFamily: v.optional(v.string(), undefined)
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
  nativeGeminiImage: v.optional(v.boolean(), undefined)
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
  lyricsCostPerTrackCents: v.optional(v.number(), undefined)
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
  blockCost1080pCents: v.optional(v.number(), undefined)
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
const EXTRACT_PATH = resolve(import.meta.dir, 'extract-config.json')
const LLM_PATH = resolve(import.meta.dir, 'llm-config.json')
const TTS_PATH = resolve(import.meta.dir, 'tts-config.json')
const IMAGE_PATH = resolve(import.meta.dir, 'image-config.json')
const MUSIC_PATH = resolve(import.meta.dir, 'music-config.json')
const VIDEO_PATH = resolve(import.meta.dir, 'video-config.json')

let cached: ModelRegistry | undefined

export const getModelRegistry = (): ModelRegistry => {
  if (cached) return cached

  const stt = validateData(SttRegistrySchema, JSON.parse(readFileSync(STT_PATH, 'utf-8')), `STT models at ${STT_PATH}`)
  const extract = validateData(ExtractRegistrySchema, JSON.parse(readFileSync(EXTRACT_PATH, 'utf-8')), `extract models at ${EXTRACT_PATH}`)
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

export const getExtractPricing = (service: string, model: string): { costPer1kPagesCents?: number } => {
  const extractModel = getModelRegistry().extract[service]?.models[model]
  if (!extractModel) return {}
  return {
    ...(extractModel.costPer1kPagesCents !== undefined
      ? { costPer1kPagesCents: extractModel.costPer1kPagesCents }
      : extractModel.costPer1kPagesUSD !== undefined
        ? { costPer1kPagesCents: extractModel.costPer1kPagesUSD * 100 }
        : {})
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

export const isNativeGeminiImage = (model: string): boolean => {
  return getModelRegistry().image['gemini']?.models[model]?.nativeGeminiImage === true
}

export const getMusicModelMeta = (service: string, model: string): v.InferOutput<typeof MusicModelSchema> | undefined => {
  return getModelRegistry().music[service]?.models[model]
}


export const getVideoModelMeta = (service: string, model: string): v.InferOutput<typeof VideoModelSchema> | undefined => {
  return getModelRegistry().video[service]?.models[model]
}
