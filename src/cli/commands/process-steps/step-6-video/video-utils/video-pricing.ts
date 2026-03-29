import { type GeminiVideoModel, type MinimaxVideoModel, validateGeminiVideoModel, validateMinimaxVideoModel } from '~/cli/commands/models/model-options'
import { getVideoModelMeta } from '~/cli/commands/models/model-loader'
import {
  normalizeGeminiDuration,
  normalizeGeminiResolution,
  normalizeMinimaxDuration,
  normalizeMinimaxResolution,
  isMinimaxHailuoModel
} from './video-normalization'
import type { VideoCostEstimate, EstimateVideoCostOptions } from '~/types'
import * as l from '~/logger'


const estimateVeo31GeneratePreviewCost = (duration: number | undefined, resolution: string | undefined): VideoCostEstimate => {
  const meta = getVideoModelMeta('gemini', 'veo-3.1-generate-preview')
  const normalizedResolution = normalizeGeminiResolution(resolution)
  const durationSeconds = normalizeGeminiDuration(duration)
  const billedDurationSeconds = Math.max(4, durationSeconds)
  const resolutionMultiplier = normalizedResolution === '1080p'
    ? (meta?.resolutionMultiplier1080p ?? 1.4) : 1
  const costPerSecond = (meta?.baseCostPerSecondCents ?? 25) * resolutionMultiplier

  return {
    provider: 'gemini',
    model: 'veo-3.1-generate-preview',
    durationSeconds,
    billedDurationSeconds,
    costPerSecond,
    totalCost: billedDurationSeconds * costPerSecond,
    note: `Approximate estimate using ${normalizedResolution} resolution pricing`
  }
}

const estimateVeo31FastGeneratePreviewCost = (duration: number | undefined, resolution: string | undefined): VideoCostEstimate => {
  const meta = getVideoModelMeta('gemini', 'veo-3.1-fast-generate-preview')
  const normalizedResolution = normalizeGeminiResolution(resolution)
  const durationSeconds = normalizeGeminiDuration(duration)
  const blockSize = meta?.blockSizeSec ?? 5
  const fiveSecondBlocks = Math.max(1, Math.ceil(durationSeconds / blockSize))
  const blockCost = normalizedResolution === '1080p'
    ? (meta?.blockCost1080pCents ?? 80) : (meta?.blockCost720pCents ?? 55)
  const billedDurationSeconds = fiveSecondBlocks * blockSize
  const totalCost = fiveSecondBlocks * blockCost

  return {
    provider: 'gemini',
    model: 'veo-3.1-fast-generate-preview',
    durationSeconds,
    billedDurationSeconds,
    costPerSecond: totalCost / billedDurationSeconds,
    totalCost,
    note: `Approximate estimate billed in ${blockSize}-second blocks at ${normalizedResolution}`
  }
}

const estimateMinimaxCost = (model: MinimaxVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  const meta = getVideoModelMeta('minimax', model)
  const normalizedResolution = normalizeMinimaxResolution(model, options.videoResolution)
  const normalizedDuration = normalizeMinimaxDuration(model, normalizedResolution, options.videoDuration)
  const blockSize = meta?.blockSizeSec ?? 6
  const blockCount = Math.max(1, Math.ceil(normalizedDuration / blockSize))
  const blockCost720 = meta?.blockCost720pCents ?? 0
  const blockCost1080 = meta?.blockCost1080pCents ?? blockCost720
  const blockCost = normalizedResolution === '1080p' ? blockCost1080 : blockCost720
  const billedDurationSeconds = blockCount * blockSize
  const totalCost = blockCount * blockCost

  let note = `Approximate estimate billed in ${blockSize}-second blocks`
  if (!isMinimaxHailuoModel(model)) {
    note = `${note}; ${model} currently normalized to 720p/6s`
  } else if (normalizedResolution === '1080p') {
    note = `${note}; 1080p currently supports 6s generation`
  }

  return {
    provider: 'minimax',
    model,
    durationSeconds: normalizedDuration,
    billedDurationSeconds,
    costPerSecond: billedDurationSeconds > 0 ? totalCost / billedDurationSeconds : 0,
    totalCost,
    note
  }
}

const estimateGeminiCost = (model: GeminiVideoModel, options: EstimateVideoCostOptions): VideoCostEstimate => {
  if (model === 'veo-3.1-generate-preview') {
    return estimateVeo31GeneratePreviewCost(options.videoDuration, options.videoResolution)
  }
  return estimateVeo31FastGeneratePreviewCost(options.videoDuration, options.videoResolution)
}

export const estimateVideoCost = (options: EstimateVideoCostOptions): VideoCostEstimate => {
  const geminiModelRaw = options.geminiVideoModel
  const minimaxModelRaw = options.minimaxVideoModel
  const hasGemini = typeof geminiModelRaw === 'string' && geminiModelRaw.length > 0
  const hasMinimax = typeof minimaxModelRaw === 'string' && minimaxModelRaw.length > 0

  if ([hasGemini, hasMinimax].filter(Boolean).length > 1) {
    throw new Error('Cannot estimate video cost when multiple providers are selected')
  }

  if (hasGemini) {
    const model = validateGeminiVideoModel(geminiModelRaw)
    return estimateGeminiCost(model, options)
  }

  if (hasMinimax) {
    const model = validateMinimaxVideoModel(minimaxModelRaw)
    return estimateMinimaxCost(model, options)
  }

  return estimateVeo31FastGeneratePreviewCost(options.videoDuration, options.videoResolution)
}

export const logVideoEstimate = (estimate: VideoCostEstimate): void => {
  l.info(`Estimated video cost for ${estimate.provider}/${estimate.model}:`)
  l.info(`  Requested duration: ${estimate.durationSeconds}s`)
  l.info(`  Billed duration: ${estimate.billedDurationSeconds}s`)
  l.info(`  Cost per second: ${estimate.costPerSecond.toFixed(4)}¢`)
  l.info(`  Total estimated cost: ${estimate.totalCost.toFixed(5)}¢`)
  if (estimate.note) {
    l.info(`  Note: ${estimate.note}`)
  }
}
