import { getModelRegistry } from '../../src/cli/commands/models/model-loader'
import type { VideoProvider } from '../../src/types/provider-types'
import { estimateVideoCost } from '../../src/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import type { ApiCheapPriceCommand, VideoSelection } from '../../src/types/tests-dir-types'
export type { ApiCheapPriceCommand } from '../../src/types/tests-dir-types'


const PERFORMANCE_TIE_BREAKERS = ['mini', 'nano', 'micro', 'flash', 'turbo', 'fast', 'small']

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

const sttHourlyCost = (costPerHourUSD: number | undefined, costPerThreeHours: number | undefined): number => {
  if (typeof costPerHourUSD === 'number') {
    return costPerHourUSD
  }
  if (typeof costPerThreeHours === 'number') {
    return costPerThreeHours / 3
  }
  return 0
}

const qualityRank = (selection: VideoSelection): number => {
  if (selection.size === '1024x1792' || selection.size === '1792x1024') return 2
  if (selection.resolution === '1080p') return 2
  return 1
}

const pickCheapestVideoSelection = (
  provider: VideoProvider,
  registry: ReturnType<typeof getModelRegistry>
): VideoSelection => {
  const serviceConfig = registry.video[provider]
  if (!serviceConfig) {
    throw new Error(`Missing video service config: ${provider}`)
  }

  const models = Object.keys(serviceConfig.models)
  const durations = serviceConfig.billedDurations && serviceConfig.billedDurations.length > 0
    ? serviceConfig.billedDurations
    : [4]
  const sizes = [undefined]
  const resolutions = serviceConfig.resolutions && serviceConfig.resolutions.length > 0 ? serviceConfig.resolutions : ['720p']

  let best: VideoSelection | null = null

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

          const candidate: VideoSelection = {
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

const pickCheapestExtractModel = (
  service: 'mistral',
  registry: ReturnType<typeof getModelRegistry>
): string => {
  const serviceConfig = registry.extract[service]
  if (!serviceConfig) {
    throw new Error(`Missing extract service config: ${service}`)
  }

  const models = Object.keys(serviceConfig.models)
  return pickCheapestModel(models, (model) => {
    const meta = serviceConfig.models[model]
    return meta ? (meta.costPer1kPagesUSD ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY
  })
}

export const buildApiCheapSelections = () => {
  const registry = getModelRegistry()

  const pickCheapestSttModel = (service: 'elevenlabs' | 'openai' | 'deepgram'): string => {
    const serviceConfig = registry.stt[service]
    if (!serviceConfig) {
      throw new Error(`Missing STT service config: ${service}`)
    }

    const models = Object.keys(serviceConfig.models)
    return pickCheapestModel(models, (model) => {
      const meta = serviceConfig.models[model]
      return meta ? sttHourlyCost(meta.costPerHourUSD, meta.costPerThreeHours) : Number.POSITIVE_INFINITY
    })
  }

  const pickCheapestLlmModel = (
    service: 'openai' | 'groq' | 'gemini' | 'anthropic' | 'minimax'
  ): string => {
    const serviceConfig = registry.llm[service]
    if (!serviceConfig) {
      throw new Error(`Missing LLM service config: ${service}`)
    }

    const models = Object.keys(serviceConfig.models)
    return pickCheapestModel(models, (model) => {
      const meta = serviceConfig.models[model]
      if (!meta) return Number.POSITIVE_INFINITY
      return meta.inputCostPer1MUSD + meta.outputCostPer1MUSD
    })
  }

  const pickCheapestTtsModel = (service: 'elevenlabs' | 'minimax' | 'groq' | 'openai' | 'gemini'): string => {
    const serviceConfig = registry.tts[service]
    if (!serviceConfig) {
      throw new Error(`Missing TTS service config: ${service}`)
    }

    const models = Object.keys(serviceConfig.models)
    return pickCheapestModel(models, (model) => {
      const meta = serviceConfig.models[model]
      if (!meta) return Number.POSITIVE_INFINITY
      if (typeof meta.costPer1kCharsUSD === 'number') {
        return meta.costPer1kCharsUSD
      }
      if (typeof meta.inputCostPer1MCharsUSD === 'number' && typeof meta.outputCostPer1MCharsUSD === 'number') {
        return (meta.inputCostPer1MCharsUSD + meta.outputCostPer1MCharsUSD) / 1000
      }
      return Number.POSITIVE_INFINITY
    })
  }

  const pickCheapestImageModel = (service: 'gemini' | 'openai' | 'minimax'): string => {
    const serviceConfig = registry.image[service]
    if (!serviceConfig) {
      throw new Error(`Missing image service config: ${service}`)
    }

    const models = Object.keys(serviceConfig.models)
    return pickCheapestModel(models, (model) => {
      const meta = serviceConfig.models[model]
      return meta ? meta.costPerImageUSD : Number.POSITIVE_INFINITY
    })
  }

  const groqSttService = registry.stt['groq']
  if (!groqSttService) {
    throw new Error('Missing groq service config for Groq STT coverage')
  }

  const groqWhisperModel = pickCheapestModel(
    Object.keys(groqSttService.models),
    (model) => {
      const meta = groqSttService.models[model]
      return meta ? sttHourlyCost(meta.costPerHourUSD, meta.costPerThreeHours) : Number.POSITIVE_INFINITY
    }
  )

  const llmSelections = [
    { service: 'openai', flag: '--openai', envVar: 'OPENAI_API_KEY', model: pickCheapestLlmModel('openai') },
    { service: 'groq', flag: '--groq', envVar: 'GROQ_API_KEY', model: pickCheapestLlmModel('groq') },
    { service: 'gemini', flag: '--gemini', envVar: 'GEMINI_API_KEY', model: pickCheapestLlmModel('gemini') },
    { service: 'anthropic', flag: '--anthropic', envVar: 'ANTHROPIC_API_KEY', model: pickCheapestLlmModel('anthropic') },
    { service: 'minimax', flag: '--minimax', envVar: 'MINIMAX_API_KEY', model: pickCheapestLlmModel('minimax') }
  ]

  const sttSelections = [
    { service: 'elevenlabs', flag: '--elevenlabs-stt', envVar: 'ELEVENLABS_API_KEY', model: pickCheapestSttModel('elevenlabs') },
    { service: 'deepgram', flag: '--deepgram-stt', envVar: 'DEEPGRAM_API_KEY', model: pickCheapestSttModel('deepgram') },
    { service: 'openai', flag: '--openai-stt', envVar: 'OPENAI_API_KEY', model: pickCheapestSttModel('openai') },
    { service: 'groq', flag: '--groq-stt', envVar: 'GROQ_API_KEY', model: groqWhisperModel }
  ]

  const ttsSelections = [
    { service: 'elevenlabs', flag: '--elevenlabs-tts', envVar: 'ELEVENLABS_API_KEY', model: pickCheapestTtsModel('elevenlabs') },
    { service: 'minimax', flag: '--minimax-tts', envVar: 'MINIMAX_API_KEY', model: pickCheapestTtsModel('minimax') },
    { service: 'groq', flag: '--groq-tts', envVar: 'GROQ_API_KEY', model: pickCheapestTtsModel('groq') },
    { service: 'openai', flag: '--openai-tts', envVar: 'OPENAI_API_KEY', model: pickCheapestTtsModel('openai') },
    { service: 'gemini', flag: '--gemini-tts', envVar: 'GEMINI_API_KEY', model: pickCheapestTtsModel('gemini') }
  ]

  const imageSelections = [
    { service: 'gemini', flag: '--gemini-image', envVar: 'GEMINI_API_KEY', model: pickCheapestImageModel('gemini') },
    { service: 'openai', flag: '--openai-image', envVar: 'OPENAI_API_KEY', model: pickCheapestImageModel('openai') },
    { service: 'minimax', flag: '--minimax-image', envVar: 'MINIMAX_API_KEY', model: pickCheapestImageModel('minimax') }
  ]

  const videoSelections = [
    pickCheapestVideoSelection('gemini', registry),
    pickCheapestVideoSelection('minimax', registry)
  ]

  const extractSelections = [
    { service: 'mistral', flag: '--mistral-ocr', envVar: 'MISTRAL_API_KEY', model: pickCheapestExtractModel('mistral', registry) }
  ]

  return {
    llmSelections,
    sttSelections,
    ttsSelections,
    imageSelections,
    videoSelections,
    extractSelections
  }
}

export const dedupePriceCommands = (commands: ApiCheapPriceCommand[]): ApiCheapPriceCommand[] => {
  const seen = new Set<string>()
  const out: ApiCheapPriceCommand[] = []

  for (const command of commands) {
    const key = command.args.join('\u001f')
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(command)
  }

  return out
}

export const buildApiCheapPriceCommands = (): ApiCheapPriceCommand[] => {
  const shortAudioPath = 'input/examples/audio/0-audio-short.mp3'
  const shortTtsPath = 'input/examples/document/0-tts-short.txt'
  const imagePrompt = 'a tiny red dot on white background'
  const videoPrompt = 'a static shot of a tiny red dot on white background'

  const {
    llmSelections,
    sttSelections,
    ttsSelections,
    imageSelections,
    videoSelections,
    extractSelections
  } = buildApiCheapSelections()

  const commands: ApiCheapPriceCommand[] = []

  for (const selection of llmSelections) {
    commands.push({
      name: `write-${selection.service}-${selection.model}`,
      args: [
        'src/cli/create-cli.ts',
        'write',
        shortAudioPath,
        selection.flag,
        selection.model,
        '--prompt',
        'shortSummary',
        '--price'
      ]
    })
  }

  for (const selection of sttSelections) {
    const args = [
      'src/cli/create-cli.ts',
      'stt',
      shortAudioPath,
      selection.flag,
      selection.model,
      '--price'
    ]
    if (selection.service === 'elevenlabs' || selection.service === 'openai') {
      args.push('--speaker-count', '1')
    }
    commands.push({
      name: `transcribe-${selection.service}-${selection.model}`,
      args
    })
  }

  for (const selection of ttsSelections) {
    commands.push({
      name: `tts-${selection.service}-${selection.model}`,
      args: ['src/cli/create-cli.ts', 'tts', shortTtsPath, selection.flag, selection.model, '--price']
    })
  }

  for (const selection of imageSelections) {
    const args = [
      'src/cli/create-cli.ts',
      'image',
      imagePrompt,
      selection.flag,
      selection.model,
      '--price'
    ]
    if (selection.service === 'openai') {
      args.push('--image-size', '1024x1024', '--image-quality', 'low', '--image-format', 'jpeg')
    }
    if (selection.service === 'gemini' && selection.model.startsWith('imagen-')) {
      args.push('--imagen-count', '1', '--image-aspect-ratio', '1:1', '--image-size', '1K')
    }
    commands.push({
      name: `image-${selection.service}-${selection.model}`,
      args
    })
  }

  for (const selection of videoSelections) {
    const args = [
      'src/cli/create-cli.ts',
      'video',
      videoPrompt,
      '--price',
      '--video-duration',
      String(selection.duration)
    ]

    if (selection.provider === 'gemini') {
      args.push('--gemini-video', selection.model)
      if (selection.resolution) args.push('--video-resolution', selection.resolution)
    } else {
      args.push('--minimax-video', selection.model)
      if (selection.resolution) args.push('--video-resolution', selection.resolution)
    }

    commands.push({
      name: `video-${selection.provider}-${selection.model}`,
      args
    })
  }

  for (const selection of extractSelections) {
    commands.push({
      name: `extract-${selection.service}-${selection.model}`,
      args: ['src/cli/create-cli.ts', 'ocr', 'input/examples/document/1-document.pdf', selection.flag, selection.model, '--price']
    })
  }

  return dedupePriceCommands(commands)
}
