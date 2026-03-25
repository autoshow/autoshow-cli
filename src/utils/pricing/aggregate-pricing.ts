import type { ProcessCommand, RuntimeOptions } from '~/types'
import { isOcrCommand, isSttCommand } from '~/types'
import { resolveLLMDefaults } from '~/cli/commands/process-steps/step-1-download/targets/llm-defaults'
import { estimateLlmRates } from '~/cli/commands/process-steps/step-3-write/write-utils/llm-pricing'
import { estimateTtsCost } from '~/cli/commands/process-steps/step-4-tts/tts-utils/tts-pricing'
import { estimateImageCost } from '~/cli/commands/process-steps/step-5-image/image-utils/image-pricing'
import { estimateMusicCost } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'
import { estimateVideoCost } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { resolveSttInputDurationSeconds } from '~/cli/commands/process-steps/step-2-stt/stt-utils/stt-duration'
import { estimateElevenlabsSttRate } from '~/cli/commands/process-steps/step-2-stt/stt-utils/elevenlabs-stt-pricing'
import {
  getExtractEstimation,
  getImageEstimation,
  getLlmEstimation,
  getMusicEstimation,
  getSttCost,
  getSttEstimation,
  getTtsEstimation,
  getVideoEstimation,
} from '~/cli/commands/models/model-loader'
import { estimateMistralOcrCost } from '~/cli/commands/process-steps/step-2-document/document-utils/extract-pricing'
import { resolvePromptTokenEstimate } from '~/prompts/prompt-loader'
import type { SttStepEstimate, ExtractStepEstimate, LlmStepEstimate, TtsStepEstimate, ImageStepEstimate, MusicStepEstimate, VideoStepEstimate, StepEstimate, AggregatedPriceEstimate } from '~/types'
export type { StepEstimate, AggregatedPriceEstimate } from '~/types'

const ESTIMATED_TTS_CHARACTERS_PER_TOKEN = 4
const applyCostMultiplier = (cost: number, multiplier: number): number => cost * multiplier

const buildSttEstimate = async (
  resolvedTarget: string,
  opts: RuntimeOptions
): Promise<SttStepEstimate | null> => {
  const hasElevenlabs = !!opts.elevenlabsSttModel
  const hasGroq = !!opts.groqSttModel
  const hasOpenAI = !!opts.openaiSttModel
  const hasMistral = !!opts.mistralSttModel
  const hasAssemblyAi = !!opts.assemblyaiSttModel
  const hasWhisper = !hasElevenlabs && !hasGroq && !hasOpenAI && !hasMistral && !hasAssemblyAi

  if (hasWhisper && !opts.useReverb) {
    const sttCost = getSttCost('whisper', opts.whisperModel)
    const estimation = getSttEstimation('whisper', opts.whisperModel)
    return {
      step: 'stt',
      provider: 'whisper',
      model: opts.whisperModel,
      durationSeconds: 0,
      totalCost: applyCostMultiplier(sttCost.costPerHourCents ?? 0, estimation.costMultiplier),
      costMultiplier: estimation.costMultiplier,
    }
  }

  if (hasWhisper && opts.useReverb) {
    return {
      step: 'stt',
      provider: 'reverb',
      model: 'reverb',
      durationSeconds: 0,
      totalCost: 0,
      costMultiplier: 1,
    }
  }

  if (hasElevenlabs) {
    const durationSeconds = await resolveSttInputDurationSeconds(resolvedTarget)
    const rate = estimateElevenlabsSttRate(opts.elevenlabsSttModel as string)
    const estimation = getSttEstimation('elevenlabs', opts.elevenlabsSttModel as string)
    const totalCost = applyCostMultiplier((durationSeconds / 3600) * rate.costPerHourCents, estimation.costMultiplier)
    return {
      step: 'stt',
      provider: 'elevenlabs',
      model: rate.model,
      durationSeconds,
      totalCost,
      costMultiplier: estimation.costMultiplier,
    }
  }

  if (hasGroq) {
    const durationSeconds = await resolveSttInputDurationSeconds(resolvedTarget)
    const sttCost = getSttCost('groq', opts.groqSttModel as string)
    const estimation = getSttEstimation('groq', opts.groqSttModel as string)
    const totalCost = applyCostMultiplier((durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0), estimation.costMultiplier)
    return {
      step: 'stt',
      provider: 'groq',
      model: opts.groqSttModel as string,
      durationSeconds,
      totalCost,
      costMultiplier: estimation.costMultiplier,
    }
  }

  if (hasOpenAI) {
    const durationSeconds = await resolveSttInputDurationSeconds(resolvedTarget)
    const sttCost = getSttCost('openai', opts.openaiSttModel as string)
    const estimation = getSttEstimation('openai', opts.openaiSttModel as string)
    const totalCost = applyCostMultiplier((durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0), estimation.costMultiplier)
    return {
      step: 'stt',
      provider: 'openai',
      model: opts.openaiSttModel as string,
      durationSeconds,
      totalCost,
      costMultiplier: estimation.costMultiplier,
    }
  }

  if (hasMistral) {
    const durationSeconds = await resolveSttInputDurationSeconds(resolvedTarget)
    const sttCost = getSttCost('mistral', opts.mistralSttModel as string)
    const estimation = getSttEstimation('mistral', opts.mistralSttModel as string)
    const totalCost = applyCostMultiplier((durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0), estimation.costMultiplier)
    return {
      step: 'stt',
      provider: 'mistral',
      model: opts.mistralSttModel as string,
      durationSeconds,
      totalCost,
      costMultiplier: estimation.costMultiplier,
    }
  }

  if (hasAssemblyAi) {
    const durationSeconds = await resolveSttInputDurationSeconds(resolvedTarget)
    const sttCost = getSttCost('assemblyai', opts.assemblyaiSttModel as string)
    const estimation = getSttEstimation('assemblyai', opts.assemblyaiSttModel as string)
    const totalCost = applyCostMultiplier((durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0), estimation.costMultiplier)
    return {
      step: 'stt',
      provider: 'assemblyai',
      model: opts.assemblyaiSttModel as string,
      durationSeconds,
      totalCost,
      costMultiplier: estimation.costMultiplier,
    }
  }

  return null
}

const buildExtractEstimate = async (
  resolvedTarget: string,
  opts: RuntimeOptions
): Promise<ExtractStepEstimate | null> => {
  if (!opts.mistralOcrModel) return null
  const estimate = await estimateMistralOcrCost(opts.mistralOcrModel, resolvedTarget)
  const estimation = getExtractEstimation(estimate.provider, estimate.model)
  return {
    step: 'extract',
    provider: estimate.provider,
    model: estimate.model,
    costPer1kPagesCents: estimate.costPer1kPagesCents,
    pageCount: estimate.pageCount,
    totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
    costMultiplier: estimation.costMultiplier,
  }
}

const buildLlmEstimates = async (
  opts: RuntimeOptions,
  skipLLM: boolean
): Promise<LlmStepEstimate[]> => {
  if (skipLLM) return []
  const llmConfig = resolveLLMDefaults(opts)
  const rates = estimateLlmRates(llmConfig)
  const promptTokenEstimate = await resolvePromptTokenEstimate(opts.prompts)

  return rates.map(r => {
    const registryService = r.provider === 'llama.cpp' ? 'llama' : r.provider
    const estimation = getLlmEstimation(registryService, r.model)
    const estimatedInputTokens = promptTokenEstimate.estimatedInputTokens
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

const buildTtsEstimate = (opts: RuntimeOptions, characterCount: number): TtsStepEstimate | null => {
  const normalizedCharacterCount = Math.max(0, Math.floor(characterCount))
  const cost = estimateTtsCost(opts, normalizedCharacterCount)
  if (!cost) return null
  const estimation = getTtsEstimation(cost.provider, cost.model)
  return {
    step: 'tts',
    provider: cost.provider,
    model: cost.model,
    ...(cost.costPer1kCharactersCents !== undefined ? { costPer1kCharactersCents: cost.costPer1kCharactersCents } : {}),
    ...(cost.inputCostPer1MCharactersCents !== undefined ? { inputCostPer1MCharactersCents: cost.inputCostPer1MCharactersCents } : {}),
    ...(cost.outputCostPer1MCharactersCents !== undefined ? { outputCostPer1MCharactersCents: cost.outputCostPer1MCharactersCents } : {}),
    characterCount: cost.characterCount,
    totalCost: applyCostMultiplier(cost.totalCost, estimation.costMultiplier),
    costMultiplier: estimation.costMultiplier,
  }
}

const buildImageEstimate = (opts: RuntimeOptions): ImageStepEstimate | null => {
  const hasImage = opts.geminiImageModel || opts.openaiImageModel || opts.minimaxImageModel
  if (!hasImage) return null
  const estimate = estimateImageCost({
    geminiImageModel: opts.geminiImageModel,
    openaiImageModel: opts.openaiImageModel,
    minimaxImageModel: opts.minimaxImageModel,
    imagenCount: opts.imagenCount
  })
  const estimation = getImageEstimation(estimate.provider, estimate.model)
  return {
    step: 'image',
    provider: estimate.provider,
    model: estimate.model,
    totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
    costMultiplier: estimation.costMultiplier,
  }
}

const buildVideoEstimate = (opts: RuntimeOptions): VideoStepEstimate | null => {
  const hasVideo = opts.soraVideoModel || opts.geminiVideoModel || opts.minimaxVideoModel
  if (!hasVideo) return null
  const estimate = estimateVideoCost({
    soraVideoModel: opts.soraVideoModel,
    geminiVideoModel: opts.geminiVideoModel,
    minimaxVideoModel: opts.minimaxVideoModel,
    videoDuration: opts.videoDuration,
    videoSize: opts.videoSize,
    videoResolution: opts.videoResolution
  })
  const estimation = getVideoEstimation(estimate.provider, estimate.model)
  return {
    step: 'video',
    provider: estimate.provider,
    model: estimate.model,
    totalCost: applyCostMultiplier(estimate.totalCost, estimation.costMultiplier),
    costMultiplier: estimation.costMultiplier,
  }
}

const buildMusicEstimate = (opts: RuntimeOptions): MusicStepEstimate | null => {
  const hasMusic = opts.elevenlabsMusicModel || opts.minimaxMusicModel
  if (!hasMusic) return null

  const estimate = estimateMusicCost({
    elevenlabsMusicModel: opts.elevenlabsMusicModel,
    minimaxMusicModel: opts.minimaxMusicModel,
    musicDuration: opts.musicDuration,
    musicLyricsFile: opts.musicLyricsFile,
    musicInstrumental: opts.musicInstrumental
  })
  if (!estimate) return null
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
}

export const buildAggregatedPriceEstimate = async (
  command: ProcessCommand,
  resolvedTarget: string,
  opts: RuntimeOptions,
  characterCount?: number
): Promise<AggregatedPriceEstimate> => {
  const steps: StepEstimate[] = []
  let totalEstimatedCost = 0

  if (isSttCommand(command) || command === 'write') {
    const stt = await buildSttEstimate(resolvedTarget, opts)
    if (stt) {
      steps.push(stt)
      totalEstimatedCost += stt.totalCost
    }
  }

  if (isOcrCommand(command)) {
    const extract = await buildExtractEstimate(resolvedTarget, opts)
    if (extract) {
      steps.push(extract)
      totalEstimatedCost += extract.totalCost
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

    const estimatedTtsCharacterCount = await estimateTtsCharacterCountFromPrompts(opts)
    const tts = buildTtsEstimate(opts, estimatedTtsCharacterCount)
    if (tts) {
      steps.push(tts)
      totalEstimatedCost += tts.totalCost
    }

    const image = buildImageEstimate(opts)
    if (image) {
      steps.push(image)
      totalEstimatedCost += image.totalCost
    }

    const video = buildVideoEstimate(opts)
    if (video) {
      steps.push(video)
      totalEstimatedCost += video.totalCost
    }

    const music = buildMusicEstimate(opts)
    if (music) {
      steps.push(music)
      totalEstimatedCost += music.totalCost
    }
  }

  if (command === 'tts') {
    const tts = buildTtsEstimate(opts, typeof characterCount === 'number' ? characterCount : 0)
    if (tts) {
      steps.push(tts)
      totalEstimatedCost += tts.totalCost
    }
  }

  if (command === 'image') {
    const image = buildImageEstimate(opts)
    if (image) {
      steps.push(image)
      totalEstimatedCost += image.totalCost
    }
  }

  if (command === 'video') {
    const video = buildVideoEstimate(opts)
    if (video) {
      steps.push(video)
      totalEstimatedCost += video.totalCost
    }
  }

  if (command === 'music') {
    const music = buildMusicEstimate(opts)
    if (music) {
      steps.push(music)
      totalEstimatedCost += music.totalCost
    }
  }

  return { steps, totalEstimatedCost }
}
