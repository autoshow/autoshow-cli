import type {
  Step1Metadata,
  Step2Metadata,
  Step3Metadata,
  Step4Metadata,
  Step5Metadata,
  Step6VideoMetadata,
  Step7MusicMetadata,
  StepCostEntry,
  ActualCostBreakdown,
  EstimatedStepEntry,
  EstimatedCostBreakdown,
  AggregatedPriceEstimate
} from '~/types'
import { getSttCost, getLlmCost, getTtsCost, getTtsPricing, getImageCost, getVideoModelMeta, getMusicModelMeta } from '~/cli/commands/models/model-loader'
import { estimateVideoCost } from '~/cli/commands/process-steps/step-6-video/video-utils/video-pricing'
import { estimateMusicCost } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'

export const parseDurationToSeconds = (duration: string): number => {
  if (!duration || duration === 'Unknown') return 0
  const parts = duration.split(':').map(Number)
  if (parts.length === 3) return (parts[0]! * 3600) + (parts[1]! * 60) + parts[2]!
  if (parts.length === 2) return (parts[0]! * 60) + parts[1]!
  return 0
}

const computeTtsCost = (
  service: string,
  model: string,
  characterCount: number
): {
  cost: number
  costPer1kCharactersCents?: number
  inputCostPer1MCharactersCents?: number
  outputCostPer1MCharactersCents?: number
} => {
  const pricing = getTtsPricing(service, model)
  if (
    pricing.inputCostPer1MCharsCents !== undefined
    && pricing.outputCostPer1MCharsCents !== undefined
  ) {
    return {
      cost: (characterCount / 1e6) * (pricing.inputCostPer1MCharsCents + pricing.outputCostPer1MCharsCents),
      inputCostPer1MCharactersCents: pricing.inputCostPer1MCharsCents,
      outputCostPer1MCharactersCents: pricing.outputCostPer1MCharsCents
    }
  }

  const costPer1kCharactersCents = pricing.costPer1kCharsCents ?? getTtsCost(service, model)
  return {
    cost: (characterCount / 1000) * costPer1kCharactersCents,
    costPer1kCharactersCents
  }
}

const WHISPER_MODEL_PATH_PATTERN = /ggml-([a-z0-9.-]+)\.bin/i

const resolveTranscriptionModel = (metadata: Step2Metadata): string => {
  if (typeof metadata.transcriptionModelName === 'string' && metadata.transcriptionModelName.length > 0) {
    return metadata.transcriptionModelName
  }
  if (metadata.transcriptionService !== 'whisper') {
    return metadata.transcriptionModel
  }
  const match = metadata.transcriptionModel.match(WHISPER_MODEL_PATH_PATTERN)
  if (match && typeof match[1] === 'string' && match[1].length > 0) {
    return match[1]
  }
  return metadata.transcriptionModel
}

type ComputeActualCostsInput = {
  step1?: Step1Metadata | undefined
  step2?: Step2Metadata | undefined
  step3?: Step3Metadata | Step3Metadata[] | undefined
  step4?: Step4Metadata | undefined
  step5?: Step5Metadata | undefined
  step6?: Step6VideoMetadata | undefined
  step7?: Step7MusicMetadata | undefined
  ttsCharacterCount?: number | undefined
}

export const computeActualCosts = (input: ComputeActualCostsInput): ActualCostBreakdown => {
  const steps: StepCostEntry[] = []

  if (input.step1 && input.step2) {
    const durationSeconds = parseDurationToSeconds(input.step1.duration)
    const service = input.step2.transcriptionService
    const model = resolveTranscriptionModel(input.step2)
    let cost = 0

    if (service === 'whisper') {
      const sttCost = getSttCost('whisper', model)
      cost = (durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
    } else if (service === 'groq') {
      const sttCost = getSttCost('groq', model)
      cost = (durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
    } else if (service === 'elevenlabs') {
      const sttCost = getSttCost('elevenlabs', model)
      cost = (durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
    } else if (service === 'openai') {
      const sttCost = getSttCost('openai', model)
      cost = (durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
    } else if (service === 'mistral') {
      const sttCost = getSttCost('mistral', model)
      cost = (durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
    } else if (service === 'assemblyai') {
      const sttCost = getSttCost('assemblyai', model)
      cost = (durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
    }

    steps.push({
      step: 'stt',
      provider: service,
      model,
      cost,
      inputMetric: 'durationSeconds',
      inputValue: durationSeconds
    })
  }

  const step3Array = input.step3
    ? Array.isArray(input.step3) ? input.step3 : [input.step3]
    : []

  for (const s3 of step3Array) {
    const registryService = s3.llmService === 'llama.cpp' ? 'llama' : s3.llmService
    const rates = getLlmCost(registryService, s3.llmModel)
    const inputCost = (s3.inputTokenCount / 1e6) * (rates?.inputCostPer1MCents ?? 0)
    const outputCost = (s3.outputTokenCount / 1e6) * (rates?.outputCostPer1MCents ?? 0)
    steps.push({
      step: 'llm',
      provider: s3.llmService,
      model: s3.llmModel,
      cost: inputCost + outputCost,
      inputMetric: 'tokens',
      inputValue: s3.inputTokenCount + s3.outputTokenCount
    })
  }

  if (input.step4 && typeof input.ttsCharacterCount === 'number') {
    const ttsCost = computeTtsCost(input.step4.ttsService, input.step4.ttsModel, input.ttsCharacterCount)
    steps.push({
      step: 'tts',
      provider: input.step4.ttsService,
      model: input.step4.ttsModel,
      cost: ttsCost.cost,
      inputMetric: 'characters',
      inputValue: input.ttsCharacterCount
    })
  }

  if (input.step5) {
    const cost = getImageCost(input.step5.imageService, input.step5.imageModel)
    steps.push({
      step: 'image',
      provider: input.step5.imageService,
      model: input.step5.imageModel,
      cost,
      inputMetric: 'images',
      inputValue: 1
    })
  }

  if (input.step6) {
    const meta = getVideoModelMeta(input.step6.videoGenService, input.step6.videoGenModel)
    let cost = 0
    const videoDuration = input.step6.videoDuration ?? 0
    if (meta) {
      if (meta.blockSizeSec && (meta.blockCost720pCents || meta.blockCost1080pCents)) {
        const blockCount = Math.max(1, Math.ceil(videoDuration / meta.blockSizeSec))
        cost = blockCount * (meta.blockCost720pCents ?? 0)
      } else {
        cost = ((meta.baseCostPerSecondCents ?? 0) * videoDuration) + (meta.baseJobFeeCents ?? 0)
      }
    }
    steps.push({
      step: 'video',
      provider: input.step6.videoGenService,
      model: input.step6.videoGenModel,
      cost,
      inputMetric: 'durationSeconds',
      inputValue: videoDuration
    })
  }

  if (input.step7) {
    const meta = getMusicModelMeta(input.step7.musicService, input.step7.musicModel)
    let cost = 0
    if (meta) {
      if (typeof meta.costPerTrackCents === 'number') {
        cost = meta.costPerTrackCents
        if (input.step7.lyricsSource === 'generated' && typeof meta.lyricsCostPerTrackCents === 'number') {
          cost += meta.lyricsCostPerTrackCents
        }
      } else if (typeof meta.costPerMinuteCents === 'number' && typeof input.step7.musicDurationMs === 'number') {
        cost = meta.costPerMinuteCents * (input.step7.musicDurationMs / 60000)
      }
    }
    steps.push({
      step: 'music',
      provider: input.step7.musicService,
      model: input.step7.musicModel,
      cost,
      ...(typeof input.step7.musicDurationMs === 'number'
        ? { inputMetric: 'durationMs' as const, inputValue: input.step7.musicDurationMs }
        : { inputMetric: 'tracks' as const, inputValue: 1 })
    })
  }

  const totalCost = steps.reduce((sum, s) => sum + s.cost, 0)
  return { totalCost, steps }
}

type ComputeEstimatedCostsInput = {
  whisperModel?: string | undefined
  groqSttModel?: string | undefined
  elevenlabsSttModel?: string | undefined
  openaiSttModel?: string | undefined
  mistralSttModel?: string | undefined
  assemblyaiSttModel?: string | undefined
  useReverb?: boolean | undefined
  audioDurationSeconds?: number | undefined
  llmService?: string | undefined
  llmModel?: string | undefined
  llmInputTokenCount?: number | undefined
  llmOutputTokenCount?: number | undefined
  skipLLM?: boolean | undefined
  ttsService?: string | undefined
  ttsModel?: string | undefined
  ttsCharacterCount?: number | undefined
  geminiImageModel?: string | undefined
  openaiImageModel?: string | undefined
  minimaxImageModel?: string | undefined
  imagenCount?: number | undefined
  soraVideoModel?: string | undefined
  geminiVideoModel?: string | undefined
  minimaxVideoModel?: string | undefined
  videoDuration?: number | undefined
  videoSize?: string | undefined
  videoResolution?: string | undefined
  elevenlabsMusicModel?: string | undefined
  minimaxMusicModel?: string | undefined
  musicDuration?: number | undefined
  musicLyricsFile?: string | undefined
  musicInstrumental?: boolean | undefined
}

export const computeEstimatedCosts = (input: ComputeEstimatedCostsInput): EstimatedCostBreakdown => {
  const steps: EstimatedStepEntry[] = []
  let totalCost = 0
  const durationSeconds = input.audioDurationSeconds ?? 0

  if (input.useReverb) {
    steps.push({ step: 'stt', provider: 'reverb', model: 'reverb', cost: 0, durationSeconds })
  } else if (input.elevenlabsSttModel) {
    const sttCost = getSttCost('elevenlabs', input.elevenlabsSttModel)
    const cost = (durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
    totalCost += cost
    steps.push({ step: 'stt', provider: 'elevenlabs', model: input.elevenlabsSttModel, cost, durationSeconds })
  } else if (input.groqSttModel) {
    const sttCost = getSttCost('groq', input.groqSttModel)
    const cost = (durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
    totalCost += cost
    steps.push({ step: 'stt', provider: 'groq', model: input.groqSttModel, cost, durationSeconds })
  } else if (input.openaiSttModel) {
    const sttCost = getSttCost('openai', input.openaiSttModel)
    const cost = (durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
    totalCost += cost
    steps.push({ step: 'stt', provider: 'openai', model: input.openaiSttModel, cost, durationSeconds })
  } else if (input.mistralSttModel) {
    const sttCost = getSttCost('mistral', input.mistralSttModel)
    const cost = (durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
    totalCost += cost
    steps.push({ step: 'stt', provider: 'mistral', model: input.mistralSttModel, cost, durationSeconds })
  } else if (input.assemblyaiSttModel) {
    const sttCost = getSttCost('assemblyai', input.assemblyaiSttModel)
    const cost = (durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
    totalCost += cost
    steps.push({ step: 'stt', provider: 'assemblyai', model: input.assemblyaiSttModel, cost, durationSeconds })
  } else if (input.whisperModel) {
    const sttCost = getSttCost('whisper', input.whisperModel)
    const cost = (durationSeconds / 3600) * (sttCost.costPerHourCents ?? 0)
    totalCost += cost
    steps.push({ step: 'stt', provider: 'whisper', model: input.whisperModel, cost, durationSeconds })
  }

  if (!input.skipLLM && input.llmService && input.llmModel) {
    const registryService = input.llmService === 'llama.cpp' ? 'llama' : input.llmService
    const rates = getLlmCost(registryService, input.llmModel)
    if (rates) {
      const estimatedInputTokens = typeof input.llmInputTokenCount === 'number' ? input.llmInputTokenCount : 0
      const estimatedOutputTokens = typeof input.llmOutputTokenCount === 'number' ? input.llmOutputTokenCount : 0
      const cost =
        (estimatedInputTokens / 1_000_000) * rates.inputCostPer1MCents
        + (estimatedOutputTokens / 1_000_000) * rates.outputCostPer1MCents
      totalCost += cost
      steps.push({
        step: 'llm',
        provider: input.llmService,
        model: input.llmModel,
        cost,
        inputCostPer1MCents: rates.inputCostPer1MCents,
        outputCostPer1MCents: rates.outputCostPer1MCents,
        estimatedInputTokens,
        estimatedOutputTokens
      })
    }
  }

  if (input.ttsService && input.ttsModel) {
    const resolvedTtsCharacterCount = typeof input.ttsCharacterCount === 'number' ? input.ttsCharacterCount : 0
    const ttsCost = computeTtsCost(input.ttsService, input.ttsModel, resolvedTtsCharacterCount)
    const pricing = getTtsPricing(input.ttsService, input.ttsModel)
    const hasDualRates = pricing.inputCostPer1MCharsCents !== undefined && pricing.outputCostPer1MCharsCents !== undefined
    const costPer1kCharsCents = hasDualRates ? undefined : (pricing.costPer1kCharsCents ?? getTtsCost(input.ttsService, input.ttsModel))

    totalCost += ttsCost.cost
    steps.push({
      step: 'tts',
      provider: input.ttsService,
      model: input.ttsModel,
      cost: ttsCost.cost,
      ...(costPer1kCharsCents !== undefined ? { costPer1kCharactersCents: costPer1kCharsCents } : {}),
      ...(pricing.inputCostPer1MCharsCents !== undefined ? { inputCostPer1MCharactersCents: pricing.inputCostPer1MCharsCents } : {}),
      ...(pricing.outputCostPer1MCharsCents !== undefined ? { outputCostPer1MCharactersCents: pricing.outputCostPer1MCharsCents } : {})
    })
  }

  const imageModel = input.geminiImageModel || input.openaiImageModel || input.minimaxImageModel
  if (imageModel) {
    const imageService = input.geminiImageModel ? 'gemini'
      : input.openaiImageModel ? 'openai'
        : 'minimax'
    const count = imageService === 'gemini' ? (input.imagenCount ?? 1) : 1
    const costPerImageCents = getImageCost(imageService, imageModel)
    const cost = costPerImageCents * count
    totalCost += cost
    steps.push({ step: 'image', provider: imageService, model: imageModel, cost })
  }

  const hasVideo = input.soraVideoModel || input.geminiVideoModel || input.minimaxVideoModel
  if (hasVideo) {
    const estimate = estimateVideoCost({
      soraVideoModel: input.soraVideoModel,
      geminiVideoModel: input.geminiVideoModel,
      minimaxVideoModel: input.minimaxVideoModel,
      videoDuration: input.videoDuration,
      videoSize: input.videoSize,
      videoResolution: input.videoResolution
    })
    totalCost += estimate.totalCost
    steps.push({ step: 'video', provider: estimate.provider, model: estimate.model, cost: estimate.totalCost })
  }

  const hasMusic = input.elevenlabsMusicModel || input.minimaxMusicModel
  if (hasMusic) {
    const estimate = estimateMusicCost({
      elevenlabsMusicModel: input.elevenlabsMusicModel,
      minimaxMusicModel: input.minimaxMusicModel,
      musicDuration: input.musicDuration,
      musicLyricsFile: input.musicLyricsFile,
      musicInstrumental: input.musicInstrumental
    })
    if (estimate) {
      totalCost += estimate.totalCost
      steps.push({ step: 'music', provider: estimate.provider, model: estimate.model, cost: estimate.totalCost })
    }
  }

  return { totalCost, steps }
}

export const preflightToEstimated = (estimate: AggregatedPriceEstimate): EstimatedCostBreakdown => {
  const steps: EstimatedStepEntry[] = []

  for (const s of estimate.steps) {
    switch (s.step) {
      case 'stt':
        steps.push({
          step: 'stt',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          durationSeconds: s.durationSeconds
        })
        break
      case 'llm':
        steps.push({
          step: 'llm',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          inputCostPer1MCents: s.inputCostPer1MCents,
          outputCostPer1MCents: s.outputCostPer1MCents,
          ...(typeof s.estimatedInputTokens === 'number' ? { estimatedInputTokens: s.estimatedInputTokens } : {}),
          ...(typeof s.estimatedOutputTokens === 'number' ? { estimatedOutputTokens: s.estimatedOutputTokens } : {})
        })
        break
      case 'tts':
        steps.push({
          step: 'tts',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost,
          ...(s.costPer1kCharactersCents !== undefined ? { costPer1kCharactersCents: s.costPer1kCharactersCents } : {}),
          ...(s.inputCostPer1MCharactersCents !== undefined ? { inputCostPer1MCharactersCents: s.inputCostPer1MCharactersCents } : {}),
          ...(s.outputCostPer1MCharactersCents !== undefined ? { outputCostPer1MCharactersCents: s.outputCostPer1MCharactersCents } : {})
        })
        break
      case 'image':
        steps.push({ step: 'image', provider: s.provider, model: s.model, cost: s.totalCost })
        break
      case 'video':
        steps.push({ step: 'video', provider: s.provider, model: s.model, cost: s.totalCost })
        break
      case 'music':
        steps.push({
          step: 'music',
          provider: s.provider,
          model: s.model,
          cost: s.totalCost
        })
        break
      case 'extract':
        break
    }
  }

  return {
    totalCost: estimate.totalEstimatedCost,
    steps
  }
}
