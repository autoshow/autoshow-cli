import {
  getExtractPricing,
  getImageCost,
  getLlmCost,
  getMusicModelMeta,
  getVideoModelMeta
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import {
  computeActualAnthropicOcrCost,
  computeActualDeepinfraOcrCost,
  computeActualGeminiOcrCost,
  computeActualGrokOcrCost,
  computeActualKimiOcrCost
} from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/extract-pricing'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import type {
  ActualCostBreakdown,
  ComputeActualCostsInput,
  CostSource,
  ExtractionMetadata,
  Step2Metadata,
  Step5Metadata,
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

const TOKEN_PRICED_OCR_PROVIDERS = new Set(['glm', 'kimi', 'openai', 'grok', 'anthropic', 'gemini', 'deepinfra'])
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

const resolveExtractionProviderModel = (
  metadata: ExtractionMetadata
): { provider: string, model: string } => {
  if (metadata.extractionMethod.includes('html+defuddle')) {
    return {
      provider: 'defuddle',
      model: 'defuddle'
    }
  }
  if (metadata.extractionMethod.includes('html+firecrawl')) {
    return {
      provider: 'firecrawl',
      model: 'firecrawl'
    }
  }
  if (metadata.extractionMethod.includes('html+glm-reader')) {
    return {
      provider: 'glm-reader',
      model: 'glm-reader'
    }
  }
  if (metadata.extractionMethod.includes('html+spider')) {
    return {
      provider: 'spider',
      model: 'spider'
    }
  }
  if (metadata.extractionMethod.includes('html+supadata')) {
    return {
      provider: 'supadata',
      model: 'supadata'
    }
  }
  if (metadata.extractionMethod.includes('html+zyte')) {
    return {
      provider: 'zyte',
      model: 'zyte'
    }
  }

  if (typeof metadata.ocrService === 'string' && typeof metadata.ocrModel === 'string') {
    return {
      provider: metadata.ocrService,
      model: metadata.ocrModel
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

const computeActualSttCharge = (
  metadata: Step2Metadata,
  durationSeconds: number,
  sourceUrl: string | undefined
): { cost: number, costSource: CostSource, inputMetric: string, inputValue: number } => {
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

const computeImageFallbackCost = (
  metadata: Step5Metadata,
  imageCount: number
): number => {
  if (metadata.imageService === 'openai' && metadata.imageModel === 'gpt-image-2') {
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
  const useTokenInputs = TOKEN_PRICED_OCR_PROVIDERS.has(provider) || tokenValue > 0
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
        costSource: tokenUsageCostSource(input.step2),
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens
      })
    } else if (provider === 'kimi' && input.step2.ocrModel) {
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const cost = computeActualKimiOcrCost(input.step2.ocrModel, promptTokens, completionTokens).totalCost
      steps.push({
        step: 'extract',
        provider: 'kimi',
        model: input.step2.ocrModel,
        cost,
        costSource: tokenUsageCostSource(input.step2),
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
        costSource: tokenUsageCostSource(input.step2),
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens
      })
    } else if (provider === 'grok' && input.step2.ocrModel) {
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const cost = computeActualGrokOcrCost(input.step2.ocrModel, promptTokens, completionTokens).totalCost
      steps.push({
        step: 'extract',
        provider: 'grok',
        model: input.step2.ocrModel,
        cost,
        costSource: tokenUsageCostSource(input.step2),
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
        costSource: tokenUsageCostSource(input.step2),
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
        costSource: tokenUsageCostSource(input.step2),
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens
      })
    } else if (provider === 'deepinfra') {
      const promptTokens = input.step2.promptTokens ?? 0
      const completionTokens = input.step2.completionTokens ?? 0
      const cost = computeActualDeepinfraOcrCost(model, promptTokens, completionTokens).totalCost
      steps.push({
        step: 'extract',
        provider: 'deepinfra',
        model,
        cost,
        costSource: tokenUsageCostSource(input.step2),
        inputMetric: 'tokens',
        inputValue: promptTokens + completionTokens,
        promptTokens,
        completionTokens
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
      inputValue: actual.inputValue
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
      const cost = provider === 'mistral'
        ? (step2Entry.totalPages / 1000) * (getExtractPricing('mistral', model).costPer1kPagesCents ?? 0)
        : provider === 'firecrawl' || provider === 'glm-reader' || provider === 'spider' || provider === 'supadata' || provider === 'zyte'
          ? (step2Entry.totalPages / 1000) * (getExtractPricing(provider, model).costPer1kPagesCents ?? 0)
        : provider === 'unstructured'
          ? (step2Entry.totalPages / 1000) * (getExtractPricing('unstructured', model).costPer1kPagesCents ?? 0)
        : provider === 'glm' && step2Entry.ocrModel
          ? (promptTokens / 1e6) * (getExtractPricing('glm', step2Entry.ocrModel).inputCostPer1MCents ?? 0)
            + (completionTokens / 1e6) * (getExtractPricing('glm', step2Entry.ocrModel).outputCostPer1MCents ?? 0)
        : provider === 'kimi' && step2Entry.ocrModel
          ? computeActualKimiOcrCost(step2Entry.ocrModel, promptTokens, completionTokens).totalCost
        : provider === 'openai' && step2Entry.ocrModel
          ? (promptTokens / 1e6) * (getExtractPricing('openai', step2Entry.ocrModel).inputCostPer1MCents ?? 0)
            + (completionTokens / 1e6) * (getExtractPricing('openai', step2Entry.ocrModel).outputCostPer1MCents ?? 0)
        : provider === 'grok' && step2Entry.ocrModel
          ? computeActualGrokOcrCost(step2Entry.ocrModel, promptTokens, completionTokens).totalCost
        : provider === 'anthropic' && step2Entry.ocrModel
          ? computeActualAnthropicOcrCost(step2Entry.ocrModel, promptTokens, completionTokens).totalCost
        : provider === 'gemini' && step2Entry.ocrModel
          ? computeActualGeminiOcrCost(step2Entry.ocrModel, promptTokens, completionTokens).totalCost
        : provider === 'deepinfra'
          ? computeActualDeepinfraOcrCost(model, promptTokens, completionTokens).totalCost
          : 0
      steps.push({
        step: 'extract',
        provider,
        model,
        cost,
        costSource: TOKEN_PRICED_OCR_PROVIDERS.has(provider)
          ? tokenUsageCostSource(step2Entry)
          : zeroCostSource(provider, cost, 'registry_fallback'),
        inputMetric: TOKEN_PRICED_OCR_PROVIDERS.has(provider) ? 'tokens' : 'pages',
        inputValue: TOKEN_PRICED_OCR_PROVIDERS.has(provider) ? promptTokens + completionTokens : step2Entry.totalPages,
        ...(TOKEN_PRICED_OCR_PROVIDERS.has(provider) ? { promptTokens, completionTokens } : {})
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
      costSource: step3Entry.tokenCountSource === 'provider_usage'
        ? 'provider_usage'
        : zeroCostSource(step3Entry.llmService, inputCost + outputCost, 'computed_usage'),
      inputMetric: 'tokens',
      inputValue: step3Entry.inputTokenCount + step3Entry.outputTokenCount,
      promptTokens: step3Entry.inputTokenCount,
      completionTokens: step3Entry.outputTokenCount
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
    const meta = getVideoModelMeta(step6Entry.videoGenService, step6Entry.videoGenModel)
    let cost = 0
    const videoDuration = step6Entry.videoDuration ?? 0
    if (typeof step6Entry.providerCostCents === 'number') {
      cost = step6Entry.providerCostCents
    } else if (meta) {
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
