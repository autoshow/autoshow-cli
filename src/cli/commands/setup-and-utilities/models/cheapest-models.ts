import { estimateVideoCost } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { getModelRegistry } from './model-loader'
import type { CheapestVideoSelection } from '~/types'

const PERFORMANCE_TIE_BREAKERS = ['mini', 'nano', 'micro', 'flash', 'turbo', 'fast', 'small']

const DEFAULT_LOCAL_MODEL_BY_FLAG = {
  whisper: 'tiny',
  llama: 'ggml-org/gemma-3-270m-it-GGUF',
  'kitten-tts': 'kitten-tts-nano-0.8-int8',
} as const satisfies Record<string, string>

const DEFAULT_OCR_INPUT_TOKENS_PER_PAGE = 4000
const DEFAULT_OCR_OUTPUT_TOKENS_PER_PAGE = 1000

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

export const selectCheapestExtractModel = (service: 'mistral' | 'glm' | 'kimi' | 'openai' | 'anthropic' | 'gemini' | 'deepinfra'): string => {
  const serviceConfig = getModelRegistry().extract[service]
  if (!serviceConfig) {
    throw new Error(`Missing extract service config: ${service}`)
  }

  return selectCheapestRegistryModel(serviceConfig.models, (model) => {
    if (typeof model.costPer1kPagesCents === 'number') {
      return model.costPer1kPagesCents / 1000
    }
    if (typeof model.costPer1kPagesUSD === 'number') {
      return (model.costPer1kPagesUSD * 100) / 1000
    }
    if (typeof model.costPerMInputTokensCents === 'number' && typeof model.costPerMOutputTokensCents === 'number') {
      const promptTokensPerPage = model.estimation?.promptTokensPerPage ?? DEFAULT_OCR_INPUT_TOKENS_PER_PAGE
      const completionTokensPerPage = model.estimation?.completionTokensPerPage ?? DEFAULT_OCR_OUTPUT_TOKENS_PER_PAGE
      return (promptTokensPerPage / 1_000_000) * model.costPerMInputTokensCents
        + (completionTokensPerPage / 1_000_000) * model.costPerMOutputTokensCents
    }
    if (typeof model.costPerMInputTokensUSD === 'number' && typeof model.costPerMOutputTokensUSD === 'number') {
      const promptTokensPerPage = model.estimation?.promptTokensPerPage ?? DEFAULT_OCR_INPUT_TOKENS_PER_PAGE
      const completionTokensPerPage = model.estimation?.completionTokensPerPage ?? DEFAULT_OCR_OUTPUT_TOKENS_PER_PAGE
      return (promptTokensPerPage / 1_000_000) * (model.costPerMInputTokensUSD * 100)
        + (completionTokensPerPage / 1_000_000) * (model.costPerMOutputTokensUSD * 100)
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
  provider: 'gemini' | 'minimax' | 'glm' | 'grok' | 'runway' | 'deapi'
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
          const estimate = estimateVideoCost({
            ...(provider === 'gemini' ? { geminiVideoModel: model } : {}),
            ...(provider === 'minimax' ? { minimaxVideoModel: model } : {}),
            ...(provider === 'glm' ? { glmVideoModel: model } : {}),
            ...(provider === 'grok' ? { grokVideoModel: model } : {}),
            ...(provider === 'runway' ? { runwayVideoModel: model } : {}),
            ...(provider === 'deapi' ? { deapiVideoModel: model } : {}),
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
  provider: 'gemini' | 'minimax' | 'glm' | 'grok' | 'runway' | 'deapi'
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
    case 'grok-stt':
      return selectCheapestSttModel('grok')
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
    case 'scrapecreators-stt':
      return 'youtube-transcript'
    case 'openai-stt':
      return selectCheapestSttModel('openai-stt')
    case 'gemini-stt':
      return selectCheapestSttModel('gemini-stt')
    case 'glm-stt':
      return selectCheapestSttModel('glm-stt')
    case 'together-stt':
      return selectCheapestSttModel('together')
    case 'mistral-ocr':
      return selectCheapestExtractModel('mistral')
    case 'glm-ocr':
      return selectCheapestExtractModel('glm')
    case 'kimi-ocr':
      return selectCheapestExtractModel('kimi')
    case 'openai-ocr':
      return selectCheapestExtractModel('openai')
    case 'anthropic-ocr':
      return selectCheapestExtractModel('anthropic')
    case 'gemini-ocr':
      return selectCheapestExtractModel('gemini')
    case 'deepinfra-ocr':
      return selectCheapestExtractModel('deepinfra')
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
    case 'glm':
      return selectCheapestLlmModel('glm')
    case 'kimi':
      return selectCheapestLlmModel('kimi')
    case 'elevenlabs-tts':
      return selectCheapestTtsModel('elevenlabs')
    case 'minimax-tts':
      return selectCheapestTtsModel('minimax')
    case 'groq-tts':
      return selectCheapestTtsModel('groq')
    case 'grok-tts':
      return selectCheapestTtsModel('grok')
    case 'mistral-tts':
      return selectCheapestTtsModel('mistral')
    case 'openai-tts':
      return selectCheapestTtsModel('openai')
    case 'gemini-tts':
      return selectCheapestTtsModel('gemini')
    case 'deepgram-tts':
      return selectCheapestTtsModel('deepgram')
    case 'runway-tts':
      return selectCheapestTtsModel('runway')
    case 'speechify-tts':
      return selectCheapestTtsModel('speechify')
    case 'gcloud-tts':
      return selectCheapestTtsModel('gcloud')
    case 'deapi-tts':
      return selectCheapestTtsModel('deapi')
    case 'gemini-image':
      return selectCheapestImageModel('gemini')
    case 'openai-image':
      return selectCheapestImageModel('openai')
    case 'minimax-image':
      return selectCheapestImageModel('minimax')
    case 'glm-image':
      return selectCheapestImageModel('glm')
    case 'grok-image':
      return selectCheapestImageModel('grok')
    case 'runway-image':
      return selectCheapestImageModel('runway')
    case 'bfl-image':
      return selectCheapestImageModel('bfl')
    case 'deapi-image':
      return selectCheapestImageModel('deapi')
    case 'elevenlabs-music':
      return selectCheapestMusicModel('elevenlabs')
    case 'minimax-music':
      return selectCheapestMusicModel('minimax')
    case 'deapi-music':
      return selectCheapestMusicModel('deapi')
    case 'gemini-music':
      return selectCheapestMusicModel('gemini')
    case 'gemini-video':
      return selectCheapestVideoModel('gemini')
    case 'minimax-video':
      return selectCheapestVideoModel('minimax')
    case 'glm-video':
      return selectCheapestVideoModel('glm')
    case 'grok-video':
      return selectCheapestVideoModel('grok')
    case 'runway-video':
      return selectCheapestVideoModel('runway')
    case 'deapi-video':
      return selectCheapestVideoModel('deapi')
    default:
      return undefined
  }
}
