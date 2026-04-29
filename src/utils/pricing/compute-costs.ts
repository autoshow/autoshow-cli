import { toArray } from '~/utils/text-utils'
import type {
  AggregatedPriceEstimate,
  Step2Metadata,
  Step3Metadata,
  Step5Metadata,
  ExtractionMetadata,
  StepCostEntry,
  ActualCostBreakdown,
  ComputeActualCostsInput,
  ComputeEstimatedCostsInput,
  EstimatedStepEntry,
  EstimatedCostBreakdown,
} from '~/types'
import {
  getExtractEstimation,
  getExtractPricing,
  getImageCost,
  getImageEstimation,
  getLlmCost,
  getLlmEstimation,
  getMusicEstimation,
  getMusicModelMeta,
  getSttEstimation,
  getTtsCost,
  getTtsEstimation,
  getTtsPricing,
  getVideoEstimation,
  getVideoModelMeta,
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeBilledSttCost } from '~/utils/pricing/stt-billing'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateVideoCosts } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import {
  computeActualAnthropicOcrCost,
  computeActualGeminiOcrCost,
  computeDeapiOcrHeuristicCost,
  DEAPI_OCR_COST_PER_1K_OUTPUT_CHARS_CENTS,
  estimateDeapiOcrOutputCharsForPages,
  OPENAI_OCR_PRICE_NOTE
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/extract-pricing'
import {
  computeSupadataActualCost,
  estimateSupadataCost,
  getSupadataCreditRateCents
} from './supadata-pricing'

export const parseDurationToSeconds = (duration: string): number => {
  if (!duration || duration === 'Unknown') return 0
  const parts = duration.split(':').map(Number)
  if (parts.length === 3) return (parts[0]! * 3600) + (parts[1]! * 60) + parts[2]!
  if (parts.length === 2) return (parts[0]! * 60) + parts[1]!
  return 0
}

const computeTtsCost = (
  service: string,
  model: string,
  characterCount: number
): {
  cost: number
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
} => {
  const pricing = getTtsPricing(service, model)
  if (
    pricing.inputCostPer1MCharsCents !== undefined
    && pricing.outputCostPer1MCharsCents !== undefined
  ) {
    return {
      cost: (characterCount / 1e6) * (pricing.inputCostPer1MCharsCents + pricing.outputCostPer1MCharsCents),
      inputCostPer1MCharactersCents: pricing.inputCostPer1MCharsCents,
      outputCostPer1MCharactersCents: pricing.outputCostPer1MCharsCents
    }
  }

  const costPer1kCharactersCents = pricing.costPer1kCharsCents ?? getTtsCost(service, model)
  return {
    cost: (characterCount / 1000) * costPer1kCharactersCents,
    costPer1kCharactersCents
  }
}

const estimateImageTargetCost = (
  target: NonNullable<ComputeEstimatedCostsInput['imageTargets']>[number],
  input: Pick<ComputeEstimatedCostsInput, 'imageSize' | 'imageQuality'>
): { provider: Step5Metadata['imageService'], model: string, imageCount: number, totalCost: number } => {
  const imageCount = Math.max(1, target.count)
  const imageSize = target.imageSize ?? input.imageSize
  const imageQuality = target.imageQuality ?? input.imageQuality
  const sharedOptions = { imageSize, imageQuality, imagenCount: imageCount }
  const estimate = (() => {
    switch (target.service) {
      case 'gemini':
        return estimateImageCosts({ ...sharedOptions, geminiImageModel: target.model })[0]
      case 'openai':
        return estimateImageCosts({ ...sharedOptions, openaiImageModel: target.model })[0]
      case 'minimax':
        return estimateImageCosts({ ...sharedOptions, minimaxImageModel: target.model })[0]
      case 'glm':
        return estimateImageCosts({ ...sharedOptions, glmImageModel: target.model })[0]
      case 'grok':
        return estimateImageCosts({ ...sharedOptions, grokImageModel: target.model })[0]
      case 'runway':
        return estimateImageCosts({ ...sharedOptions, runwayImageModel: target.model })[0]
      case 'bfl':
        return estimateImageCosts({ ...sharedOptions, bflImageModel: target.model })[0]
      case 'deapi':
        return estimateImageCosts({ ...sharedOptions, deapiImageModel: target.model })[0]
    }
  })()
  const costPerImageCents = estimate?.costPerImageCents ?? getImageCost(target.service, target.model)
  return {
    provider: target.service,
    model: target.model,
    imageCount,
    totalCost: costPerImageCents * imageCount
  }
}

const WHISPER_MODEL_PATH_PATTERN = /ggml-([a-z0-9.-]+)\.bin/i

const resolveTranscriptionModel = (metadata: Step2Metadata): string => {
  if (metadata.transcriptionService !== 'whisper') {
    return metadata.transcriptionModel
  }
  const match = metadata.transcriptionModel.match(WHISPER_MODEL_PATH_PATTERN)
  if (match && typeof match[1] === 'string' && match[1].length > 0) {
    return match[1]
  }
  return metadata.transcriptionModel
}

const isExtractionMetadata = (metadata: Step2Metadata | ExtractionMetadata): metadata is ExtractionMetadata => {
  return 'extractionMethod' in metadata
}

const resolveExtractionProviderModel = (
  metadata: ExtractionMetadata
): { provider: string, model: string } => {
  if (metadata.extractionMethod.includes('html+firecrawl')) {
    return {
      provider: 'firecrawl',
      model: 'firecrawl'
    }
  }
  if (metadata.extractionMethod.includes('html+glm-reader')) {
    return {
      provider: 'glm',
      model: 'glm-reader'
    }
  }
  if (metadata.ocrService === 'glm') {
    return {
      provider: 'glm',
      model: metadata.ocrModel ?? 'glm-ocr'
    }
  }
  if (metadata.ocrService === 'mistral') {
    return {
      provider: 'mistral',
      model: metadata.ocrModel ?? 'mistral-ocr'
    }
  }
  if (metadata.ocrService === 'openai') {
    return {
      provider: 'openai',
      model: metadata.ocrModel ?? 'gpt-5.4-nano'
    }
  }
  if (metadata.ocrService === 'anthropic') {
    return {
      provider: 'anthropic',
      model: metadata.ocrModel ?? 'claude-haiku-4-5'
    }
  }
  if (metadata.ocrService === 'gemini') {
    return {
      provider: 'gemini',
      model: metadata.ocrModel ?? 'gemini-3.1-flash-lite-preview'
    }
  }
  if (metadata.ocrService === 'deapi') {
    return {
      provider: 'deapi',
      model: metadata.ocrModel ?? 'Nanonets_Ocr_S_F16'
    }
  }
  if (metadata.extractionMethod.includes('mistral-ocr')) {
    return {
      provider: 'mistral',
      model: metadata.ocrModel ?? 'mistral-ocr'
    }
  }
  if (metadata.extractionMethod.includes('glm-ocr')) {
    return {
      provider: 'glm',
      model: metadata.ocrModel ?? 'glm-ocr'
    }
  }
  if (metadata.extractionMethod.includes('openai-ocr')) {
    return {
      provider: 'openai',
      model: metadata.ocrModel ?? 'gpt-5.4-nano'
    }
  }
  if (metadata.extractionMethod.includes('anthropic-ocr')) {
    return {
      provider: 'anthropic',
      model: metadata.ocrModel ?? 'claude-haiku-4-5'
    }
  }
  if (metadata.extractionMethod.includes('gemini-ocr')) {
    return {
      provider: 'gemini',
      model: metadata.ocrModel ?? 'gemini-3.1-flash-lite-preview'
    }
  }
  if (metadata.ocrService === 'gcloud-docai' || metadata.extractionMethod.includes('gcloud-docai')) {
    return {
      provider: 'gcloud-docai',
      model: metadata.ocrModel ?? 'ocr'
    }
  }
  if (metadata.ocrService === 'aws-textract' || metadata.extractionMethod.includes('aws-textract')) {
    return {
      provider: 'aws-textract',
      model: metadata.ocrModel ?? 'detect-text'
    }
  }
  if (metadata.extractionMethod.includes('deapi-ocr')) {
    return {
      provider: 'deapi',
      model: metadata.ocrModel ?? 'Nanonets_Ocr_S_F16'
    }
  }
  if (metadata.extractionMethod.includes('paddle-ocr')) {
    return {
      provider: 'paddle-ocr',
      model: 'paddle-ocr'
    }
  }
  if (metadata.extractionMethod.includes('ocrmypdf')) {
    return {
      provider: 'ocrmypdf',
      model: 'ocrmypdf'
    }
  }
  if (metadata.extractionMethod.includes('tesseract')) {
    return {
      provider: 'tesseract',
      model: 'tesseract'
    }
  }
  return {
    provider: 'extract',
    model: metadata.extractionMethod
  }
}

const applyCostMultiplier = (cost: number, multiplier: number): number => cost * multiplier

const computeSttCost = (service: string, model: string, durationSeconds: number): number =>
  computeBilledSttCost(service, model, durationSeconds).cost

const computeActualSttCharge = (
  metadata: Step2Metadata,
  durationSeconds: number
): { cost: number, inputMetric: string, inputValue: number } => {
  const service = metadata.transcriptionService
  const model = resolveTranscriptionModel(metadata)

  if (service === 'supadata') {
    const actual = computeSupadataActualCost(
      model,
      durationSeconds,
      metadata.billing?.creditsUsed,
      metadata.billing?.creditRateCents ?? getSupadataCreditRateCents()
    )
    return {
      cost: actual.totalCost,
      inputMetric: 'credits',
      inputValue: actual.creditsUsed
    }
  }

  if (typeof metadata.billing?.totalCost === 'number' && Number.isFinite(metadata.billing.totalCost)) {
    return {
      cost: metadata.billing.totalCost,
      inputMetric: 'durationSeconds',
      inputValue: durationSeconds
    }
  }

  return {
    cost: computeSttCost(service, model, durationSeconds),
    inputMetric: 'durationSeconds',
    inputValue: durationSeconds
  }
}

export const computeActualCosts = (input: ComputeActualCostsInput): ActualCostBreakdown => {
  const steps: StepCostEntry[] = []

  if (input.step2 && !Array.isArray(input.step2) && isExtractionMetadata(input.step2)) {
    const { provider, model } = resolveExtractionProviderModel(input.step2)
    if (provider === 'mistral') {
      const extractPricing = getExtractPricing('mistral', model)
      const costPer1kPagesCents = extractPricing.costPer1kPagesCents ?? 0
      const cost = (input.step2.totalPages / 1000) * costPer1kPagesCents
      steps.push({
        step: 'extract',
        provider: 'mistral',
        model,
        cost,
        inputMetric: 'pages',
        inputValue: input.step2.totalPages,
      })
    } else if (provider === 'firecrawl') {
      const extractPricing = getExtractPricing('firecrawl', model)
      const costPer1kPagesCents = extractPricing.costPer1kPagesCents ?? 0
      const cost = (input.step2.totalPages / 1000) * costPer1kPagesCents
      steps.push({
        step: 'extract',
        provider,
        model,
        cost,
        inputMetric: 'pages',
        inputValue: input.step2.totalPages,
      })
    } else if (provider === 'glm' && input.step2.ocrModel) {
      const extractPricing = getExtractPricing('glm', input.step2.ocrModel)
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const cost = (promptTokens / 1e6) * (extractPricing.inputCostPer1MCents ?? 0)
        + (completionTokens / 1e6) * (extractPricing.outputCostPer1MCents ?? 0)
      steps.push({
        step: 'extract',
        provider: 'glm',
        model: input.step2.ocrModel,
        cost,
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens
      })
    } else if (provider === 'openai' && input.step2.ocrModel) {
      const extractPricing = getExtractPricing('openai', input.step2.ocrModel)
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const cost = (promptTokens / 1e6) * (extractPricing.inputCostPer1MCents ?? 0)
        + (completionTokens / 1e6) * (extractPricing.outputCostPer1MCents ?? 0)
      steps.push({
        step: 'extract',
        provider: 'openai',
        model: input.step2.ocrModel,
        cost,
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens
      })
    } else if (provider === 'anthropic' && input.step2.ocrModel) {
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const cost = computeActualAnthropicOcrCost(input.step2.ocrModel, promptTokens, completionTokens).totalCost
      steps.push({
        step: 'extract',
        provider: 'anthropic',
        model: input.step2.ocrModel,
        cost,
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens
      })
    } else if (provider === 'gemini' && input.step2.ocrModel) {
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const cost = computeActualGeminiOcrCost(input.step2.ocrModel, promptTokens, completionTokens).totalCost
      steps.push({
        step: 'extract',
        provider: 'gemini',
        model: input.step2.ocrModel,
        cost,
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens
      })
    } else if (provider === 'gcloud-docai') {
      const model = input.step2.ocrModel ?? 'ocr'
      const extractPricing = getExtractPricing('gcloud-docai', model)
      const costPer1kPagesCents = extractPricing.costPer1kPagesCents ?? 0
      const cost = (input.step2.totalPages / 1000) * costPer1kPagesCents
      steps.push({
        step: 'extract',
        provider: 'gcloud-docai',
        model,
        cost,
        inputMetric: 'pages',
        inputValue: input.step2.totalPages,
      })
    } else if (provider === 'aws-textract') {
      const model = input.step2.ocrModel ?? 'detect-text'
      const extractPricing = getExtractPricing('aws-textract', model)
      const costPer1kPagesCents = extractPricing.costPer1kPagesCents ?? 0
      const cost = (input.step2.totalPages / 1000) * costPer1kPagesCents
      steps.push({
        step: 'extract',
        provider: 'aws-textract',
        model,
        cost,
        inputMetric: 'pages',
        inputValue: input.step2.totalPages,
      })
    } else if (provider === 'deapi') {
      steps.push({
        step: 'extract',
        provider: 'deapi',
        model,
        cost: typeof input.step2.providerCostCents === 'number' ? input.step2.providerCostCents : 0,
        inputMetric: 'pages',
        inputValue: input.step2.totalPages,
      })
    } else if (provider !== 'extract') {
      steps.push({
        step: 'extract',
        provider,
        model,
        cost: 0,
        inputMetric: 'pages',
        inputValue: input.step2.totalPages,
      })
    }
  }

  if (input.step1 && input.step2 && !Array.isArray(input.step2) && !isExtractionMetadata(input.step2)) {
    const durationSeconds = parseDurationToSeconds(input.step1.duration)
    const service = input.step2.transcriptionService
    const model = resolveTranscriptionModel(input.step2)
    const actual = computeActualSttCharge(input.step2, durationSeconds)

    steps.push({
      step: 'stt',
      provider: service,
      model,
      cost: actual.cost,
      inputMetric: actual.inputMetric,
      inputValue: actual.inputValue
    })
  }

  if (Array.isArray(input.step2) && input.step2.every(isExtractionMetadata)) {
    for (const step2Entry of input.step2) {
      const { provider, model } = resolveExtractionProviderModel(step2Entry)
      const promptTokens = step2Entry.promptTokens ?? 0
      const completionTokens = step2Entry.completionTokens ?? 0
      const cost = provider === 'mistral'
        ? (step2Entry.totalPages / 1000) * (getExtractPricing('mistral', model).costPer1kPagesCents ?? 0)
        : provider === 'firecrawl'
          ? (step2Entry.totalPages / 1000) * (getExtractPricing('firecrawl', model).costPer1kPagesCents ?? 0)
        : provider === 'gcloud-docai'
          ? (step2Entry.totalPages / 1000) * (getExtractPricing('gcloud-docai', model).costPer1kPagesCents ?? 0)
        : provider === 'aws-textract'
          ? (step2Entry.totalPages / 1000) * (getExtractPricing('aws-textract', model).costPer1kPagesCents ?? 0)
        : provider === 'deapi'
          ? (step2Entry.providerCostCents ?? 0)
        : provider === 'glm' && step2Entry.ocrModel
          ? (promptTokens / 1e6) * (getExtractPricing('glm', step2Entry.ocrModel).inputCostPer1MCents ?? 0)
            + (completionTokens / 1e6) * (getExtractPricing('glm', step2Entry.ocrModel).outputCostPer1MCents ?? 0)
        : provider === 'openai' && step2Entry.ocrModel
          ? (promptTokens / 1e6) * (getExtractPricing('openai', step2Entry.ocrModel).inputCostPer1MCents ?? 0)
            + (completionTokens / 1e6) * (getExtractPricing('openai', step2Entry.ocrModel).outputCostPer1MCents ?? 0)
        : provider === 'anthropic' && step2Entry.ocrModel
          ? computeActualAnthropicOcrCost(step2Entry.ocrModel, promptTokens, completionTokens).totalCost
        : provider === 'gemini' && step2Entry.ocrModel
          ? computeActualGeminiOcrCost(step2Entry.ocrModel, promptTokens, completionTokens).totalCost
          : 0
      steps.push({
        step: 'extract',
        provider,
        model,
        cost,
        inputMetric: provider === 'glm' || provider === 'openai' || provider === 'anthropic' || provider === 'gemini' ? 'tokens' : 'pages',
        inputValue: provider === 'glm' || provider === 'openai' || provider === 'anthropic' || provider === 'gemini' ? promptTokens + completionTokens : step2Entry.totalPages,
        ...(provider === 'glm' || provider === 'openai' || provider === 'anthropic' || provider === 'gemini' ? { promptTokens, completionTokens } : {})
      })
    }
  }

  if (input.step1 && Array.isArray(input.step2) && !input.step2.every(isExtractionMetadata)) {
    const durationSeconds = parseDurationToSeconds(input.step1.duration)
    for (const step2Entry of input.step2) {
      const service = step2Entry.transcriptionService
      const model = resolveTranscriptionModel(step2Entry)
      const actual = computeActualSttCharge(step2Entry, durationSeconds)
      steps.push({
        step: 'stt',
        provider: service,
        model,
        cost: actual.cost,
        inputMetric: actual.inputMetric,
        inputValue: actual.inputValue
      })
    }
  }

  for (const step3Entry of toArray(input.step3)) {
    const registryService = step3Entry.llmService === 'llama.cpp' ? 'llama' : step3Entry.llmService
    const rates = getLlmCost(registryService, step3Entry.llmModel)
    const inputCost = (step3Entry.inputTokenCount / 1e6) * (rates?.inputCostPer1MCents ?? 0)
    const outputCost = (step3Entry.outputTokenCount / 1e6) * (rates?.outputCostPer1MCents ?? 0)
    steps.push({
      step: 'llm',
      provider: step3Entry.llmService,
      model: step3Entry.llmModel,
      cost: inputCost + outputCost,
      inputMetric: 'tokens',
      inputValue: step3Entry.inputTokenCount + step3Entry.outputTokenCount
    })
  }

  const step4Array = toArray(input.step4)

  if (step4Array.length > 0 && typeof input.ttsCharacterCount === 'number') {
    for (const step4 of step4Array) {
      const ttsCost = computeTtsCost(step4.ttsService, step4.ttsModel, input.ttsCharacterCount)
      steps.push({
        step: 'tts',
        provider: step4.ttsService,
        model: step4.ttsModel,
        cost: ttsCost.cost,
        inputMetric: 'characters',
        inputValue: input.ttsCharacterCount
      })
    }
  }

  for (const step5 of toArray(input.step5)) {
    const imageCount = Math.max(1, step5.imageCount)
    const cost = typeof step5.providerCostCents === 'number'
      ? step5.providerCostCents
      : getImageCost(step5.imageService, step5.imageModel) * imageCount
    steps.push({
      step: 'image',
      provider: step5.imageService,
      model: step5.imageModel,
      cost,
      inputMetric: 'images',
      inputValue: imageCount
    })
  }

  for (const step6Entry of toArray(input.step6)) {
    const meta = getVideoModelMeta(step6Entry.videoGenService, step6Entry.videoGenModel)
    let cost = 0
    const videoDuration = step6Entry.videoDuration ?? 0
    if (meta) {
      if (meta.blockSizeSec && (meta.blockCost720pCents || meta.blockCost1080pCents)) {
        const blockCount = Math.max(1, Math.ceil(videoDuration / meta.blockSizeSec))
        cost = blockCount * (meta.blockCost720pCents ?? 0)
      } else {
        cost = ((meta.baseCostPerSecondCents ?? 0) * videoDuration) + (meta.baseJobFeeCents ?? 0)
      }
    }
    steps.push({
      step: 'video',
      provider: step6Entry.videoGenService,
      model: step6Entry.videoGenModel,
      cost,
      inputMetric: 'durationSeconds',
      inputValue: videoDuration
    })
  }

  if (input.step7) {
    for (const step7Entry of toArray(input.step7)) {
      const meta = getMusicModelMeta(step7Entry.musicService, step7Entry.musicModel)
      let cost = 0
      if (typeof step7Entry.providerCostCents === 'number') {
        cost = step7Entry.providerCostCents
      } else if (meta) {
        if (typeof meta.costPerTrackCents === 'number') {
          cost = meta.costPerTrackCents
          if (step7Entry.lyricsSource === 'generated' && typeof meta.lyricsCostPerTrackCents === 'number') {
            cost += meta.lyricsCostPerTrackCents
          }
        } else if (typeof meta.costPerMinuteCents === 'number' && typeof step7Entry.musicDurationMs === 'number') {
          cost = meta.costPerMinuteCents * (step7Entry.musicDurationMs / 60000)
        }
      }
      steps.push({
        step: 'music',
        provider: step7Entry.musicService,
        model: step7Entry.musicModel,
        cost,
        ...(typeof step7Entry.musicDurationMs === 'number'
          ? { inputMetric: 'durationMs' as const, inputValue: step7Entry.musicDurationMs }
          : { inputMetric: 'tracks' as const, inputValue: 1 })
      })
    }
  }

  const totalCost = steps.reduce((sum, s) => sum + s.cost, 0)
  return { totalCost, steps }
}

export const computeEstimatedCosts = (input: ComputeEstimatedCostsInput): EstimatedCostBreakdown => {
  const steps: EstimatedStepEntry[] = []
  let totalCost = 0
  const durationSeconds = input.audioDurationSeconds ?? 0

  const explicitSttTargets = input.sttTargets ?? []

  if (explicitSttTargets.length > 0) {
    for (const target of explicitSttTargets) {
      if (target.service === 'reverb') {
        steps.push({ step: 'stt', provider: 'reverb', model: 'reverb', cost: 0, costMultiplier: 1, durationSeconds })
        continue
      }

      if (target.service === 'supadata') {
        const estimation = getSttEstimation(target.service, target.model)
        const supadataEstimate = estimateSupadataCost(target.model, durationSeconds)
        const cost = applyCostMultiplier(supadataEstimate.totalCost, estimation.costMultiplier)
        totalCost += cost
        steps.push({
          step: 'stt',
          provider: target.service,
          model: target.model,
          cost,
          costMultiplier: estimation.costMultiplier,
          durationSeconds,
          note: supadataEstimate.note
        })
        continue
      }

      const estimation = getSttEstimation(target.service, target.model)
      const cost = applyCostMultiplier(computeSttCost(target.service, target.model, durationSeconds), estimation.costMultiplier)
      totalCost += cost
      steps.push({ step: 'stt', provider: target.service, model: target.model, cost, costMultiplier: estimation.costMultiplier, durationSeconds })
    }
  } else if (input.useReverb) {
    steps.push({ step: 'stt', provider: 'reverb', model: 'reverb', cost: 0, costMultiplier: 1, durationSeconds })
  } else {
    const STT_FIELD_MAP = [
      { field: 'gcloudSttModel' as const, provider: 'gcloud' },
      { field: 'awsSttModel' as const, provider: 'aws' },
      { field: 'deepinfraSttModel' as const, provider: 'deepinfra' },
      { field: 'deapiSttModel' as const, provider: 'deapi' },
      { field: 'elevenlabsSttModel' as const, provider: 'elevenlabs' },
      { field: 'deepgramSttModel' as const, provider: 'deepgram' },
      { field: 'sonioxSttModel' as const, provider: 'soniox' },
      { field: 'speechmaticsSttModel' as const, provider: 'speechmatics' },
      { field: 'revSttModel' as const, provider: 'rev' },
      { field: 'groqSttModel' as const, provider: 'groq' },
      { field: 'grokSttModel' as const, provider: 'grok' },
      { field: 'mistralSttModel' as const, provider: 'mistral' },
      { field: 'assemblyaiSttModel' as const, provider: 'assemblyai' },
      { field: 'gladiaSttModel' as const, provider: 'gladia' },
      { field: 'happyscribeSttModel' as const, provider: 'happyscribe' },
      { field: 'supadataSttModel' as const, provider: 'supadata' },
      { field: 'openaiSttModel' as const, provider: 'openai-stt' },
      { field: 'geminiSttModel' as const, provider: 'gemini-stt' },
      { field: 'glmSttModel' as const, provider: 'glm-stt' },
      { field: 'togetherSttModel' as const, provider: 'together' },
      { field: 'fireworksSttModel' as const, provider: 'fireworks' },
      { field: 'cloudflareSttModel' as const, provider: 'cloudflare' },
      { field: 'whisperModel' as const, provider: 'whisper' },
    ]
    for (const { field, provider } of STT_FIELD_MAP) {
      const model = input[field]
      if (typeof model === 'string' && model.length > 0) {
        const estimation = getSttEstimation(provider, model)
        if (provider === 'supadata') {
          const supadataEstimate = estimateSupadataCost(model, durationSeconds)
          const cost = applyCostMultiplier(supadataEstimate.totalCost, estimation.costMultiplier)
          totalCost += cost
          steps.push({
            step: 'stt',
            provider,
            model,
            cost,
            costMultiplier: estimation.costMultiplier,
            durationSeconds,
            note: supadataEstimate.note
          })
          break
        }

        const cost = applyCostMultiplier(computeSttCost(provider, model, durationSeconds), estimation.costMultiplier)
        totalCost += cost
        steps.push({
          step: 'stt',
          provider,
          model,
          cost,
          costMultiplier: estimation.costMultiplier,
          durationSeconds,
        })
        break
      }
    }
  }

  const extractTargets = input.extractTargets && input.extractTargets.length > 0
    ? input.extractTargets
    : [
        ...(input.mistralOcrModel && typeof input.extractPageCount === 'number'
          ? [{ provider: 'mistral' as const, model: input.mistralOcrModel, pageCount: input.extractPageCount, estimateType: 'exact' as const }]
          : []),
        ...(input.glmOcrModel && typeof input.extractPageCount === 'number'
          ? [{ provider: 'glm' as const, model: input.glmOcrModel, pageCount: input.extractPageCount, estimateType: 'heuristic' as const }]
          : []),
        ...(input.openaiOcrModel && typeof input.extractPageCount === 'number'
          ? [{
              provider: 'openai' as const,
              model: input.openaiOcrModel,
              pageCount: input.extractPageCount,
              estimateType: 'heuristic' as const,
              note: OPENAI_OCR_PRICE_NOTE
            }]
          : []),
        ...(input.anthropicOcrModel && typeof input.extractPageCount === 'number'
          ? [{
              provider: 'anthropic' as const,
              model: input.anthropicOcrModel,
              pageCount: input.extractPageCount,
              estimateType: 'heuristic' as const,
              note: 'Heuristic token estimate based on 4,000 total tokens per page. Actual Anthropic OCR cost is computed from response usage after execution, and PDF cost varies with extracted text plus page-image tokens.'
            }]
          : []),
        ...(input.geminiOcrModel && typeof input.extractPageCount === 'number'
          ? [{
              provider: 'gemini' as const,
              model: input.geminiOcrModel,
              pageCount: input.extractPageCount,
              estimateType: 'heuristic' as const
            }]
          : []),
        ...(input.deapiOcrModel && typeof input.extractPageCount === 'number'
          ? [{
              provider: 'deapi' as const,
              model: input.deapiOcrModel,
              pageCount: input.extractPageCount,
              estimateType: 'heuristic' as const,
              note: 'deAPI OCR pricing is resolved from provider quotes during execution when available.'
            }]
          : [])
      ]

  for (const target of extractTargets) {
    const estimation = getExtractEstimation(target.provider, target.model)
    if (target.provider === 'deapi') {
      const estimatedOutputChars = estimateDeapiOcrOutputCharsForPages(target.pageCount ?? input.extractPageCount ?? 1)
      const cost = typeof target.quotedCostCents === 'number'
        ? target.quotedCostCents
        : applyCostMultiplier(computeDeapiOcrHeuristicCost(estimatedOutputChars), estimation.costMultiplier)
      totalCost += cost
      steps.push({
        step: 'extract',
        provider: target.provider,
        model: target.model,
        cost,
        costMultiplier: typeof target.quotedCostCents === 'number' ? 1 : estimation.costMultiplier,
        costPer1kOutputCharsCents: DEAPI_OCR_COST_PER_1K_OUTPUT_CHARS_CENTS,
        ...(typeof target.quotedCostCents === 'number' ? {} : { estimatedOutputChars }),
        ...(typeof target.pageCount === 'number' ? { pageCount: target.pageCount } : {}),
        ...(typeof target.note === 'string' ? { note: target.note } : {}),
        estimateType: target.estimateType ?? (typeof target.quotedCostCents === 'number' ? 'exact' : 'heuristic')
      })
      continue
    }
    if (target.provider === 'mistral' || target.provider === 'firecrawl' || target.provider === 'gcloud-docai' || target.provider === 'aws-textract') {
      const extractPricing = getExtractPricing(target.provider, target.model)
      const cost = applyCostMultiplier(
        ((target.pageCount ?? input.extractPageCount ?? 0) / 1000) * (extractPricing.costPer1kPagesCents ?? 0),
        estimation.costMultiplier
      )
      totalCost += cost
      steps.push({
        step: 'extract',
        provider: target.provider,
        model: target.model,
        cost,
        costMultiplier: estimation.costMultiplier,
        ...(typeof extractPricing.costPer1kPagesCents === 'number' ? { costPer1kPagesCents: extractPricing.costPer1kPagesCents } : {}),
        ...(typeof target.pageCount === 'number' ? { pageCount: target.pageCount } : {}),
        ...(typeof target.note === 'string' ? { note: target.note } : {}),
        estimateType: target.estimateType ?? 'exact'
      })
      continue
    }

    const extractPricing = getExtractPricing(target.provider, target.model)
    const promptTokens = target.promptTokens ?? 0
    const completionTokens = target.completionTokens ?? 0
    const effectivePromptTokens = promptTokens > 0 ? promptTokens : ((target.pageCount ?? input.extractPageCount ?? 0) * 4000)
    const cost = applyCostMultiplier(
      (effectivePromptTokens / 1e6) * (extractPricing.inputCostPer1MCents ?? 0)
      + (completionTokens / 1e6) * (extractPricing.outputCostPer1MCents ?? 0),
      estimation.costMultiplier
      )
    totalCost += cost
    steps.push({
      step: 'extract',
      provider: target.provider,
      model: target.model,
      cost,
      costMultiplier: estimation.costMultiplier,
      ...(typeof extractPricing.inputCostPer1MCents === 'number' ? { inputCostPer1MCents: extractPricing.inputCostPer1MCents } : {}),
      ...(typeof extractPricing.outputCostPer1MCents === 'number' ? { outputCostPer1MCents: extractPricing.outputCostPer1MCents } : {}),
      ...(typeof target.pageCount === 'number' ? { pageCount: target.pageCount } : {}),
      promptTokens: effectivePromptTokens,
      completionTokens,
      ...(typeof target.note === 'string' ? { note: target.note } : {}),
      estimateType: target.estimateType ?? (promptTokens > 0 || completionTokens > 0 ? 'exact' : 'heuristic')
    })
  }

  const llmTargets = input.llmTargets && input.llmTargets.length > 0
    ? input.llmTargets
    : input.llmService && input.llmModel
      ? [{
          service: input.llmService as Step3Metadata['llmService'],
          model: input.llmModel,
          ...(typeof input.llmInputTokenCount === 'number' ? { inputTokens: input.llmInputTokenCount } : {}),
          ...(typeof input.llmOutputTokenCount === 'number' ? { outputTokens: input.llmOutputTokenCount } : {})
        }]
      : []

  if (!input.skipLLM) {
    for (const llmTarget of llmTargets) {
      const registryService = llmTarget.service === 'llama.cpp' ? 'llama' : llmTarget.service
      const rates = getLlmCost(registryService, llmTarget.model)
      if (!rates) {
        continue
      }

      const estimation = getLlmEstimation(registryService, llmTarget.model)
      const estimatedInputTokens = typeof llmTarget.inputTokens === 'number' ? llmTarget.inputTokens : 0
      const estimatedOutputTokens = typeof llmTarget.outputTokens === 'number' ? llmTarget.outputTokens : 0
      const cost = applyCostMultiplier(
        (estimatedInputTokens / 1_000_000) * rates.inputCostPer1MCents
        + (estimatedOutputTokens / 1_000_000) * rates.outputCostPer1MCents,
        estimation.costMultiplier
      )
      totalCost += cost
      steps.push({
        step: 'llm',
        provider: llmTarget.service,
        model: llmTarget.model,
        cost,
        costMultiplier: estimation.costMultiplier,
        inputCostPer1MCents: rates.inputCostPer1MCents,
        outputCostPer1MCents: rates.outputCostPer1MCents,
        estimatedInputTokens,
        estimatedOutputTokens
      })
    }
  }

  const ttsTargets = input.ttsTargets && input.ttsTargets.length > 0
    ? input.ttsTargets
    : input.ttsService && input.ttsModel
      ? [{ service: input.ttsService, model: input.ttsModel }]
      : []

  for (const ttsTarget of ttsTargets) {
    const resolvedTtsCharacterCount = typeof input.ttsCharacterCount === 'number' ? input.ttsCharacterCount : 0
    const ttsCost = computeTtsCost(ttsTarget.service, ttsTarget.model, resolvedTtsCharacterCount)
    const estimation = getTtsEstimation(ttsTarget.service, ttsTarget.model)
    const pricing = getTtsPricing(ttsTarget.service, ttsTarget.model)
    const hasDualRates = pricing.inputCostPer1MCharsCents !== undefined && pricing.outputCostPer1MCharsCents !== undefined
    const costPer1kCharsCents = hasDualRates ? undefined : (pricing.costPer1kCharsCents ?? getTtsCost(ttsTarget.service, ttsTarget.model))

    const cost = applyCostMultiplier(ttsCost.cost, estimation.costMultiplier)
    totalCost += cost
    steps.push({
      step: 'tts',
      provider: ttsTarget.service,
      model: ttsTarget.model,
      cost,
      costMultiplier: estimation.costMultiplier,
      ...(costPer1kCharsCents !== undefined ? { costPer1kCharactersCents: costPer1kCharsCents } : {}),
      ...(pricing.inputCostPer1MCharsCents !== undefined ? { inputCostPer1MCharactersCents: pricing.inputCostPer1MCharsCents } : {}),
      ...(pricing.outputCostPer1MCharsCents !== undefined ? { outputCostPer1MCharactersCents: pricing.outputCostPer1MCharsCents } : {})
    })
  }

  const imageEstimates = input.imageTargets && input.imageTargets.length > 0
    ? input.imageTargets.map((target) => estimateImageTargetCost(target, input))
    : estimateImageCosts({
        geminiImageModel: input.geminiImageModel,
        openaiImageModel: input.openaiImageModel,
        minimaxImageModel: input.minimaxImageModel,
        glmImageModel: input.glmImageModel,
        grokImageModel: input.grokImageModel,
        runwayImageModel: input.runwayImageModel,
        bflImageModel: input.bflImageModel,
        deapiImageModel: input.deapiImageModel,
        imageSize: input.imageSize,
        imageQuality: input.imageQuality,
        imagenCount: input.imagenCount
      })

  for (const imageEstimate of imageEstimates) {
    const estimation = getImageEstimation(imageEstimate.provider, imageEstimate.model)
    const cost = applyCostMultiplier(imageEstimate.totalCost, estimation.costMultiplier)
    totalCost += cost
    steps.push({
      step: 'image',
      provider: imageEstimate.provider,
      model: imageEstimate.model,
      cost,
      costMultiplier: estimation.costMultiplier
    })
  }

  const hasVideo = input.videoTargets?.length
    || input.geminiVideoModel
    || input.minimaxVideoModel
    || input.glmVideoModel
    || input.grokVideoModel
    || input.runwayVideoModel
    || input.deapiVideoModel
  if (hasVideo) {
    const videoEstimates = estimateVideoCosts({
      geminiVideoModels: input.videoTargets?.filter((target) => target.service === 'gemini').map((target) => target.model),
      geminiVideoModel: input.geminiVideoModel,
      minimaxVideoModels: input.videoTargets?.filter((target) => target.service === 'minimax').map((target) => target.model),
      minimaxVideoModel: input.minimaxVideoModel,
      glmVideoModels: input.videoTargets?.filter((target) => target.service === 'glm').map((target) => target.model),
      glmVideoModel: input.glmVideoModel,
      grokVideoModels: input.videoTargets?.filter((target) => target.service === 'grok').map((target) => target.model),
      grokVideoModel: input.grokVideoModel,
      runwayVideoModels: input.videoTargets?.filter((target) => target.service === 'runway').map((target) => target.model),
      runwayVideoModel: input.runwayVideoModel,
      deapiVideoModels: input.videoTargets?.filter((target) => target.service === 'deapi').map((target) => target.model),
      deapiVideoModel: input.deapiVideoModel,
      videoDuration: input.videoTargets?.find((target) => typeof target.durationSeconds === 'number')?.durationSeconds ?? input.videoDuration,
      videoSize: input.videoSize,
      videoAspectRatio: input.videoAspectRatio,
      videoResolution: input.videoResolution
    })
    for (const estimate of videoEstimates) {
      const estimation = getVideoEstimation(estimate.provider, estimate.model)
      const cost = applyCostMultiplier(estimate.totalCost, estimation.costMultiplier)
      totalCost += cost
      steps.push({ step: 'video', provider: estimate.provider, model: estimate.model, cost, costMultiplier: estimation.costMultiplier })
    }
  }

  const hasMusic = input.musicTargets?.length
    || input.elevenlabsMusicModel
    || input.minimaxMusicModel
    || input.deapiMusicModel
    || input.geminiMusicModel
  if (hasMusic) {
    const estimates = estimateMusicCosts({
      elevenlabsMusicModels: input.musicTargets?.filter((target) => target.service === 'elevenlabs').map((target) => target.model),
      elevenlabsMusicModel: input.elevenlabsMusicModel,
      minimaxMusicModels: input.musicTargets?.filter((target) => target.service === 'minimax').map((target) => target.model),
      minimaxMusicModel: input.minimaxMusicModel,
      deapiMusicModels: input.musicTargets?.filter((target) => target.service === 'deapi').map((target) => target.model),
      deapiMusicModel: input.deapiMusicModel,
      geminiMusicModels: input.musicTargets?.filter((target) => target.service === 'gemini').map((target) => target.model),
      geminiMusicModel: input.geminiMusicModel,
      musicDuration: input.musicTargets?.find((target) => typeof target.durationSeconds === 'number')?.durationSeconds ?? input.musicDuration,
      musicLyricsFile: input.musicLyricsFile,
      musicInstrumental: input.musicInstrumental
    })
    for (const estimate of estimates) {
      const estimation = getMusicEstimation(estimate.provider, estimate.model)
      const cost = applyCostMultiplier(estimate.totalCost, estimation.costMultiplier)
      totalCost += cost
      steps.push({ step: 'music', provider: estimate.provider, model: estimate.model, cost, costMultiplier: estimation.costMultiplier })
    }
  }

  return { totalCost, steps }
}

export const preflightToEstimated = (estimate: AggregatedPriceEstimate): EstimatedCostBreakdown => {
  const steps: EstimatedStepEntry[] = []

  for (const s of estimate.steps) {
    switch (s.step) {
      case 'stt':
        steps.push({
          step: 'stt',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
          durationSeconds: s.durationSeconds,
          ...(typeof s.estimateType === 'string' ? { estimateType: s.estimateType } : {}),
          ...(typeof s.note === 'string' ? { note: s.note } : {})
        })
        break
      case 'extract':
        steps.push({
          step: 'extract',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
          ...(typeof s.costPer1kPagesCents === 'number' ? { costPer1kPagesCents: s.costPer1kPagesCents } : {}),
          ...(typeof s.pageCount === 'number' ? { pageCount: s.pageCount } : {}),
          ...(typeof s.inputCostPer1MCents === 'number' ? { inputCostPer1MCents: s.inputCostPer1MCents } : {}),
          ...(typeof s.outputCostPer1MCents === 'number' ? { outputCostPer1MCents: s.outputCostPer1MCents } : {}),
          ...(typeof s.promptTokens === 'number' ? { promptTokens: s.promptTokens } : {}),
          ...(typeof s.completionTokens === 'number' ? { completionTokens: s.completionTokens } : {}),
          ...(typeof s.estimateType === 'string' ? { estimateType: s.estimateType } : {}),
          ...(typeof s.note === 'string' ? { note: s.note } : {}),
        })
        break
      case 'llm':
        steps.push({
          step: 'llm',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
          inputCostPer1MCents: s.inputCostPer1MCents,
          outputCostPer1MCents: s.outputCostPer1MCents,
          ...(typeof s.estimatedInputTokens === 'number' ? { estimatedInputTokens: s.estimatedInputTokens } : {}),
          ...(typeof s.estimatedOutputTokens === 'number' ? { estimatedOutputTokens: s.estimatedOutputTokens } : {})
        })
        break
      case 'tts':
        steps.push({
          step: 'tts',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
          ...(s.costPer1kCharactersCents !== undefined ? { costPer1kCharactersCents: s.costPer1kCharactersCents } : {}),
          ...(s.inputCostPer1MCharactersCents !== undefined ? { inputCostPer1MCharactersCents: s.inputCostPer1MCharactersCents } : {}),
          ...(s.outputCostPer1MCharactersCents !== undefined ? { outputCostPer1MCharactersCents: s.outputCostPer1MCharactersCents } : {})
        })
        break
      case 'image':
        steps.push({
          step: 'image',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
        })
        break
      case 'video':
        steps.push({
          step: 'video',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
        })
        break
      case 'music':
        steps.push({
          step: 'music',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(typeof s.costMultiplier === 'number' ? { costMultiplier: s.costMultiplier } : {}),
          ...(typeof s.note === 'string' ? { note: s.note } : {}),
        })
        break
    }
  }

  return {
    totalCost: estimate.totalEstimatedCost,
    steps
  }
}
