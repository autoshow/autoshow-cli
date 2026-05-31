import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import type { AggregatedPriceEstimate, Step4Metadata } from '~/types'

export type TtsBatchEstimateSummary = {
  inputCount: number
  batchConcurrency: number
  ttsChunkConcurrency: number
  totalEstimatedProcessingTimeMs: number
  estimatedWallTimeMs: number
  totalEstimatedCost: number
}

export type SuccessfulTtsBatchItem = {
  metadata: Step4Metadata[]
  characterCount: number
}

const normalizePositiveInteger = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.floor(value))
    : 1

export const simulateBatchWorkerPool = (
  itemProcessingTimesMs: number[],
  batchConcurrency: number
): number => {
  if (itemProcessingTimesMs.length === 0) {
    return 0
  }

  const workerCount = Math.min(normalizePositiveInteger(batchConcurrency), itemProcessingTimesMs.length)
  const workerLoads = Array.from({ length: workerCount }, () => 0)

  for (const itemTimeMs of itemProcessingTimesMs) {
    let nextWorkerIndex = 0
    for (let index = 1; index < workerLoads.length; index++) {
      if ((workerLoads[index] ?? 0) < (workerLoads[nextWorkerIndex] ?? 0)) {
        nextWorkerIndex = index
      }
    }
    workerLoads[nextWorkerIndex] = (workerLoads[nextWorkerIndex] ?? 0) + Math.max(0, Math.round(itemTimeMs))
  }

  return Math.max(...workerLoads)
}

export const buildTtsBatchEstimateSummary = (
  estimates: AggregatedPriceEstimate[],
  batchConcurrency: number,
  ttsChunkConcurrency: number | undefined
): TtsBatchEstimateSummary => {
  const itemProcessingTimesMs = estimates.map((estimate) => estimate.timing?.totalProcessingTimeMs ?? 0)

  return {
    inputCount: estimates.length,
    batchConcurrency: normalizePositiveInteger(batchConcurrency),
    ttsChunkConcurrency: normalizePositiveInteger(ttsChunkConcurrency),
    totalEstimatedProcessingTimeMs: itemProcessingTimesMs.reduce((sum, itemTimeMs) => sum + itemTimeMs, 0),
    estimatedWallTimeMs: simulateBatchWorkerPool(itemProcessingTimesMs, batchConcurrency),
    totalEstimatedCost: estimates.reduce((sum, estimate) => sum + estimate.totalEstimatedCost, 0)
  }
}

export const computeSuccessfulTtsBatchActualCost = (
  items: SuccessfulTtsBatchItem[]
): number =>
  items.reduce((sum, item) =>
    sum + computeActualCosts({
      step4: item.metadata,
      ttsCharacterCount: item.characterCount
    }).totalCost
  , 0)
