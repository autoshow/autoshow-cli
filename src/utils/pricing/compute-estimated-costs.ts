import {
  getExtractEstimation,
  getExtractPricing,
  getImageCost,
  getImageEstimation,
  getLlmCost,
  getLlmEstimation,
  getMusicEstimation,
  getTtsCost,
  getTtsEstimation,
  getTtsPricing,
  getVideoEstimation
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import { estimateOcrTokenUsage } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/extract-pricing'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import { estimateVideoCosts } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import type {
  ComputeEstimatedCostsInput,
  EstimatedCostBreakdown,
  EstimatedStepEntry,
  Step3Metadata,
  Step5Metadata
} from '~/types'
import {
  applyCostMultiplier,
  computeSttCost,
  computeTtsCost
} from './cost-helpers'
import { estimateSupadataCost } from './supadata-pricing'
import { estimateScrapeCreatorsCost } from './scrapecreators-pricing'
import { computeTokenCost } from './token-pricing'

const estimateImageTargetCost = (
  target: NonNullable<ComputeEstimatedCostsInput['imageTargets']>[number],
  input: Pick<ComputeEstimatedCostsInput, 'imageSize' | 'imageQuality'>
): { provider: Step5Metadata['imageService'], model: string, imageCount: number, totalCost: number } => {
  const imageCount = Math.max(1, target.count)
  const imageSize = target.imageSize ?? input.imageSize
  const imageQuality = target.imageQuality ?? input.imageQuality
  const sharedOptions = { imageSize, imageQuality, imageCount }
  const estimate = (() => {
    switch (target.service) {
      case 'gemini':
        return estimateImageCosts({ ...sharedOptions, geminiImageModel: target.model })[0]
      case 'openai':
        return estimateImageCosts({ ...sharedOptions, openaiImageModel: target.model })[0]
      case 'grok':
        return estimateImageCosts({ ...sharedOptions, grokImageModel: target.model })[0]
      case 'bfl':
        return estimateImageCosts({ ...sharedOptions, bflImageModel: target.model })[0]
      case 'reve':
        return estimateImageCosts({ ...sharedOptions, reveImageModel: target.model })[0]
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

const resolveCostMultiplier = (
  input: ComputeEstimatedCostsInput,
  multiplier: number
): number => input.applyCostMultipliers === false ? 1 : multiplier

const EXACT_COST_MULTIPLIER = 1

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
        const supadataEstimate = estimateSupadataCost(target.model, durationSeconds, { sourceUrl: input.sourceUrl })
        const cost = supadataEstimate.totalCost
        totalCost += cost
        steps.push({
          step: 'stt',
          provider: target.service,
          model: target.model,
          cost,
          costMultiplier: EXACT_COST_MULTIPLIER,
          durationSeconds
        })
        continue
      }

      if (target.service === 'scrapecreators') {
        const scrapeCreatorsEstimate = estimateScrapeCreatorsCost()
        const cost = scrapeCreatorsEstimate.totalCost
        totalCost += cost
        steps.push({
          step: 'stt',
          provider: target.service,
          model: target.model,
          cost,
          costMultiplier: EXACT_COST_MULTIPLIER,
          durationSeconds: 0
        })
        continue
      }

      const cost = computeSttCost(target.service, target.model, durationSeconds)
      totalCost += cost
      steps.push({ step: 'stt', provider: target.service, model: target.model, cost, costMultiplier: EXACT_COST_MULTIPLIER, durationSeconds })
    }
  } else if (input.useReverb) {
    steps.push({ step: 'stt', provider: 'reverb', model: 'reverb', cost: 0, costMultiplier: 1, durationSeconds })
  } else {
    const STT_FIELD_MAP = [
      { field: 'deepinfraSttModel' as const, provider: 'deepinfra' },
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
      { field: 'scrapecreatorsSttModel' as const, provider: 'scrapecreators' },
      { field: 'openaiSttModel' as const, provider: 'openai-stt' },
      { field: 'geminiSttModel' as const, provider: 'gemini-stt' },
      { field: 'glmSttModel' as const, provider: 'glm-stt' },
      { field: 'togetherSttModel' as const, provider: 'together' },
      { field: 'whisperModel' as const, provider: 'whisper' },
    ]
    for (const { field, provider } of STT_FIELD_MAP) {
      const model = input[field]
      if (typeof model === 'string' && model.length > 0) {
        if (provider === 'supadata') {
          const supadataEstimate = estimateSupadataCost(model, durationSeconds, { sourceUrl: input.sourceUrl })
          const cost = supadataEstimate.totalCost
          totalCost += cost
          steps.push({
            step: 'stt',
            provider,
            model,
            cost,
            costMultiplier: EXACT_COST_MULTIPLIER,
            durationSeconds
          })
          break
        }

        if (provider === 'scrapecreators') {
          const scrapeCreatorsEstimate = estimateScrapeCreatorsCost()
          const cost = scrapeCreatorsEstimate.totalCost
          totalCost += cost
          steps.push({
            step: 'stt',
            provider,
            model,
            cost,
            costMultiplier: EXACT_COST_MULTIPLIER,
            durationSeconds: 0
          })
          break
        }

        const cost = computeSttCost(provider, model, durationSeconds)
        totalCost += cost
        steps.push({
          step: 'stt',
          provider,
          model,
          cost,
          costMultiplier: EXACT_COST_MULTIPLIER,
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
          ? [{
              provider: 'glm' as const,
              model: input.glmOcrModel,
              pageCount: input.extractPageCount,
              estimateType: 'heuristic' as const
            }]
          : []),
        ...(input.kimiOcrModel && typeof input.extractPageCount === 'number'
          ? [{
              provider: 'kimi' as const,
              model: input.kimiOcrModel,
              pageCount: input.extractPageCount,
              estimateType: 'heuristic' as const
            }]
          : []),
        ...(input.openaiOcrModel && typeof input.extractPageCount === 'number'
          ? [{
              provider: 'openai' as const,
              model: input.openaiOcrModel,
              pageCount: input.extractPageCount,
              estimateType: 'heuristic' as const
            }]
          : []),
        ...(input.grokOcrModel && typeof input.extractPageCount === 'number'
          ? [{
              provider: 'grok' as const,
              model: input.grokOcrModel,
              pageCount: input.extractPageCount,
              estimateType: 'heuristic' as const
            }]
          : []),
        ...(input.anthropicOcrModel && typeof input.extractPageCount === 'number'
          ? [{
              provider: 'anthropic' as const,
              model: input.anthropicOcrModel,
              pageCount: input.extractPageCount,
              estimateType: 'heuristic' as const
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
        ...(input.deepinfraOcrModel && typeof input.extractPageCount === 'number'
          ? [{
              provider: 'deepinfra' as const,
              model: input.deepinfraOcrModel,
              pageCount: input.extractPageCount,
              estimateType: 'heuristic' as const
            }]
          : []),
        ...(input.unstructuredOcrModel && typeof input.extractPageCount === 'number'
          ? [{
              provider: 'unstructured' as const,
              model: input.unstructuredOcrModel,
              pageCount: input.extractPageCount,
              estimateType: 'exact' as const
            }]
          : []),
      ]

  for (const target of extractTargets) {
    const estimation = getExtractEstimation(target.provider, target.model)
    const costMultiplier = resolveCostMultiplier(input, estimation.costMultiplier)
    if (
      target.provider === 'defuddle'
      || target.provider === 'mistral'
      || target.provider === 'firecrawl'
      || target.provider === 'glm-reader'
      || target.provider === 'spider'
      || target.provider === 'supadata'
      || target.provider === 'zyte'
      || target.provider === 'unstructured'
    ) {
      const extractPricing = getExtractPricing(target.provider, target.model)
      const cost = applyCostMultiplier(
        ((target.pageCount ?? input.extractPageCount ?? 0) / 1000) * (extractPricing.costPer1kPagesCents ?? 0),
        costMultiplier
      )
      totalCost += cost
      steps.push({
        step: 'extract',
        provider: target.provider,
        model: target.model,
        cost,
        costMultiplier,
        ...(typeof extractPricing.costPer1kPagesCents === 'number' ? { costPer1kPagesCents: extractPricing.costPer1kPagesCents } : {}),
        ...(typeof target.pageCount === 'number' ? { pageCount: target.pageCount } : {}),
        estimateType: target.estimateType ?? 'exact'
      })
      continue
    }

    const extractPricing = getExtractPricing(target.provider, target.model)
    const pageCount = target.pageCount ?? input.extractPageCount ?? 0
    const hasExactPromptTokens = typeof target.promptTokens === 'number'
    const hasExactCompletionTokens = typeof target.completionTokens === 'number'
    const heuristicTokens = hasExactPromptTokens && hasExactCompletionTokens
      ? undefined
      : estimateOcrTokenUsage(target.provider, target.model, pageCount)
    const promptTokens = hasExactPromptTokens ? target.promptTokens as number : heuristicTokens?.promptTokens ?? 0
    const completionTokens = hasExactCompletionTokens ? target.completionTokens as number : heuristicTokens?.completionTokens ?? 0
    const tokenCost = computeTokenCost(
      {
        inputCostPer1MCents: extractPricing.inputCostPer1MCents ?? 0,
        outputCostPer1MCents: extractPricing.outputCostPer1MCents ?? 0,
        ...(extractPricing.tokenPricingBands !== undefined ? { tokenPricingBands: extractPricing.tokenPricingBands } : {}),
        ...(extractPricing.higherContextPricing !== undefined ? { higherContextPricing: extractPricing.higherContextPricing } : {})
      },
      promptTokens,
      completionTokens,
      costMultiplier
    )
    totalCost += tokenCost.totalCost
    steps.push({
      step: 'extract',
      provider: target.provider,
      model: target.model,
      cost: tokenCost.totalCost,
      costMultiplier,
      ...(typeof extractPricing.inputCostPer1MCents === 'number' ? { inputCostPer1MCents: tokenCost.inputCostPer1MCents } : {}),
      ...(typeof extractPricing.outputCostPer1MCents === 'number' ? { outputCostPer1MCents: tokenCost.outputCostPer1MCents } : {}),
      ...(typeof target.pageCount === 'number' ? { pageCount: target.pageCount } : {}),
      promptTokens,
      completionTokens,
      ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
      ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {}),
      estimateType: target.estimateType ?? (hasExactPromptTokens && hasExactCompletionTokens ? 'exact' : 'heuristic')
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
      const costMultiplier = resolveCostMultiplier(input, estimation.costMultiplier)
      const estimatedInputTokens = typeof llmTarget.inputTokens === 'number' ? llmTarget.inputTokens : 0
      const estimatedOutputTokens = typeof llmTarget.outputTokens === 'number' ? llmTarget.outputTokens : 0
      const tokenCost = computeTokenCost(rates, estimatedInputTokens, estimatedOutputTokens, costMultiplier)
      totalCost += tokenCost.totalCost
      steps.push({
        step: 'llm',
        provider: llmTarget.service,
        model: llmTarget.model,
        cost: tokenCost.totalCost,
        costMultiplier,
        inputCostPer1MCents: tokenCost.inputCostPer1MCents,
        outputCostPer1MCents: tokenCost.outputCostPer1MCents,
        estimatedInputTokens,
        estimatedOutputTokens,
        ...(typeof tokenCost.pricingBand === 'string' ? { pricingBand: tokenCost.pricingBand } : {}),
        ...(typeof tokenCost.pricingNote === 'string' ? { pricingNote: tokenCost.pricingNote } : {})
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
    const costMultiplier = resolveCostMultiplier(input, estimation.costMultiplier)
    const pricing = getTtsPricing(ttsTarget.service, ttsTarget.model)
    const hasDualRates = pricing.inputCostPer1MCharsCents !== undefined && pricing.outputCostPer1MCharsCents !== undefined
    const costPer1kCharsCents = hasDualRates ? undefined : (pricing.costPer1kCharsCents ?? getTtsCost(ttsTarget.service, ttsTarget.model))

    const setupCost = ttsTarget.setupCostCents ?? 0
    const cost = applyCostMultiplier(ttsCost.cost, costMultiplier) + setupCost
    totalCost += cost
    steps.push({
      step: 'tts',
      provider: ttsTarget.service,
      model: ttsTarget.model,
      cost,
      costMultiplier,
      ...(typeof ttsTarget.setupCostCents === 'number' ? { setupCostCents: setupCost } : {}),
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
        grokImageModel: input.grokImageModel,
        bflImageModel: input.bflImageModel,
        imageSize: input.imageSize,
        imageQuality: input.imageQuality,
        imageCount: input.imageCount
      })

  for (const imageEstimate of imageEstimates) {
    const estimation = getImageEstimation(imageEstimate.provider, imageEstimate.model)
    const costMultiplier = resolveCostMultiplier(input, estimation.costMultiplier)
    const cost = applyCostMultiplier(imageEstimate.totalCost, costMultiplier)
    totalCost += cost
    steps.push({
      step: 'image',
      provider: imageEstimate.provider,
      model: imageEstimate.model,
      cost,
      costMultiplier,
      imageCount: imageEstimate.imageCount
    })
  }

  const hasVideo = input.videoTargets?.length
    || input.geminiVideoModel
    || input.minimaxVideoModel
    || input.glmVideoModel
    || input.grokVideoModel
    || input.runwayVideoModel
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
      videoDuration: input.videoTargets?.find((target) => typeof target.durationSeconds === 'number')?.durationSeconds ?? input.videoDuration,
      videoSize: input.videoSize,
      videoAspectRatio: input.videoAspectRatio,
      videoResolution: input.videoResolution,
      videoMode: input.videoMode,
      ...(input.grokInputImageCount !== undefined ? { grokInputImageCount: input.grokInputImageCount } : {}),
      ...(input.grokInputVideoDurationSeconds !== undefined ? { grokInputVideoDurationSeconds: input.grokInputVideoDurationSeconds } : {})
    })
    for (const estimate of videoEstimates) {
      const estimation = getVideoEstimation(estimate.provider, estimate.model)
      const costMultiplier = resolveCostMultiplier(input, estimation.costMultiplier)
      const cost = applyCostMultiplier(estimate.totalCost, costMultiplier)
      totalCost += cost
      steps.push({
        step: 'video',
        provider: estimate.provider,
        model: estimate.model,
        cost,
        costMultiplier,
        durationSeconds: estimate.durationSeconds
      })
    }
  }

  const hasMusic = input.musicTargets?.length
    || input.elevenlabsMusicModel
    || input.minimaxMusicModel
    || input.geminiMusicModel
  if (hasMusic) {
    const estimates = estimateMusicCosts({
      elevenlabsMusicModels: input.musicTargets?.filter((target) => target.service === 'elevenlabs').map((target) => target.model),
      elevenlabsMusicModel: input.elevenlabsMusicModel,
      minimaxMusicModels: input.musicTargets?.filter((target) => target.service === 'minimax').map((target) => target.model),
      minimaxMusicModel: input.minimaxMusicModel,
      geminiMusicModels: input.musicTargets?.filter((target) => target.service === 'gemini').map((target) => target.model),
      geminiMusicModel: input.geminiMusicModel,
      musicDuration: input.musicTargets?.find((target) => typeof target.durationSeconds === 'number')?.durationSeconds ?? input.musicDuration,
      musicLyricsFile: input.musicLyricsFile,
      musicInstrumental: input.musicInstrumental
    })
    for (const estimate of estimates) {
      const estimation = getMusicEstimation(estimate.provider, estimate.model)
      const costMultiplier = resolveCostMultiplier(input, estimation.costMultiplier)
      const cost = applyCostMultiplier(estimate.totalCost, costMultiplier)
      totalCost += cost
      steps.push({
        step: 'music',
        provider: estimate.provider,
        model: estimate.model,
        cost,
        costMultiplier,
        durationSeconds: estimate.durationSeconds
      })
    }
  }

  return { totalCost, steps }
}
