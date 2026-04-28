import type { DeapiMusicModel } from '~/types'
import { getDeapiApiKey, requestDeapiJsonPrice } from '~/utils/deapi'

export type DeapiMusicParams = {
  duration: number
  inferenceSteps: number
  guidanceScale: number
}

export type DeapiMusicResolvedPrice = {
  totalCost: number
  source: 'provider_quote' | 'registry_fallback'
  estimateType: 'exact' | 'heuristic'
  warning?: string | undefined
}

const assertDuration = (
  model: DeapiMusicModel,
  durationSeconds: number,
  minSeconds: number,
  maxSeconds: number
): void => {
  if (!Number.isFinite(durationSeconds) || durationSeconds < minSeconds || durationSeconds > maxSeconds) {
    throw new Error(`deAPI music model ${model} requires --music-duration between ${minSeconds} and ${maxSeconds} seconds. Received: ${durationSeconds}`)
  }
}

export const normalizeDeapiMusicParams = (
  model: DeapiMusicModel,
  durationSeconds?: number | undefined
): DeapiMusicParams => {
  const duration = durationSeconds ?? 30
  switch (model) {
    case 'AceStep_1_5_Turbo':
      assertDuration(model, duration, 10, 300)
      return { duration, inferenceSteps: 8, guidanceScale: 1 }
    case 'AceStep_1_5_Base':
      assertDuration(model, duration, 30, 300)
      return { duration, inferenceSteps: 32, guidanceScale: 15 }
    case 'AceStep_1_5_XL_Turbo_INT8':
      assertDuration(model, duration, 10, 300)
      return { duration, inferenceSteps: 8, guidanceScale: 1 }
  }
}

export const resolveDeapiMusicPrice = async (
  options: {
    model: DeapiMusicModel
    params: DeapiMusicParams
  }
): Promise<DeapiMusicResolvedPrice> => {
  const apiKey = getDeapiApiKey()
  if (!apiKey) {
    return {
      totalCost: 0,
      source: 'registry_fallback',
      estimateType: 'heuristic',
      warning: 'DEAPI_API_KEY is not set; exact deAPI music pricing requires the provider quote endpoint.'
    }
  }

  try {
    const priceUsd = await requestDeapiJsonPrice({
      apiKey,
      path: '/api/v2/audio/music/price',
      operationName: 'deapi-music-price',
      body: {
        model: options.model,
        duration: options.params.duration,
        inference_steps: options.params.inferenceSteps
      }
    })

    return {
      totalCost: priceUsd * 100,
      source: 'provider_quote',
      estimateType: 'exact'
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      totalCost: 0,
      source: 'registry_fallback',
      estimateType: 'heuristic',
      warning: `deAPI exact music pricing failed; no local registry rate is available (${message}).`
    }
  }
}
