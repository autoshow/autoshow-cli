import type { ProcessCommand, RuntimeOptions } from '~/types'
import { isOcrCommand, isSttCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { resolveLLMDefaults } from '~/cli/commands/process-steps/step-1-download/targets/llm-defaults'
import { estimateLlmRates } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-pricing'
import { estimateTtsCosts } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-pricing'
import { collectTtsTargets } from '~/cli/commands/process-steps/step-4-tts/tts-targets'
import { estimateImageCosts } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import { estimateVideoCosts } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { resolveSttInputDurationSeconds } from '~/cli/commands/process-steps/step-2-stt/stt-utils/stt-duration'
import { estimateElevenlabsSttRate } from '~/cli/commands/process-steps/step-2-stt/stt-utils/elevenlabs-stt-pricing'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-stt/stt-targets'
import { isDeapiSupportedSourceUrl } from '~/cli/commands/process-steps/step-2-stt/stt-services/deapi/deapi'
import {
  logDeapiPricingFallbackWarning,
  resolveDeapiTranscriptionPrice
} from '~/cli/commands/process-steps/step-2-stt/stt-services/deapi/deapi-pricing'
import {
  buildHappyScribeRegistryEstimate,
  resolveHappyScribePriceNotes
} from '~/cli/commands/process-steps/step-2-stt/stt-services/happyscribe/happyscribe-pricing'
import { resolveYoutubeCaptionEstimateTargets } from '~/cli/commands/process-steps/step-2-stt/youtube-captions'
import {
  getExtractEstimation,
  getImageEstimation,
  getLlmEstimation,
  getMusicEstimation,
  getSttCost,
  getSttEstimation,
  getTtsEstimation,
  getVideoEstimation,
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import { computeBilledSttCost } from '~/utils/pricing/stt-billing'
import { estimateSupadataCost, SUPADATA_STT_AGGREGATE_NOTE } from '~/utils/pricing/supadata-pricing'
import {
  estimateFirecrawlScrapeCost,
  estimateAnthropicOcrCost,
  estimateGeminiOcrCost,
  estimateGlmOcrCost,
  estimateMistralOcrCost,
  estimateOpenAIOcrCost
} from '~/cli/commands/process-steps/step-2-ocr/ocr-utils/extract-pricing'
import { resolvePromptTokenEstimate } from '~/prompts/prompt-loader'
import type { SttStepEstimate, ExtractStepEstimate, LlmStepEstimate, TtsStepEstimate, ImageStepEstimate, MusicStepEstimate, VideoStepEstimate, StepEstimate, AggregatedPriceEstimate } from '~/types'
import { isDocumentLikeTarget, isHtmlArticleTarget } from '~/cli/commands/process-steps/step-1-download/targets/target-utils'
import { estimatePromptTokensFromText, readPromptFileText } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
export type { StepEstimate, AggregatedPriceEstimate } from '~/types'

const ESTIMATED_TTS_CHARACTERS_PER_TOKEN = 4
const applyCostMultiplier = (cost: number, multiplier: number): number => cost * multiplier

const hasIgnoredHtmlOcrFlags = (opts: RuntimeOptions): boolean =>
  opts.useOcrmypdf
  || opts.usePaddleOcr
  || (opts.mistralOcrModels?.length ?? 0) > 0
  || typeof opts.mistralOcrModel === 'string'
  || (opts.glmOcrModels?.length ?? 0) > 0
  || typeof opts.glmOcrModel === 'string'
  || (opts.openaiOcrModels?.length ?? 0) > 0
  || typeof opts.openaiOcrModel === 'string'
  || (opts.anthropicOcrModels?.length ?? 0) > 0
  || typeof opts.anthropicOcrModel === 'string'
  || (opts.geminiOcrModels?.length ?? 0) > 0
  || typeof opts.geminiOcrModel === 'string'

const buildCloudSttEstimate = async (
  provider: string,
  model: string,
  durationSeconds: number
): Promise<SttStepEstimate> => {
  const estimation = getSttEstimation(provider, model)
  const totalCost = applyCostMultiplier(computeBilledSttCost(provider, model, durationSeconds).cost, estimation.costMultiplier)
  return { step: 'stt', provider, model, durationSeconds, totalCost, costMultiplier: estimation.costMultiplier }
}

const buildSupadataSttEstimate = (
  model: string,
  durationSeconds: number
): SttStepEstimate => {
  const estimation = getSttEstimation('supadata', model)
  const cost = estimateSupadataCost(model, durationSeconds)
  return {
    step: 'stt',
    provider: 'supadata',
    model,
    durationSeconds,
    totalCost: applyCostMultiplier(cost.totalCost, estimation.costMultiplier),
    costMultiplier: estimation.costMultiplier,
    note: cost.note
  }
}

const buildDeapiSttEstimate = async (
  model: string,
  resolvedTarget: string,
  durationSeconds: number
): Promise<SttStepEstimate> => {
  const price = await resolveDeapiTranscriptionPrice({
    model,
    ...(isDeapiSupportedSourceUrl(resolvedTarget) ? { sourceUrl: resolvedTarget } : {}),
    durationSeconds
  })
  logDeapiPricingFallbackWarning(price.warning)

  return {
    step: 'stt',
    provider: 'deapi',
    model,
    durationSeconds,
    totalCost: price.totalCost,
    costMultiplier: price.source === 'provider_quote' ? 1 : getSttEstimation('deapi', model).costMultiplier,
    estimateType: price.estimateType,
    ...(price.warning ? { note: price.warning } : {})
  }
}

const buildHappyScribeSttEstimate = async (
  model: string,
  durationSeconds: number,
  preferredOrganizationId: string | undefined
): Promise<SttStepEstimate> => {
  const estimation = getSttEstimation('happyscribe', model)
  const totalCost = applyCostMultiplier(buildHappyScribeRegistryEstimate(model, durationSeconds), estimation.costMultiplier)
  const notes = await resolveHappyScribePriceNotes({ preferredOrganizationId })

  return {
    step: 'stt',
    provider: 'happyscribe',
    model,
    durationSeconds,
    totalCost,
    costMultiplier: estimation.costMultiplier,
    ...(notes.length > 0 ? { note: notes.join(' ') } : {})
  }
}

const buildSttEstimates = async (
  resolvedTarget: string,
  opts: RuntimeOptions
): Promise<SttStepEstimate[]> => {
  const captionTargets = opts.youtubeCaptions && /^https?:\/\//i.test(resolvedTarget)
    ? await resolveYoutubeCaptionEstimateTargets(resolvedTarget)
    : null
  const targets = captionTargets
    ? captionTargets.map((target) => ({ ...target, local: false }))
    : collectSttTargets(opts)
  if (targets.length === 0) {
    return []
  }

  const needsDuration = targets.some((target) => target.service !== 'whisper' && target.service !== 'reverb')
  const durationSeconds = needsDuration ? await resolveSttInputDurationSeconds(resolvedTarget, targets) : 0
  const estimates: SttStepEstimate[] = []

  for (const target of targets) {
    if (target.service === 'reverb') {
      estimates.push({ step: 'stt', provider: 'reverb', model: 'reverb', durationSeconds: 0, totalCost: 0, costMultiplier: 1 })
      continue
    }

    if (target.service === 'whisper') {
      const sttCost = getSttCost('whisper', target.model)
      const estimation = getSttEstimation('whisper', target.model)
      estimates.push({
        step: 'stt',
        provider: 'whisper',
        model: target.model,
        durationSeconds: 0,
        totalCost: applyCostMultiplier(sttCost.costPerHourCents ?? 0, estimation.costMultiplier),
        costMultiplier: estimation.costMultiplier,
      })
      continue
    }

    if (target.service === 'elevenlabs') {
      const rate = estimateElevenlabsSttRate(target.model)
      const estimation = getSttEstimation('elevenlabs', target.model)
      estimates.push({
        step: 'stt',
        provider: 'elevenlabs',
        model: rate.model,
        durationSeconds,
        totalCost: applyCostMultiplier((durationSeconds / 3600) * rate.costPerHourCents, estimation.costMultiplier),
        costMultiplier: estimation.costMultiplier
      })
      continue
    }

    if (target.service === 'supadata') {
      estimates.push(buildSupadataSttEstimate(target.model, durationSeconds))
      continue
    }

    if (target.service === 'deapi') {
      estimates.push(await buildDeapiSttEstimate(target.model, resolvedTarget, durationSeconds))
      continue
    }

    if (target.service === 'happyscribe') {
      estimates.push(await buildHappyScribeSttEstimate(target.model, durationSeconds, opts.happyscribeOrganizationId))
      continue
    }

    estimates.push(await buildCloudSttEstimate(target.service, target.model, durationSeconds))
  }

  return estimates
}

const buildExtractEstimates = async (
  resolvedTarget: string,
  opts: RuntimeOptions
): Promise<ExtractStepEstimate[]> => {
  const estimates: ExtractStepEstimate[] = []

  const mistralModels = opts.mistralOcrModels ?? (opts.mistralOcrModel ? [opts.mistralOcrModel] : [])
  for (const model of mistralModels) {
    const estimate = await estimateMistralOcrCost(model, resolvedTarget)
    const estimation = getExtractEstimation(estimate.provider, estimate.model)
    estimates.push({
      step: 'extract',
      provider: estimate.provider,
      model: estimate.model,
      costPer1kPagesCents: estimate.costPer1kPagesCents,
      pageCount: estimate.pageCount,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
      estimateType: 'exact'
    })
  }

  const glmModels = opts.glmOcrModels ?? (opts.glmOcrModel ? [opts.glmOcrModel] : [])
  for (const model of glmModels) {
    const estimate = await estimateGlmOcrCost(model, resolvedTarget)
    const estimation = getExtractEstimation(estimate.provider, estimate.model)
    estimates.push({
      step: 'extract',
      provider: estimate.provider,
      model: estimate.model,
      inputCostPer1MCents: estimate.inputCostPer1MCents,
      outputCostPer1MCents: estimate.outputCostPer1MCents,
      pageCount: estimate.pageCount,
      promptTokens: estimate.promptTokens,
      completionTokens: estimate.completionTokens,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
      estimateType: estimate.estimateType,
      note: 'Heuristic token estimate based on 4,000 total tokens per page.'
    })
  }

  const openaiModels = opts.openaiOcrModels ?? (opts.openaiOcrModel ? [opts.openaiOcrModel] : [])
  for (const model of openaiModels) {
    const estimate = await estimateOpenAIOcrCost(model, resolvedTarget)
    const estimation = getExtractEstimation(estimate.provider, estimate.model)
    estimates.push({
      step: 'extract',
      provider: estimate.provider,
      model: estimate.model,
      inputCostPer1MCents: estimate.inputCostPer1MCents,
      outputCostPer1MCents: estimate.outputCostPer1MCents,
      pageCount: estimate.pageCount,
      promptTokens: estimate.promptTokens,
      completionTokens: estimate.completionTokens,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
      estimateType: estimate.estimateType,
      note: estimate.note
    })
  }

  const anthropicModels = opts.anthropicOcrModels ?? (opts.anthropicOcrModel ? [opts.anthropicOcrModel] : [])
  for (const model of anthropicModels) {
    const estimate = await estimateAnthropicOcrCost(model, resolvedTarget)
    const estimation = getExtractEstimation(estimate.provider, estimate.model)
    estimates.push({
      step: 'extract',
      provider: estimate.provider,
      model: estimate.model,
      inputCostPer1MCents: estimate.inputCostPer1MCents,
      outputCostPer1MCents: estimate.outputCostPer1MCents,
      pageCount: estimate.pageCount,
      promptTokens: estimate.promptTokens,
      completionTokens: estimate.completionTokens,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
      estimateType: estimate.estimateType,
      note: estimate.note
    })
  }

  const geminiModels = opts.geminiOcrModels ?? (opts.geminiOcrModel ? [opts.geminiOcrModel] : [])
  for (const model of geminiModels) {
    const estimate = await estimateGeminiOcrCost(model, resolvedTarget)
    const estimation = getExtractEstimation(estimate.provider, estimate.model)
    estimates.push({
      step: 'extract',
      provider: estimate.provider,
      model: estimate.model,
      inputCostPer1MCents: estimate.inputCostPer1MCents,
      outputCostPer1MCents: estimate.outputCostPer1MCents,
      pageCount: estimate.pageCount,
      promptTokens: estimate.promptTokens,
      completionTokens: estimate.completionTokens,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
      estimateType: estimate.estimateType,
      note: 'Heuristic token estimate based on 4,000 total tokens per page.'
    })
  }

  return estimates
}

const buildLlmEstimates = async (
  opts: RuntimeOptions,
  skipLLM: boolean
): Promise<LlmStepEstimate[]> => {
  if (skipLLM) return []
  const llmConfig = resolveLLMDefaults(opts)
  const rates = estimateLlmRates(llmConfig)
  const promptFileOnly = typeof opts.promptFile === 'string' && opts.promptFile.length > 0 && opts.prompts.length === 0
  const promptTokenEstimate = await resolvePromptTokenEstimate(opts.prompts, {
    fallbackToDefault: !promptFileOnly
  })
  const promptFileText = await readPromptFileText(opts.promptFile)
  const extraPromptTokens = promptFileText ? estimatePromptTokensFromText(promptFileText) : 0

  return rates.map(r => {
    const registryService = r.provider === 'llama.cpp' ? 'llama' : r.provider
    const estimation = getLlmEstimation(registryService, r.model)
    const estimatedInputTokens = promptTokenEstimate.estimatedInputTokens + extraPromptTokens
    const estimatedOutputTokens = promptTokenEstimate.estimatedOutputTokens
    const totalCost = applyCostMultiplier(
      (estimatedInputTokens / 1_000_000) * r.inputCostPer1MCents +
      (estimatedOutputTokens / 1_000_000) * r.outputCostPer1MCents,
      estimation.costMultiplier
    )

    return {
      step: 'llm' as const,
      provider: r.provider,
      model: r.model,
      inputCostPer1MCents: r.inputCostPer1MCents,
      outputCostPer1MCents: r.outputCostPer1MCents,
      estimatedInputTokens,
      estimatedOutputTokens,
      totalCost,
      costMultiplier: estimation.costMultiplier,
    }
  })
}

const estimateTtsCharacterCountFromPrompts = async (opts: RuntimeOptions): Promise<number> => {
  const promptTokenEstimate = await resolvePromptTokenEstimate(opts.prompts)
  const estimatedOutputTokens = Math.max(0, promptTokenEstimate.estimatedOutputTokens)
  return Math.max(0, Math.round(estimatedOutputTokens * ESTIMATED_TTS_CHARACTERS_PER_TOKEN))
}

const buildTtsEstimates = (opts: RuntimeOptions, characterCount: number): TtsStepEstimate[] => {
  const normalizedCharacterCount = Math.max(0, Math.floor(characterCount))
  return estimateTtsCosts(opts, normalizedCharacterCount).map((cost) => {
    const estimation = getTtsEstimation(cost.provider, cost.model)
    return {
      step: 'tts' as const,
      provider: cost.provider,
      model: cost.model,
      ...(cost.costPer1kCharactersCents !== undefined ? { costPer1kCharactersCents: cost.costPer1kCharactersCents } : {}),
      ...(cost.inputCostPer1MCharactersCents !== undefined ? { inputCostPer1MCharactersCents: cost.inputCostPer1MCharactersCents } : {}),
      ...(cost.outputCostPer1MCharactersCents !== undefined ? { outputCostPer1MCharactersCents: cost.outputCostPer1MCharactersCents } : {}),
      characterCount: cost.characterCount,
      totalCost: applyCostMultiplier(cost.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
    }
  })
}

const buildImageEstimates = (opts: RuntimeOptions): ImageStepEstimate[] => {
  const hasImage = (opts.geminiImageModels?.length ?? 0) > 0
    || !!opts.geminiImageModel
    || (opts.openaiImageModels?.length ?? 0) > 0
    || !!opts.openaiImageModel
    || (opts.minimaxImageModels?.length ?? 0) > 0
    || !!opts.minimaxImageModel
  if (!hasImage) return []

  return estimateImageCosts({
    geminiImageModels: opts.geminiImageModels,
    geminiImageModel: opts.geminiImageModel,
    openaiImageModels: opts.openaiImageModels,
    openaiImageModel: opts.openaiImageModel,
    minimaxImageModels: opts.minimaxImageModels,
    minimaxImageModel: opts.minimaxImageModel,
    imagenCount: opts.imagenCount
  }).map((estimate) => {
    const estimation = getImageEstimation(estimate.provider, estimate.model)
    return {
      step: 'image' as const,
      provider: estimate.provider,
      model: estimate.model,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
    }
  })
}

const buildVideoEstimates = (opts: RuntimeOptions): VideoStepEstimate[] => {
  const hasVideo = (opts.geminiVideoModels?.length ?? 0) > 0
    || !!opts.geminiVideoModel
    || (opts.minimaxVideoModels?.length ?? 0) > 0
    || !!opts.minimaxVideoModel
  if (!hasVideo) return []

  return estimateVideoCosts({
    geminiVideoModels: opts.geminiVideoModels,
    geminiVideoModel: opts.geminiVideoModel,
    minimaxVideoModels: opts.minimaxVideoModels,
    minimaxVideoModel: opts.minimaxVideoModel,
    videoDuration: opts.videoDuration,
    videoSize: opts.videoSize,
    videoResolution: opts.videoResolution
  }).map((estimate) => {
    const estimation = getVideoEstimation(estimate.provider, estimate.model)
    return {
      step: 'video' as const,
      provider: estimate.provider,
      model: estimate.model,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
    }
  })
}

const buildMusicEstimates = (opts: RuntimeOptions): MusicStepEstimate[] => {
  const hasMusic = (opts.elevenlabsMusicModels?.length ?? 0) > 0
    || !!opts.elevenlabsMusicModel
    || (opts.minimaxMusicModels?.length ?? 0) > 0
    || !!opts.minimaxMusicModel
  if (!hasMusic) return []

  const estimates = estimateMusicCosts({
    elevenlabsMusicModels: opts.elevenlabsMusicModels,
    elevenlabsMusicModel: opts.elevenlabsMusicModel,
    minimaxMusicModels: opts.minimaxMusicModels,
    minimaxMusicModel: opts.minimaxMusicModel,
    musicDuration: opts.musicDuration,
    musicLyricsFile: opts.musicLyricsFile,
    musicInstrumental: opts.musicInstrumental
  })

  return estimates.map((estimate) => {
    const estimation = getMusicEstimation(estimate.provider, estimate.model)
    return {
      step: 'music',
      provider: estimate.provider,
      model: estimate.model,
      lyricsSource: estimate.lyricsSource,
      totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
      ...(estimate.note !== undefined ? { note: estimate.note } : {})
    }
  })
}

export const buildAggregatedPriceEstimate = async (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: RuntimeOptions,
  characterCount?: number
): Promise<AggregatedPriceEstimate> => {
  const steps: StepEstimate[] = []
  let totalEstimatedCost = 0
  const notes: string[] = []

  const documentTarget = await isDocumentLikeTarget(resolvedTarget, opts)
  const htmlArticleTarget = await isHtmlArticleTarget(resolvedTarget, opts)
  const textInputWrite = command === 'write' && opts.textInput
  const documentWrite = command === 'write' && documentTarget && !textInputWrite

  if (!textInputWrite && (isSttCommand(command) || (command === 'write' && !documentWrite))) {
    for (const stt of await buildSttEstimates(resolvedTarget, opts)) {
      steps.push(stt)
      totalEstimatedCost += stt.totalCost
      if (typeof stt.note === 'string' && stt.note.length > 0) {
        notes.push(stt.note)
      }
    }
  }

  if (!textInputWrite && (isOcrCommand(command) || documentWrite) && !htmlArticleTarget) {
    for (const extract of await buildExtractEstimates(resolvedTarget, opts)) {
      steps.push(extract)
      totalEstimatedCost += extract.totalCost
    }
  }

  if (htmlArticleTarget) {
    if (opts.urlBackend === 'firecrawl' && resolvedTarget.startsWith('http')) {
      const estimate = estimateFirecrawlScrapeCost()
      const estimation = getExtractEstimation(estimate.provider, estimate.model)
      const totalCost = applyCostMultiplier(estimate.totalCost, estimation.costMultiplier)
      steps.push({
        step: 'extract',
        provider: estimate.provider,
        model: estimate.model,
        costPer1kPagesCents: estimate.costPer1kPagesCents,
        pageCount: estimate.pageCount,
        totalCost,
        costMultiplier: estimation.costMultiplier,
        estimateType: estimate.estimateType,
        note: estimate.note
      })
      totalEstimatedCost += totalCost
    }
    if (opts.urlBackend === 'glm-reader' && resolvedTarget.startsWith('http')) {
      notes.push('GLM Reader cost is not estimated locally during preflight.')
    }
    if (resolvedTarget.startsWith('file://') || !resolvedTarget.startsWith('http')) {
      if (opts.urlBackend === 'firecrawl') {
        notes.push('Local HTML inputs always use the defuddle backend; --url-backend firecrawl is ignored.')
      }
      if (opts.urlBackend === 'glm-reader') {
        notes.push('Local HTML inputs always use the defuddle backend; --url-backend glm-reader is ignored.')
      }
    }
    if (hasIgnoredHtmlOcrFlags(opts)) {
      notes.push('OCR flags are ignored for HTML/article inputs.')
    }
  }

  if (command === 'write') {
    const llmEstimates = await buildLlmEstimates(opts, false)
    for (const llm of llmEstimates) {
      steps.push(llm)
      if (typeof llm.totalCost === 'number') {
        totalEstimatedCost += llm.totalCost
      }
    }

    const selectedTtsTargets = collectTtsTargets(opts)
    if (selectedTtsTargets.length > 0) {
      if (llmEstimates.length === 1) {
        const estimatedTtsCharacterCount = await estimateTtsCharacterCountFromPrompts(opts)
        const ttsEstimates = buildTtsEstimates(opts, estimatedTtsCharacterCount)
        for (const tts of ttsEstimates) {
          steps.push(tts)
          totalEstimatedCost += tts.totalCost
        }
      } else {
        notes.push(
          llmEstimates.length > 1
            ? `TTS estimate omitted: step 4 only runs when write produces exactly one summary, but ${llmEstimates.length} LLM providers are selected.`
            : 'TTS estimate omitted: step 4 only runs when write produces exactly one summary, and this run skips summary generation.'
        )
      }
    }

    const images = buildImageEstimates(opts)
    for (const image of images) {
      steps.push(image)
      totalEstimatedCost += image.totalCost
    }

    for (const video of buildVideoEstimates(opts)) {
      steps.push(video)
      totalEstimatedCost += video.totalCost
    }

    for (const music of buildMusicEstimates(opts)) {
      steps.push(music)
      totalEstimatedCost += music.totalCost
    }
  }

  if (command === 'tts') {
    const ttsEstimates = buildTtsEstimates(opts, typeof characterCount === 'number' ? characterCount : 0)
    for (const tts of ttsEstimates) {
      steps.push(tts)
      totalEstimatedCost += tts.totalCost
    }
  }

  if (command === 'image') {
    const images = buildImageEstimates(opts)
    for (const image of images) {
      steps.push(image)
      totalEstimatedCost += image.totalCost
    }
  }

  if (command === 'video') {
    for (const video of buildVideoEstimates(opts)) {
      steps.push(video)
      totalEstimatedCost += video.totalCost
    }
  }

  if (command === 'music') {
    for (const music of buildMusicEstimates(opts)) {
      steps.push(music)
      totalEstimatedCost += music.totalCost
    }
  }

  if (steps.some((step) => step.step === 'stt' && step.provider === 'supadata')) {
    notes.push(SUPADATA_STT_AGGREGATE_NOTE)
  }

  return {
    steps,
    totalEstimatedCost,
    ...(notes.length > 0 ? { notes } : {})
  }
}
