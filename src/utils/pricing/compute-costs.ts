import { toArray } from '~/utils/text-utils'
import type {
  Step1Metadata,
  Step2Metadata,
  Step3Metadata,
  Step4Metadata,
  Step5Metadata,
  Step6VideoMetadata,
  Step7MusicMetadata,
  ExtractionMetadata,
  StepCostEntry,
  ActualCostBreakdown,
  EstimatedStepEntry,
  EstimatedCostBreakdown,
  AggregatedPriceEstimate
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
  getSttCost,
  getSttEstimation,
  getTtsCost,
  getTtsEstimation,
  getTtsPricing,
  getVideoEstimation,
  getVideoModelMeta,
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateVideoCosts } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'

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

const WHISPER_MODEL_PATH_PATTERN = /ggml-([a-z0-9.-]+)\.bin/i

const resolveTranscriptionModel = (metadata: Step2Metadata): string => {
  if (typeof metadata.transcriptionModelName === 'string' && metadata.transcriptionModelName.length > 0) {
    return metadata.transcriptionModelName
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

const computeSttHourlyCost = (service: string, model: string, durationSeconds: number): number => {
  const sttCost = getSttCost(service, model)
  return (durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
}

type ComputeActualCostsInput = {
  step1?: Step1Metadata | undefined
  step2?: Step2Metadata | Step2Metadata[] | ExtractionMetadata | ExtractionMetadata[] | undefined
  step3?: Step3Metadata | Step3Metadata[] | undefined
  step4?: Step4Metadata | Step4Metadata[] | undefined
  step5?: Step5Metadata | Step5Metadata[] | undefined
  step6?: Step6VideoMetadata | Step6VideoMetadata[] | undefined
  step7?: Step7MusicMetadata | Step7MusicMetadata[] | undefined
  ttsCharacterCount?: number | undefined
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
    let cost = 0

    cost = computeSttHourlyCost(service, model, durationSeconds)

    steps.push({
      step: 'stt',
      provider: service,
      model,
      cost,
      inputMetric: 'durationSeconds',
      inputValue: durationSeconds
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
        : provider === 'glm' && step2Entry.ocrModel
          ? (promptTokens / 1e6) * (getExtractPricing('glm', step2Entry.ocrModel).inputCostPer1MCents ?? 0)
            + (completionTokens / 1e6) * (getExtractPricing('glm', step2Entry.ocrModel).outputCostPer1MCents ?? 0)
          : 0
      steps.push({
        step: 'extract',
        provider,
        model,
        cost,
        inputMetric: provider === 'glm' ? 'tokens' : 'pages',
        inputValue: provider === 'glm' ? promptTokens + completionTokens : step2Entry.totalPages,
        ...(provider === 'glm' ? { promptTokens, completionTokens } : {})
      })
    }
  }

  if (input.step1 && Array.isArray(input.step2) && !input.step2.every(isExtractionMetadata)) {
    const durationSeconds = parseDurationToSeconds(input.step1.duration)
    for (const step2Entry of input.step2) {
      const service = step2Entry.transcriptionService
      const model = resolveTranscriptionModel(step2Entry)
      steps.push({
        step: 'stt',
        provider: service,
        model,
        cost: computeSttHourlyCost(service, model, durationSeconds),
        inputMetric: 'durationSeconds',
        inputValue: durationSeconds
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
    const cost = getImageCost(step5.imageService, step5.imageModel) * imageCount
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
      if (meta) {
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

type ComputeEstimatedCostsInput = {
  sttTargets?: Array<{ service: Step2Metadata['transcriptionService'], model: string }> | undefined
  whisperModel?: string | undefined
  groqSttModel?: string | undefined
  elevenlabsSttModel?: string | undefined
  deepgramSttModel?: string | undefined
  sonioxSttModel?: string | undefined
  speechmaticsSttModel?: string | undefined
  revSttModel?: string | undefined
  openaiSttModel?: string | undefined
  mistralSttModel?: string | undefined
  assemblyaiSttModel?: string | undefined
  mistralOcrModel?: string | undefined
  glmOcrModel?: string | undefined
  extractTargets?: Array<{
    provider: 'mistral' | 'glm' | 'firecrawl'
    model: string
    pageCount?: number
    promptTokens?: number
    completionTokens?: number
    estimateType?: 'heuristic' | 'exact'
    note?: string
  }> | undefined
  extractPageCount?: number | undefined
  useReverb?: boolean | undefined
  audioDurationSeconds?: number | undefined
  llmService?: string | undefined
  llmModel?: string | undefined
  llmInputTokenCount?: number | undefined
  llmOutputTokenCount?: number | undefined
  skipLLM?: boolean | undefined
  ttsTargets?: Array<{ service: string, model: string }> | undefined
  ttsService?: string | undefined
  ttsModel?: string | undefined
  ttsCharacterCount?: number | undefined
  imageTargets?: Array<{ service: Step5Metadata['imageService'], model: string, count: number }> | undefined
  geminiImageModel?: string | undefined
  openaiImageModel?: string | undefined
  minimaxImageModel?: string | undefined
  imagenCount?: number | undefined
  geminiVideoModel?: string | undefined
  minimaxVideoModel?: string | undefined
  videoDuration?: number | undefined
  videoSize?: string | undefined
  videoResolution?: string | undefined
  elevenlabsMusicModel?: string | undefined
  minimaxMusicModel?: string | undefined
  musicDuration?: number | undefined
  musicLyricsFile?: string | undefined
  musicInstrumental?: boolean | undefined
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

      const estimation = getSttEstimation(target.service, target.model)
      const cost = applyCostMultiplier(computeSttHourlyCost(target.service, target.model, durationSeconds), estimation.costMultiplier)
      totalCost += cost
      steps.push({ step: 'stt', provider: target.service, model: target.model, cost, costMultiplier: estimation.costMultiplier, durationSeconds })
    }
  } else if (input.useReverb) {
    steps.push({ step: 'stt', provider: 'reverb', model: 'reverb', cost: 0, costMultiplier: 1, durationSeconds })
  } else {
    const STT_FIELD_MAP = [
      { field: 'elevenlabsSttModel' as const, provider: 'elevenlabs' },
      { field: 'deepgramSttModel' as const, provider: 'deepgram' },
      { field: 'sonioxSttModel' as const, provider: 'soniox' },
      { field: 'speechmaticsSttModel' as const, provider: 'speechmatics' },
      { field: 'revSttModel' as const, provider: 'rev' },
      { field: 'groqSttModel' as const, provider: 'groq' },
      { field: 'openaiSttModel' as const, provider: 'openai' },
      { field: 'mistralSttModel' as const, provider: 'mistral' },
      { field: 'assemblyaiSttModel' as const, provider: 'assemblyai' },
      { field: 'whisperModel' as const, provider: 'whisper' },
    ]
    for (const { field, provider } of STT_FIELD_MAP) {
      const model = input[field]
      if (typeof model === 'string' && model.length > 0) {
        const estimation = getSttEstimation(provider, model)
        const cost = applyCostMultiplier(computeSttHourlyCost(provider, model, durationSeconds), estimation.costMultiplier)
        totalCost += cost
        steps.push({ step: 'stt', provider, model, cost, costMultiplier: estimation.costMultiplier, durationSeconds })
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
          : [])
      ]

  for (const target of extractTargets) {
    const estimation = getExtractEstimation(target.provider, target.model)
    if (target.provider === 'mistral' || target.provider === 'firecrawl') {
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

    const extractPricing = getExtractPricing('glm', target.model)
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
      provider: 'glm',
      model: target.model,
      cost,
      costMultiplier: estimation.costMultiplier,
      ...(typeof extractPricing.inputCostPer1MCents === 'number' ? { inputCostPer1MCents: extractPricing.inputCostPer1MCents } : {}),
      ...(typeof extractPricing.outputCostPer1MCents === 'number' ? { outputCostPer1MCents: extractPricing.outputCostPer1MCents } : {}),
      ...(typeof target.pageCount === 'number' ? { pageCount: target.pageCount } : {}),
      promptTokens: effectivePromptTokens,
      completionTokens,
      estimateType: target.estimateType ?? (promptTokens > 0 || completionTokens > 0 ? 'exact' : 'heuristic')
    })
  }

  if (!input.skipLLM && input.llmService && input.llmModel) {
    const registryService = input.llmService === 'llama.cpp' ? 'llama' : input.llmService
    const rates = getLlmCost(registryService, input.llmModel)
    if (rates) {
      const estimation = getLlmEstimation(registryService, input.llmModel)
      const estimatedInputTokens = typeof input.llmInputTokenCount === 'number' ? input.llmInputTokenCount : 0
      const estimatedOutputTokens = typeof input.llmOutputTokenCount === 'number' ? input.llmOutputTokenCount : 0
      const cost = applyCostMultiplier(
        (estimatedInputTokens / 1_000_000) * rates.inputCostPer1MCents
        + (estimatedOutputTokens / 1_000_000) * rates.outputCostPer1MCents,
        estimation.costMultiplier
      )
      totalCost += cost
      steps.push({
        step: 'llm',
        provider: input.llmService,
        model: input.llmModel,
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
    ? input.imageTargets.map((target) => {
        const costPerImageCents = getImageCost(target.service, target.model)
        return {
          provider: target.service,
          model: target.model,
          imageCount: Math.max(1, target.count),
          totalCost: costPerImageCents * Math.max(1, target.count)
        }
      })
    : estimateImageCosts({
        geminiImageModel: input.geminiImageModel,
        openaiImageModel: input.openaiImageModel,
        minimaxImageModel: input.minimaxImageModel,
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

  const videoEstimates = estimateVideoCosts({
    geminiVideoModel: input.geminiVideoModel,
    minimaxVideoModel: input.minimaxVideoModel,
    videoDuration: input.videoDuration,
    videoSize: input.videoSize,
    videoResolution: input.videoResolution
  })
  for (const estimate of videoEstimates) {
    const estimation = getVideoEstimation(estimate.provider, estimate.model)
    const cost = applyCostMultiplier(estimate.totalCost, estimation.costMultiplier)
    totalCost += cost
    steps.push({ step: 'video', provider: estimate.provider, model: estimate.model, cost, costMultiplier: estimation.costMultiplier })
  }

  const hasMusic = input.elevenlabsMusicModel || input.minimaxMusicModel
  if (hasMusic) {
    const estimates = estimateMusicCosts({
      elevenlabsMusicModel: input.elevenlabsMusicModel,
      minimaxMusicModel: input.minimaxMusicModel,
      musicDuration: input.musicDuration,
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
          durationSeconds: s.durationSeconds
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
        })
        break
    }
  }

  return {
    totalCost: estimate.totalEstimatedCost,
    steps
  }
}
