import { estimateVideoCost } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { getModelRegistry } from './model-loader'
import type { CheapestVideoSelection } from '~/types'

const PERFORMANCE_TIE_BREAKERS = ['mini', 'nano', 'micro', 'flash', 'turbo', 'fast', 'small']

const DEFAULT_LOCAL_MODEL_BY_FLAG = {
  whisper: 'tiny',
  llama: 'ggml-org/gemma-3-270m-it-GGUF',
  'kitten-tts': 'kitten-tts-nano-0.8-int8',
} as const satisfies Record<string, string>

const runtimeRank = (model: string): number => {
  const lower = model.toLowerCase()
  const idx = PERFORMANCE_TIE_BREAKERS.findIndex(token => lower.includes(token))
  return idx === -1 ? PERFORMANCE_TIE_BREAKERS.length : idx
}

const pickCheapestModel = (
  modelNames: string[],
  costForModel: (model: string) => number
): string => {
  const firstModel = modelNames[0]
  if (!firstModel) {
    throw new Error('No models available to select from')
  }

  return modelNames
    .slice()
    .sort((a, b) => {
      const costDelta = costForModel(a) - costForModel(b)
      if (costDelta !== 0) return costDelta

      const rankDelta = runtimeRank(a) - runtimeRank(b)
      if (rankDelta !== 0) return rankDelta

      return a.localeCompare(b)
    })[0] ?? firstModel
}

const selectCheapestRegistryModel = <T extends Record<string, unknown>>(
  models: Record<string, T>,
  costForModel: (model: T) => number
): string =>
  pickCheapestModel(Object.keys(models), (modelName) => {
    const meta = models[modelName]
    return meta ? costForModel(meta) : Number.POSITIVE_INFINITY
  })

const sttHourlyCost = (model: {
  costPerHourUSD?: number | undefined
  costPerHourCents?: number | undefined
  costPerThreeHours?: number | undefined
}): number => {
  if (typeof model.costPerHourCents === 'number') {
    return model.costPerHourCents
  }
  if (typeof model.costPerHourUSD === 'number') {
    return model.costPerHourUSD * 100
  }
  if (typeof model.costPerThreeHours === 'number') {
    return (model.costPerThreeHours * 100) / 3
  }
  return Number.POSITIVE_INFINITY
}

const qualityRank = (selection: { size?: string | undefined, resolution?: string | undefined }): number => {
  if (selection.size === '1024x1792' || selection.size === '1792x1024') return 2
  if (selection.resolution === '1080p') return 2
  return 1
}

export const selectCheapestSttModel = (service: string): string => {
  const serviceConfig = getModelRegistry().stt[service]
  if (!serviceConfig) {
    throw new Error(`Missing STT service config: ${service}`)
  }

  return selectCheapestRegistryModel(serviceConfig.models, sttHourlyCost)
}

export const selectCheapestExtractModel = (service: 'mistral' | 'glm' | 'openai' | 'anthropic' | 'gemini'): string => {
  const serviceConfig = getModelRegistry().extract[service]
  if (!serviceConfig) {
    throw new Error(`Missing extract service config: ${service}`)
  }

  return selectCheapestRegistryModel(serviceConfig.models, (model) => {
    if (typeof model.costPer1kPagesCents === 'number') {
      return model.costPer1kPagesCents
    }
    if (typeof model.costPer1kPagesUSD === 'number') {
      return model.costPer1kPagesUSD * 100
    }
    if (typeof model.costPerMInputTokensCents === 'number' && typeof model.costPerMOutputTokensCents === 'number') {
      return model.costPerMInputTokensCents + model.costPerMOutputTokensCents
    }
    if (typeof model.costPerMInputTokensUSD === 'number' && typeof model.costPerMOutputTokensUSD === 'number') {
      return (model.costPerMInputTokensUSD + model.costPerMOutputTokensUSD) * 100
    }
    return Number.POSITIVE_INFINITY
  })
}

export const selectCheapestLlmModel = (service: string): string => {
  const serviceConfig = getModelRegistry().llm[service]
  if (!serviceConfig) {
    throw new Error(`Missing LLM service config: ${service}`)
  }

  return selectCheapestRegistryModel(serviceConfig.models, (model) =>
    model.inputCostPer1MCents + model.outputCostPer1MCents
  )
}

export const selectCheapestTtsModel = (service: string): string => {
  const serviceConfig = getModelRegistry().tts[service]
  if (!serviceConfig) {
    throw new Error(`Missing TTS service config: ${service}`)
  }

  return selectCheapestRegistryModel(serviceConfig.models, (model) => {
    if (typeof model.costPer1kCharsCents === 'number') {
      return model.costPer1kCharsCents
    }
    if (typeof model.costPer1kCharsUSD === 'number') {
      return model.costPer1kCharsUSD * 100
    }
    if (typeof model.inputCostPer1MCharsCents === 'number' && typeof model.outputCostPer1MCharsCents === 'number') {
      return (model.inputCostPer1MCharsCents + model.outputCostPer1MCharsCents) / 1000
    }
    if (typeof model.inputCostPer1MCharsUSD === 'number' && typeof model.outputCostPer1MCharsUSD === 'number') {
      return ((model.inputCostPer1MCharsUSD + model.outputCostPer1MCharsUSD) * 100) / 1000
    }
    return Number.POSITIVE_INFINITY
  })
}

export const selectCheapestImageModel = (service: string): string => {
  const serviceConfig = getModelRegistry().image[service]
  if (!serviceConfig) {
    throw new Error(`Missing image service config: ${service}`)
  }

  return selectCheapestRegistryModel(serviceConfig.models, (model) =>
    typeof model.costPerImageCents === 'number'
      ? model.costPerImageCents
      : model.costPerImageUSD * 100
  )
}

export const selectCheapestMusicModel = (service: string): string => {
  const serviceConfig = getModelRegistry().music[service]
  if (!serviceConfig) {
    throw new Error(`Missing music service config: ${service}`)
  }

  return selectCheapestRegistryModel(serviceConfig.models, (model) => {
    if (typeof model.costPerTrackCents === 'number') {
      return model.costPerTrackCents
    }
    if (typeof model.costPerTrackUSD === 'number') {
      return model.costPerTrackUSD * 100
    }
    if (typeof model.costPerMinuteCents === 'number') {
      return model.costPerMinuteCents
    }
    if (typeof model.costPerMinuteUSD === 'number') {
      return model.costPerMinuteUSD * 100
    }
    return Number.POSITIVE_INFINITY
  })
}

export const selectCheapestVideoSelection = (
  provider: 'gemini' | 'minimax'
): CheapestVideoSelection => {
  const serviceConfig = getModelRegistry().video[provider]
  if (!serviceConfig) {
    throw new Error(`Missing video service config: ${provider}`)
  }

  const models = Object.keys(serviceConfig.models)
  const durations = serviceConfig.billedDurations && serviceConfig.billedDurations.length > 0
    ? serviceConfig.billedDurations
    : [4]
  const sizes = [undefined]
  const resolutions = serviceConfig.resolutions && serviceConfig.resolutions.length > 0
    ? serviceConfig.resolutions
    : ['720p']

  let best: CheapestVideoSelection | null = null

  for (const model of models) {
    for (const duration of durations) {
      for (const size of sizes) {
        for (const resolution of resolutions) {
          const estimate = provider === 'gemini'
            ? estimateVideoCost({
                geminiVideoModel: model,
                videoDuration: duration,
                videoResolution: resolution
              })
            : estimateVideoCost({
                minimaxVideoModel: model,
                videoDuration: duration,
                videoResolution: resolution
              })

          const candidate: CheapestVideoSelection = {
            provider,
            model,
            duration,
            ...(size ? { size } : {}),
            ...(resolution ? { resolution } : {}),
            totalCost: estimate.totalCost
          }

          if (!best) {
            best = candidate
            continue
          }

          const candidateWinsByCost = candidate.totalCost < best.totalCost
          const candidateWinsByDuration = candidate.totalCost === best.totalCost && candidate.duration < best.duration
          const candidateWinsByQuality = candidate.totalCost === best.totalCost
            && candidate.duration === best.duration
            && qualityRank(candidate) < qualityRank(best)
          const candidateWinsBySpeedHint = candidate.totalCost === best.totalCost
            && candidate.duration === best.duration
            && qualityRank(candidate) === qualityRank(best)
            && runtimeRank(candidate.model) < runtimeRank(best.model)
          const candidateWinsByName = candidate.totalCost === best.totalCost
            && candidate.duration === best.duration
            && qualityRank(candidate) === qualityRank(best)
            && runtimeRank(candidate.model) === runtimeRank(best.model)
            && candidate.model.localeCompare(best.model) < 0

          if (candidateWinsByCost || candidateWinsByDuration || candidateWinsByQuality || candidateWinsBySpeedHint || candidateWinsByName) {
            best = candidate
          }
        }
      }
    }
  }

  if (!best) {
    throw new Error(`No video candidates available for ${provider}`)
  }

  return best
}

export const selectCheapestVideoModel = (
  provider: 'gemini' | 'minimax'
): string => selectCheapestVideoSelection(provider).model

export const resolveCheapestModelForFlag = (flagName: string): string | undefined => {
  const localDefault = DEFAULT_LOCAL_MODEL_BY_FLAG[flagName as keyof typeof DEFAULT_LOCAL_MODEL_BY_FLAG]
  if (localDefault) {
    return localDefault
  }

  switch (flagName) {
    case 'gcloud-stt':
      return selectCheapestSttModel('gcloud')
    case 'aws-stt':
      return selectCheapestSttModel('aws')
    case 'deepinfra-stt':
      return selectCheapestSttModel('deepinfra')
    case 'deapi-stt':
      return selectCheapestSttModel('deapi')
    case 'elevenlabs-stt':
      return selectCheapestSttModel('elevenlabs')
    case 'deepgram-stt':
      return selectCheapestSttModel('deepgram')
    case 'soniox-stt':
      return selectCheapestSttModel('soniox')
    case 'speechmatics-stt':
      return selectCheapestSttModel('speechmatics')
    case 'rev-stt':
      return selectCheapestSttModel('rev')
    case 'groq-stt':
      return selectCheapestSttModel('groq')
    case 'mistral-stt':
      return selectCheapestSttModel('mistral')
    case 'assemblyai-stt':
      return selectCheapestSttModel('assemblyai')
    case 'gladia-stt':
      return selectCheapestSttModel('gladia')
    case 'happyscribe-stt':
      return selectCheapestSttModel('happyscribe')
    case 'supadata-stt':
      return 'auto'
    case 'mistral-ocr':
      return selectCheapestExtractModel('mistral')
    case 'glm-ocr':
      return selectCheapestExtractModel('glm')
    case 'openai-ocr':
      return selectCheapestExtractModel('openai')
    case 'anthropic-ocr':
      return selectCheapestExtractModel('anthropic')
    case 'gemini-ocr':
      return selectCheapestExtractModel('gemini')
    case 'openai':
      return selectCheapestLlmModel('openai')
    case 'groq':
      return selectCheapestLlmModel('groq')
    case 'gemini':
      return selectCheapestLlmModel('gemini')
    case 'anthropic':
      return selectCheapestLlmModel('anthropic')
    case 'minimax':
      return selectCheapestLlmModel('minimax')
    case 'grok':
      return selectCheapestLlmModel('grok')
    case 'elevenlabs-tts':
      return selectCheapestTtsModel('elevenlabs')
    case 'minimax-tts':
      return selectCheapestTtsModel('minimax')
    case 'groq-tts':
      return selectCheapestTtsModel('groq')
    case 'openai-tts':
      return selectCheapestTtsModel('openai')
    case 'gemini-tts':
      return selectCheapestTtsModel('gemini')
    case 'gemini-image':
      return selectCheapestImageModel('gemini')
    case 'openai-image':
      return selectCheapestImageModel('openai')
    case 'minimax-image':
      return selectCheapestImageModel('minimax')
    case 'elevenlabs-music':
      return selectCheapestMusicModel('elevenlabs')
    case 'minimax-music':
      return selectCheapestMusicModel('minimax')
    case 'gemini-video':
      return selectCheapestVideoModel('gemini')
    case 'minimax-video':
      return selectCheapestVideoModel('minimax')
    default:
      return undefined
  }
}
