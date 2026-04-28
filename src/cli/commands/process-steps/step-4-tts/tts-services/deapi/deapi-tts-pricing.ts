import type { DeapiTtsModel } from '~/types'
import { getTtsCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { getDeapiApiKey, requestDeapiJsonPrice } from '~/utils/deapi'
import { getDeapiTtsModelConfig } from './run-deapi-tts'

export type DeapiTtsResolvedPrice = {
  totalCost: number
  source: 'provider_quote' | 'registry_fallback'
  estimateType: 'exact' | 'heuristic'
  warning?: string | undefined
}

const fallbackDeapiTtsCost = (
  model: DeapiTtsModel,
  characterCount: number,
  warning?: string | undefined
): DeapiTtsResolvedPrice => ({
  totalCost: (Math.max(0, Math.floor(characterCount)) / 1000) * getTtsCost('deapi', model),
  source: 'registry_fallback',
  estimateType: 'heuristic',
  ...(warning ? { warning } : {})
})

export const resolveDeapiTtsPrice = async (
  options: {
    model: DeapiTtsModel
    characterCount: number
    voice?: string | undefined
  }
): Promise<DeapiTtsResolvedPrice> => {
  const config = getDeapiTtsModelConfig(options.model, options.voice)
  const apiKey = getDeapiApiKey()
  if (!apiKey) {
    return fallbackDeapiTtsCost(
      options.model,
      options.characterCount,
      'DEAPI_API_KEY is not set; using local deAPI TTS registry pricing.'
    )
  }

  try {
    const priceUsd = await requestDeapiJsonPrice({
      apiKey,
      path: '/api/v2/audio/speech/price',
      operationName: 'deapi-tts-price',
      body: {
        model: options.model,
        mode: 'custom_voice',
        count_text: Math.max(0, Math.floor(options.characterCount)),
        lang: config.lang,
        speed: config.speed,
        format: config.format,
        sample_rate: config.sampleRate,
        voice: config.voice
      }
    })

    return {
      totalCost: priceUsd * 100,
      source: 'provider_quote',
      estimateType: 'exact'
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return fallbackDeapiTtsCost(
      options.model,
      options.characterCount,
      `deAPI exact TTS pricing failed; using local registry fallback (${message}).`
    )
  }
}
