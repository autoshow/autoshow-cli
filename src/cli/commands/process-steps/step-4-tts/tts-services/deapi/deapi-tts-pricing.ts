import type { DeapiTtsModel } from '~/types'
import { getTtsCost } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { getDeapiApiKey, requestDeapiJsonPrice } from '~/utils/deapi'
import { DEAPI_TTS_VOICE_DESIGN_MODEL, type DeapiTtsMode, getDeapiTtsModelConfig } from './run-deapi-tts'

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
    mode?: DeapiTtsMode | undefined
  }
): Promise<DeapiTtsResolvedPrice> => {
  const config = getDeapiTtsModelConfig(options.model, options.voice)
  const mode = options.mode ?? (options.model === DEAPI_TTS_VOICE_DESIGN_MODEL ? 'voice_design' : 'custom_voice')
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
        mode,
        count_text: Math.max(0, Math.floor(options.characterCount)),
        lang: config.lang,
        speed: config.speed,
        format: config.format,
        sample_rate: config.sampleRate,
        ...(mode === 'custom_voice' && config.voice ? { voice: config.voice } : {})
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
