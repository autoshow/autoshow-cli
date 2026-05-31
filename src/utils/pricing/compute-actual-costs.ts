import {
  getExtractPricing,
  getImageCost,
  getLlmCost,
  getMusicModelMeta
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateVideoCost } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import type {
  ActualCostBreakdown,
  ComputeActualCostsInput,
  CostSource,
  ExtractionMetadata,
  Step2Metadata,
  Step5Metadata,
  Step6VideoMetadata,
  StepCostEntry
} from '~/types'
import { toArray } from '~/utils/text-utils'
import {
  computeSttCost,
  computeTtsCost,
  parseDurationToSeconds
} from './cost-helpers'
import {
  computeSupadataActualCost,
  getSupadataCreditRateCents
} from './supadata-pricing'
import {
  computeScrapeCreatorsActualCost,
  getScrapeCreatorsCreditRateCents
} from './scrapecreators-pricing'
import { resolveReverbModelLabel } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-model-labels'
import { resolveExtractionProviderModel } from '~/utils/extraction-provider-model'
import { computeTokenCost } from './token-pricing'

const WHISPER_MODEL_PATH_PATTERN = /ggml-([a-z0-9.-]+)\.bin/i

const resolveTranscriptionModel = (metadata: Step2Metadata): string => {
  if (metadata.transcriptionService === 'reverb') {
    return resolveReverbModelLabel(metadata.transcriptionModel)
  }
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

const normalizeDurationSeconds = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, value) : 0

const COST_SOURCES = new Set<CostSource>([
  'provider_usage',
  'provider_quote',
  'response_header',
  'computed_usage',
  'registry_fallback',
  'heuristic',
  'local_zero'
])

const normalizeCostSource = (value: unknown, fallback: CostSource): CostSource =>
  typeof value === 'string' && COST_SOURCES.has(value as CostSource)
    ? value as CostSource
    : fallback

const mapBillingCostSource = (source: unknown): CostSource => {
  switch (source) {
    case 'provider_usage':
    case 'provider_quote':
    case 'response_header':
      return source
    case 'response-header':
      return 'response_header'
    case 'registry_fallback':
    case 'fallback-estimate':
      return 'registry_fallback'
    case 'heuristic':
      return 'heuristic'
    default:
      return 'computed_usage'
  }
}

type TokenPricedOcrProvider = 'glm' | 'kimi' | 'openai' | 'grok' | 'anthropic' | 'gemini' | 'deepinfra'

const TOKEN_PRICED_OCR_PROVIDERS = new Set<TokenPricedOcrProvider>(['glm', 'kimi', 'openai', 'grok', 'anthropic', 'gemini', 'deepinfra'])
const LOCAL_ZERO_PROVIDERS = new Set([
  'reverb',
  'whisper',
  'youtube-captions',
  'tesseract',
  'ocrmypdf',
  'paddle-ocr',
  'llama.cpp',
  'llama',
  'kitten'
])

const zeroCostSource = (provider: string, cost: number, fallback: CostSource): CostSource =>
  cost === 0 && LOCAL_ZERO_PROVIDERS.has(provider) ? 'local_zero' : fallback

const isTokenPricedOcrProvider = (provider: string): provider is TokenPricedOcrProvider =>
  TOKEN_PRICED_OCR_PROVIDERS.has(provider as TokenPricedOcrProvider)

const computeActualTokenOcrCost = (
  provider: TokenPricedOcrProvider,
  model: string,
  promptTokens: number,
  completionTokens: number
) => {
  const pricing = getExtractPricing(provider, model)
  return computeTokenCost({
    inputCostPer1MCents: pricing.inputCostPer1MCents ?? 0,
    outputCostPer1MCents: pricing.outputCostPer1MCents ?? 0,
    ...(pricing.tokenPricingBands !== undefined ? { tokenPricingBands: pricing.tokenPricingBands } : {}),
    ...(pricing.higherContextPricing !== undefined ? { higherContextPricing: pricing.higherContextPricing } : {})
  }, promptTokens, completionTokens)
}

const resolveSttBillingDurationSeconds = (input: ComputeActualCostsInput): number => {
  if (typeof input.audioDurationSeconds === 'number') {
    return normalizeDurationSeconds(input.audioDurationSeconds)
  }

  if (typeof input.step1?.durationSeconds === 'number') {
    return normalizeDurationSeconds(input.step1.durationSeconds)
  }

  if (input.step1) {
    return normalizeDurationSeconds(parseDurationToSeconds(input.step1.duration))
  }

  return 0
}

const computeActualSttCharge = (
  metadata: Step2Metadata,
  durationSeconds: number,
  sourceUrl: string | undefined
): {
  cost: number
  costSource: CostSource
  inputMetric: string
  inputValue: number
  promptTokens?: number
  completionTokens?: number
} => {
  const service = metadata.transcriptionService
  const model = resolveTranscriptionModel(metadata)

  if (service === 'supadata') {
    const actual = computeSupadataActualCost(
      model,
      durationSeconds,
      metadata.billing?.creditsUsed,
      metadata.billing?.creditRateCents ?? getSupadataCreditRateCents(),
      { sourceUrl }
    )
    return {
      cost: actual.totalCost,
      costSource: metadata.billing?.source ? mapBillingCostSource(metadata.billing.source) : 'computed_usage',
      inputMetric: 'credits',
      inputValue: actual.creditsUsed
    }
  }

  if (service === 'scrapecreators') {
    const actual = computeScrapeCreatorsActualCost(
      metadata.billing?.creditsUsed,
      metadata.billing?.creditRateCents ?? getScrapeCreatorsCreditRateCents()
    )
    return {
      cost: actual.totalCost,
      costSource: metadata.billing?.source ? mapBillingCostSource(metadata.billing.source) : 'computed_usage',
      inputMetric: 'credits',
      inputValue: actual.creditsUsed
    }
  }

  if (typeof metadata.billing?.totalCost === 'number' && Number.isFinite(metadata.billing.totalCost)) {
    const inputTokens = metadata.billing.inputTokens
    const outputTokens = metadata.billing.outputTokens
    const totalTokens = metadata.billing.totalTokens
    if (
      typeof inputTokens === 'number'
      && Number.isFinite(inputTokens)
      && typeof outputTokens === 'number'
      && Number.isFinite(outputTokens)
    ) {
      return {
        cost: metadata.billing.totalCost,
        costSource: mapBillingCostSource(metadata.billing.source),
        inputMetric: 'tokens',
        inputValue: typeof totalTokens === 'number' && Number.isFinite(totalTokens)
          ? totalTokens
          : inputTokens + outputTokens,
        promptTokens: inputTokens,
        completionTokens: outputTokens
      }
    }

    return {
      cost: metadata.billing.totalCost,
      costSource: mapBillingCostSource(metadata.billing.source),
      inputMetric: 'durationSeconds',
      inputValue: durationSeconds
    }
  }

  return {
    cost: computeSttCost(service, model, durationSeconds),
    costSource: zeroCostSource(service, computeSttCost(service, model, durationSeconds), 'computed_usage'),
    inputMetric: 'durationSeconds',
    inputValue: durationSeconds
  }
}

const countGrokVideoInputImages = (entry: Step6VideoMetadata): number =>
  (entry.inputImage ? 1 : 0) + (entry.referenceImages?.length ?? 0)

const estimateActualVideoFallbackCost = (entry: Step6VideoMetadata): number => {
  const estimate = estimateVideoCost({
    ...(entry.videoGenService === 'gemini' ? { geminiVideoModel: entry.videoGenModel } : {}),
    ...(entry.videoGenService === 'minimax' ? { minimaxVideoModel: entry.videoGenModel } : {}),
    ...(entry.videoGenService === 'glm' ? { glmVideoModel: entry.videoGenModel } : {}),
    ...(entry.videoGenService === 'grok' ? { grokVideoModel: entry.videoGenModel } : {}),
    ...(entry.videoGenService === 'runway' ? { runwayVideoModel: entry.videoGenModel } : {}),
    ...(typeof entry.videoDuration === 'number' ? { videoDuration: entry.videoDuration } : {}),
    ...(typeof entry.videoResolution === 'string' ? { videoResolution: entry.videoResolution } : {}),
    ...(typeof entry.requestMode === 'string' ? { videoMode: entry.requestMode } : {}),
    ...(entry.videoGenService === 'grok' ? { grokInputImageCount: countGrokVideoInputImages(entry) } : {}),
    ...(entry.videoGenService === 'grok' && typeof entry.inputVideoDurationSeconds === 'number'
      ? { grokInputVideoDurationSeconds: entry.inputVideoDurationSeconds }
      : {})
  })
  return estimate.totalCost
}

const computeImageFallbackCost = (
  metadata: Step5Metadata,
  imageCount: number
): number => {
  if (
    metadata.imageService === 'openai'
    && (metadata.imageModel === 'gpt-image-1.5' || metadata.imageModel === 'gpt-image-2')
  ) {
    const estimate = estimateImageCosts({
      openaiImageModel: metadata.imageModel,
      imageSize: metadata.imageSize,
      imageQuality: metadata.imageQuality
    })[0]
    const costPerImageCents = estimate?.costPerImageCents ?? getImageCost(metadata.imageService, metadata.imageModel)
    return costPerImageCents * imageCount
  }

  return getImageCost(metadata.imageService, metadata.imageModel) * imageCount
}

const buildProviderCostExtractionEntry = (
  metadata: ExtractionMetadata,
  provider: string,
  model: string
): StepCostEntry | undefined => {
  if (typeof metadata.providerCostCents !== 'number') {
    return undefined
  }

  const promptTokens = metadata.promptTokens ?? 0
  const completionTokens = metadata.completionTokens ?? 0
  const tokenValue = promptTokens + completionTokens
  const useTokenInputs = isTokenPricedOcrProvider(provider) || tokenValue > 0
  return {
    step: 'extract',
    provider,
    model,
    cost: metadata.providerCostCents,
    costSource: normalizeCostSource(
      metadata.providerCostSource,
      Array.isArray(metadata.ocrProviderUsage) && metadata.ocrProviderUsage.length > 0
        ? 'provider_usage'
        : 'provider_quote'
    ),
    inputMetric: useTokenInputs ? 'tokens' : 'pages',
    inputValue: useTokenInputs ? tokenValue : metadata.totalPages,
    ...(useTokenInputs ? { promptTokens, completionTokens } : {})
  }
}

const tokenUsageCostSource = (metadata: ExtractionMetadata): CostSource =>
  (Array.isArray(metadata.ocrProviderUsage) && metadata.ocrProviderUsage.length > 0)
  || typeof metadata.promptTokens === 'number'
  || typeof metadata.completionTokens === 'number'
    ? 'provider_usage'
    : 'computed_usage'

export const computeActualCosts = (input: ComputeActualCostsInput): ActualCostBreakdown => {
  const steps: StepCostEntry[] = []

  if (input.step2 && !Array.isArray(input.step2) && isExtractionMetadata(input.step2)) {
    const { provider, model } = resolveExtractionProviderModel(input.step2)
    const providerCostEntry = buildProviderCostExtractionEntry(input.step2, provider, model)
    if (providerCostEntry) {
      steps.push(providerCostEntry)
    } else if (provider === 'mistral') {
      const extractPricing = getExtractPricing('mistral', model)
      const costPer1kPagesCents = extractPricing.costPer1kPagesCents ?? 0
      const cost = (input.step2.totalPages / 1000) * costPer1kPagesCents
      steps.push({
        step: 'extract',
        provider: 'mistral',
        model,
        cost,
        costSource: 'registry_fallback',
        inputMetric: 'pages',
        inputValue: input.step2.totalPages,
      })
    } else if (provider === 'firecrawl' || provider === 'glm-reader' || provider === 'spider' || provider === 'supadata' || provider === 'zyte') {
      const extractPricing = getExtractPricing(provider, model)
      const costPer1kPagesCents = extractPricing.costPer1kPagesCents ?? 0
      const cost = (input.step2.totalPages / 1000) * costPer1kPagesCents
      steps.push({
        step: 'extract',
        provider,
        model,
        cost,
        costSource: 'registry_fallback',
        inputMetric: 'pages',
        inputValue: input.step2.totalPages,
      })
    } else if (provider === 'glm' && input.step2.ocrModel) {
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const tokenCost = computeActualTokenOcrCost('glm', input.step2.ocrModel, promptTokens, completionTokens)
      steps.push({
        step: 'extract',
        provider: 'glm',
        model: input.step2.ocrModel,
        cost: tokenCost.totalCost,
        costSource: tokenUsageCostSource(input.step2),
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens,
        ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
        ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
      })
    } else if (provider === 'kimi' && input.step2.ocrModel) {
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const tokenCost = computeActualTokenOcrCost('kimi', input.step2.ocrModel, promptTokens, completionTokens)
      steps.push({
        step: 'extract',
        provider: 'kimi',
        model: input.step2.ocrModel,
        cost: tokenCost.totalCost,
        costSource: tokenUsageCostSource(input.step2),
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens,
        ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
        ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
      })
    } else if (provider === 'openai' && input.step2.ocrModel) {
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const tokenCost = computeActualTokenOcrCost('openai', input.step2.ocrModel, promptTokens, completionTokens)
      steps.push({
        step: 'extract',
        provider: 'openai',
        model: input.step2.ocrModel,
        cost: tokenCost.totalCost,
        costSource: tokenUsageCostSource(input.step2),
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens,
        ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
        ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
      })
    } else if (provider === 'grok' && input.step2.ocrModel) {
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const tokenCost = computeActualTokenOcrCost('grok', input.step2.ocrModel, promptTokens, completionTokens)
      steps.push({
        step: 'extract',
        provider: 'grok',
        model: input.step2.ocrModel,
        cost: tokenCost.totalCost,
        costSource: tokenUsageCostSource(input.step2),
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens,
        ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
        ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
      })
    } else if (provider === 'anthropic' && input.step2.ocrModel) {
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const tokenCost = computeActualTokenOcrCost('anthropic', input.step2.ocrModel, promptTokens, completionTokens)
      steps.push({
        step: 'extract',
        provider: 'anthropic',
        model: input.step2.ocrModel,
        cost: tokenCost.totalCost,
        costSource: tokenUsageCostSource(input.step2),
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens,
        ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
        ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
      })
    } else if (provider === 'gemini' && input.step2.ocrModel) {
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const tokenCost = computeActualTokenOcrCost('gemini', input.step2.ocrModel, promptTokens, completionTokens)
      steps.push({
        step: 'extract',
        provider: 'gemini',
        model: input.step2.ocrModel,
        cost: tokenCost.totalCost,
        costSource: tokenUsageCostSource(input.step2),
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens,
        ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
        ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
      })
    } else if (provider === 'deepinfra') {
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const tokenCost = computeActualTokenOcrCost('deepinfra', model, promptTokens, completionTokens)
      steps.push({
        step: 'extract',
        provider: 'deepinfra',
        model,
        cost: tokenCost.totalCost,
        costSource: tokenUsageCostSource(input.step2),
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens,
        ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
        ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
      })
    } else if (provider === 'unstructured') {
      const extractPricing = getExtractPricing('unstructured', model)
      const costPer1kPagesCents = extractPricing.costPer1kPagesCents ?? 0
      const cost = (input.step2.totalPages / 1000) * costPer1kPagesCents
      steps.push({
        step: 'extract',
        provider: 'unstructured',
        model,
        cost,
        costSource: 'registry_fallback',
        inputMetric: 'pages',
        inputValue: input.step2.totalPages,
      })
    } else if (provider !== 'extract') {
      steps.push({
        step: 'extract',
        provider,
        model,
        cost: 0,
        costSource: zeroCostSource(provider, 0, 'registry_fallback'),
        inputMetric: 'pages',
        inputValue: input.step2.totalPages,
      })
    }
  }

  if (input.step2 && !Array.isArray(input.step2) && !isExtractionMetadata(input.step2)) {
    const durationSeconds = resolveSttBillingDurationSeconds(input)
    const service = input.step2.transcriptionService
    const model = resolveTranscriptionModel(input.step2)
    const actual = computeActualSttCharge(input.step2, durationSeconds, input.step1?.url)

    steps.push({
      step: 'stt',
      provider: service,
      model,
      cost: actual.cost,
      costSource: actual.costSource,
      inputMetric: actual.inputMetric,
      inputValue: actual.inputValue,
      ...(typeof actual.promptTokens === 'number' ? { promptTokens: actual.promptTokens } : {}),
      ...(typeof actual.completionTokens === 'number' ? { completionTokens: actual.completionTokens } : {})
    })
  }

  if (Array.isArray(input.step2) && input.step2.every(isExtractionMetadata)) {
    for (const step2Entry of input.step2) {
      const { provider, model } = resolveExtractionProviderModel(step2Entry)
      const providerCostEntry = buildProviderCostExtractionEntry(step2Entry, provider, model)
      if (providerCostEntry) {
        steps.push(providerCostEntry)
        continue
      }
      const promptTokens = step2Entry.promptTokens ?? 0
      const completionTokens = step2Entry.completionTokens ?? 0
      const tokenModel = isTokenPricedOcrProvider(provider)
        ? provider === 'deepinfra'
          ? model
          : step2Entry.ocrModel
        : undefined
      const tokenCost = isTokenPricedOcrProvider(provider) && typeof tokenModel === 'string'
        ? computeActualTokenOcrCost(provider, tokenModel, promptTokens, completionTokens)
        : undefined
      const cost = provider === 'mistral'
        ? (step2Entry.totalPages / 1000) * (getExtractPricing('mistral', model).costPer1kPagesCents ?? 0)
        : provider === 'firecrawl' || provider === 'glm-reader' || provider === 'spider' || provider === 'supadata' || provider === 'zyte'
          ? (step2Entry.totalPages / 1000) * (getExtractPricing(provider, model).costPer1kPagesCents ?? 0)
        : provider === 'unstructured'
          ? (step2Entry.totalPages / 1000) * (getExtractPricing('unstructured', model).costPer1kPagesCents ?? 0)
        : tokenCost !== undefined ? tokenCost.totalCost : 0
      steps.push({
        step: 'extract',
        provider,
        model,
        cost,
        costSource: isTokenPricedOcrProvider(provider)
          ? tokenUsageCostSource(step2Entry)
          : zeroCostSource(provider, cost, 'registry_fallback'),
        inputMetric: isTokenPricedOcrProvider(provider) ? 'tokens' : 'pages',
        inputValue: isTokenPricedOcrProvider(provider) ? promptTokens + completionTokens : step2Entry.totalPages,
        ...(isTokenPricedOcrProvider(provider) ? { promptTokens, completionTokens } : {}),
        ...(typeof tokenCost?.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
        ...(typeof tokenCost?.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
      })
    }
  }

  if (Array.isArray(input.step2) && !input.step2.every(isExtractionMetadata)) {
    const durationSeconds = resolveSttBillingDurationSeconds(input)
    for (const step2Entry of input.step2) {
      const service = step2Entry.transcriptionService
      const model = resolveTranscriptionModel(step2Entry)
      const actual = computeActualSttCharge(step2Entry, durationSeconds, input.step1?.url)
      steps.push({
        step: 'stt',
        provider: service,
        model,
        cost: actual.cost,
        costSource: actual.costSource,
        inputMetric: actual.inputMetric,
        inputValue: actual.inputValue,
        ...(typeof actual.promptTokens === 'number' ? { promptTokens: actual.promptTokens } : {}),
        ...(typeof actual.completionTokens === 'number' ? { completionTokens: actual.completionTokens } : {})
      })
    }
  }

  for (const step3Entry of toArray(input.step3)) {
    const registryService = step3Entry.llmService === 'llama.cpp' ? 'llama' : step3Entry.llmService
    const rates = getLlmCost(registryService, step3Entry.llmModel)
    const tokenCost = computeTokenCost(
      rates ?? { inputCostPer1MCents: 0, outputCostPer1MCents: 0 },
      step3Entry.inputTokenCount,
      step3Entry.outputTokenCount
    )
    steps.push({
      step: 'llm',
      provider: step3Entry.llmService,
      model: step3Entry.llmModel,
      cost: tokenCost.totalCost,
      costSource: step3Entry.tokenCountSource === 'provider_usage'
        ? 'provider_usage'
        : zeroCostSource(step3Entry.llmService, tokenCost.totalCost, 'computed_usage'),
      inputMetric: 'tokens',
      inputValue: step3Entry.inputTokenCount + step3Entry.outputTokenCount,
      promptTokens: step3Entry.inputTokenCount,
      completionTokens: step3Entry.outputTokenCount,
      ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
      ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
    })
  }

  const step4Array = toArray(input.step4)

  if (step4Array.length > 0 && typeof input.ttsCharacterCount === 'number') {
    for (const step4 of step4Array) {
      const ttsCost = computeTtsCost(step4.ttsService, step4.ttsModel, input.ttsCharacterCount)
      const cloneCost = typeof step4.cloneCostCents === 'number' ? step4.cloneCostCents : 0
      steps.push({
        step: 'tts',
        provider: step4.ttsService,
        model: step4.ttsModel,
        cost: ttsCost.cost + cloneCost,
        costSource: zeroCostSource(step4.ttsService, ttsCost.cost + cloneCost, 'computed_usage'),
        inputMetric: 'characters',
        inputValue: input.ttsCharacterCount
      })
    }
  }

  for (const step5 of toArray(input.step5)) {
    const imageCount = Math.max(1, step5.imageCount)
    const cost = typeof step5.providerCostCents === 'number'
      ? step5.providerCostCents
      : computeImageFallbackCost(step5, imageCount)
    steps.push({
      step: 'image',
      provider: step5.imageService,
      model: step5.imageModel,
      cost,
      costSource: typeof step5.providerCostCents === 'number'
        ? normalizeCostSource(step5.providerCostSource, 'provider_quote')
        : 'registry_fallback',
      inputMetric: 'images',
      inputValue: imageCount
    })
  }

  for (const step6Entry of toArray(input.step6)) {
    const videoDuration = step6Entry.videoDuration ?? 0
    const cost = typeof step6Entry.providerCostCents === 'number'
      ? step6Entry.providerCostCents
      : estimateActualVideoFallbackCost(step6Entry)
    steps.push({
      step: 'video',
      provider: step6Entry.videoGenService,
      model: step6Entry.videoGenModel,
      cost,
      costSource: typeof step6Entry.providerCostCents === 'number'
        ? normalizeCostSource(step6Entry.providerCostSource, 'provider_quote')
        : 'registry_fallback',
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
        costSource: typeof step7Entry.providerCostCents === 'number'
          ? normalizeCostSource(step7Entry.providerCostSource, 'provider_quote')
          : 'registry_fallback',
        ...(typeof step7Entry.musicDurationMs === 'number'
          ? { inputMetric: 'durationMs' as const, inputValue: step7Entry.musicDurationMs }
          : { inputMetric: 'tracks' as const, inputValue: 1 })
      })
    }
  }

  const totalCost = steps.reduce((sum, s) => sum + s.cost, 0)
  return { totalCost, steps }
}
