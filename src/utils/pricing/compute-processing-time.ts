import { toArray } from '~/utils/text-utils'
import {
  getExtractEstimation,
  getImageEstimation,
  getLlmEstimation,
  getMusicEstimation,
  getSttEstimation,
  getTtsEstimation,
  getVideoEstimation,
} from '~/cli/commands/setup-and-utilities/models/model-loader'
import type {
  ComputeActualProcessingTimesInput,
  ComputeEstimatedProcessingTimesInput,
  ExtractionMetadata,
  Step2Metadata,
  StepTimingBreakdown,
  TimingStepEntry,
} from '~/types'

const WHISPER_MODEL_PATH_PATTERN = /ggml-([a-z0-9.-]+)\.bin/i
const GEMINI_CLIP_MUSIC_DURATION_SECONDS = 30
const GEMINI_PRO_DEFAULT_MUSIC_DURATION_SECONDS = 120

const roundMs = (value: number): number => Math.max(0, Math.round(value))

const resolveMusicTimingDurationSeconds = (
  target: { service: string, model: string, durationSeconds?: number | undefined }
): number | undefined => {
  if (target.service === 'gemini') {
    if (target.model === 'lyria-3-clip-preview') {
      return GEMINI_CLIP_MUSIC_DURATION_SECONDS
    }
    if (target.model === 'lyria-3-pro-preview') {
      return target.durationSeconds ?? GEMINI_PRO_DEFAULT_MUSIC_DURATION_SECONDS
    }
  }

  return target.durationSeconds
}

const isTranscriptionMetadata = (value: unknown): value is Step2Metadata => {
  return typeof value === 'object' && value !== null && 'transcriptionService' in value
}

const isExtractionMetadata = (value: unknown): value is ExtractionMetadata => {
  return typeof value === 'object' && value !== null && 'extractionMethod' in value
}

const resolveExtractionProviderModel = (
  metadata: ExtractionMetadata
): { provider: string, model: string } => {
  if (metadata.extractionMethod.includes('html+firecrawl')) {
    return {
      provider: 'firecrawl',
      model: 'firecrawl'
    }
  }
  if (metadata.extractionMethod.includes('html+glm-reader')) {
    return {
      provider: 'glm',
      model: 'glm-reader'
    }
  }
  if (metadata.ocrService === 'glm') {
    return {
      provider: 'glm',
      model: metadata.ocrModel ?? 'glm-ocr'
    }
  }
  if (metadata.ocrService === 'mistral') {
    return {
      provider: 'mistral',
      model: metadata.ocrModel ?? 'mistral-ocr'
    }
  }
  if (metadata.ocrService === 'openai') {
    return {
      provider: 'openai',
      model: metadata.ocrModel ?? 'gpt-5.4-nano'
    }
  }
  if (metadata.ocrService === 'anthropic') {
    return {
      provider: 'anthropic',
      model: metadata.ocrModel ?? 'claude-haiku-4-5'
    }
  }
  if (metadata.ocrService === 'gemini') {
    return {
      provider: 'gemini',
      model: metadata.ocrModel ?? 'gemini-3.1-flash-lite-preview'
    }
  }
  if (metadata.ocrService === 'deapi') {
    return {
      provider: 'deapi',
      model: metadata.ocrModel ?? 'Nanonets_Ocr_S_F16'
    }
  }
  if (metadata.extractionMethod.includes('mistral-ocr')) {
    return {
      provider: 'mistral',
      model: metadata.ocrModel ?? 'mistral-ocr'
    }
  }
  if (metadata.extractionMethod.includes('glm-ocr')) {
    return {
      provider: 'glm',
      model: metadata.ocrModel ?? 'glm-ocr'
    }
  }
  if (metadata.extractionMethod.includes('openai-ocr')) {
    return {
      provider: 'openai',
      model: metadata.ocrModel ?? 'gpt-5.4-nano'
    }
  }
  if (metadata.extractionMethod.includes('anthropic-ocr')) {
    return {
      provider: 'anthropic',
      model: metadata.ocrModel ?? 'claude-haiku-4-5'
    }
  }
  if (metadata.extractionMethod.includes('gemini-ocr')) {
    return {
      provider: 'gemini',
      model: metadata.ocrModel ?? 'gemini-3.1-flash-lite-preview'
    }
  }
  if (metadata.extractionMethod.includes('deapi-ocr')) {
    return {
      provider: 'deapi',
      model: metadata.ocrModel ?? 'Nanonets_Ocr_S_F16'
    }
  }
  if (metadata.extractionMethod.includes('paddle-ocr')) {
    return {
      provider: 'paddle-ocr',
      model: 'paddle-ocr'
    }
  }
  if (metadata.extractionMethod.includes('ocrmypdf')) {
    return {
      provider: 'ocrmypdf',
      model: 'ocrmypdf'
    }
  }
  if (metadata.extractionMethod.includes('tesseract')) {
    return {
      provider: 'tesseract',
      model: 'tesseract'
    }
  }
  return {
    provider: 'extract',
    model: metadata.extractionMethod
  }
}

const resolveTranscriptionModel = (metadata: Step2Metadata): string => {
  if (metadata.transcriptionService !== 'whisper') {
    return metadata.transcriptionModel
  }

  const match = metadata.transcriptionModel.match(WHISPER_MODEL_PATH_PATTERN)
  if (match && typeof match[1] === 'string' && match[1].length > 0) {
    return match[1]
  }

  return metadata.transcriptionModel
}

export const computeEstimatedProcessingTimes = (
  input: ComputeEstimatedProcessingTimesInput
): StepTimingBreakdown => {
  const steps: TimingStepEntry[] = []

  if (input.sttTargets && input.sttTargets.length > 0 && typeof input.audioDurationSeconds === 'number') {
    for (const target of input.sttTargets) {
      if (target.service === 'reverb') {
        continue
      }
      const estimation = getSttEstimation(target.service, target.model)
      steps.push({
        step: 'stt',
        provider: target.service,
        model: target.model,
        processingTimeMs: roundMs(input.audioDurationSeconds * estimation.msPerSecond),
        inputMetric: 'durationSeconds',
        inputValue: input.audioDurationSeconds,
      })
    }
  } else if (
    input.transcriptionService
    && input.transcriptionModel
    && input.transcriptionService !== 'reverb'
    && typeof input.audioDurationSeconds === 'number'
  ) {
    const estimation = getSttEstimation(input.transcriptionService, input.transcriptionModel)
    steps.push({
      step: 'stt',
      provider: input.transcriptionService,
      model: input.transcriptionModel,
      processingTimeMs: roundMs(input.audioDurationSeconds * estimation.msPerSecond),
      inputMetric: 'durationSeconds',
      inputValue: input.audioDurationSeconds,
    })
  }

  const extractTargets = input.extractTargets && input.extractTargets.length > 0
    ? input.extractTargets
    : [
        ...(input.mistralOcrModel && typeof input.extractPageCount === 'number'
          ? [{ provider: 'mistral' as const, model: input.mistralOcrModel, pageCount: input.extractPageCount }]
          : []),
        ...(input.glmOcrModel && typeof input.extractPageCount === 'number'
          ? [{ provider: 'glm' as const, model: input.glmOcrModel, pageCount: input.extractPageCount }]
          : []),
        ...(input.openaiOcrModel && typeof input.extractPageCount === 'number'
          ? [{ provider: 'openai' as const, model: input.openaiOcrModel, pageCount: input.extractPageCount }]
          : []),
        ...(input.anthropicOcrModel && typeof input.extractPageCount === 'number'
          ? [{ provider: 'anthropic' as const, model: input.anthropicOcrModel, pageCount: input.extractPageCount }]
          : []),
        ...(input.geminiOcrModel && typeof input.extractPageCount === 'number'
          ? [{ provider: 'gemini' as const, model: input.geminiOcrModel, pageCount: input.extractPageCount }]
          : []),
        ...(input.deapiOcrModel && typeof input.extractPageCount === 'number'
          ? [{ provider: 'deapi' as const, model: input.deapiOcrModel, pageCount: input.extractPageCount }]
          : [])
      ]

  for (const target of extractTargets) {
    const pageCount = Math.max(0, target.pageCount ?? input.extractPageCount ?? 0)
    const estimation = getExtractEstimation(target.provider, target.model)
    steps.push({
      step: 'extract',
      provider: target.provider,
      model: target.model,
      processingTimeMs: roundMs(pageCount * estimation.msPerPage),
      inputMetric: 'pages',
      inputValue: pageCount,
    })
  }

  const llmTargets = input.llmTargets && input.llmTargets.length > 0
    ? input.llmTargets
    : input.llmService && input.llmModel
      ? [{
          service: input.llmService,
          model: input.llmModel,
          ...(typeof input.llmInputTokenCount === 'number' ? { inputTokens: input.llmInputTokenCount } : {}),
          ...(typeof input.llmOutputTokenCount === 'number' ? { outputTokens: input.llmOutputTokenCount } : {})
        }]
      : []

  if (!input.skipLLM) {
    for (const llmTarget of llmTargets) {
      const registryService = llmTarget.service === 'llama.cpp' ? 'llama' : llmTarget.service
      const estimation = getLlmEstimation(registryService, llmTarget.model)
      const tokenCount = Math.max(0, (llmTarget.inputTokens ?? 0) + (llmTarget.outputTokens ?? 0))
      steps.push({
        step: 'llm',
        provider: llmTarget.service,
        model: llmTarget.model,
        processingTimeMs: roundMs((tokenCount / 1000) * estimation.msPer1KTokens),
        inputMetric: 'tokens',
        inputValue: tokenCount,
      })
    }
  }

  const ttsTargets = input.ttsTargets && input.ttsTargets.length > 0
    ? input.ttsTargets
    : input.ttsService && input.ttsModel
      ? [{ service: input.ttsService, model: input.ttsModel }]
      : []

  for (const ttsTarget of ttsTargets) {
    const estimation = getTtsEstimation(ttsTarget.service, ttsTarget.model)
    const characterCount = Math.max(0, input.ttsCharacterCount ?? 0)
    steps.push({
      step: 'tts',
      provider: ttsTarget.service,
      model: ttsTarget.model,
      processingTimeMs: roundMs((characterCount / 1000) * estimation.msPer1KChars),
      inputMetric: 'characters',
      inputValue: characterCount,
    })
  }

  const imageTargets = input.imageTargets && input.imageTargets.length > 0
    ? input.imageTargets
    : input.imageService && input.imageModel
      ? [{ service: input.imageService, model: input.imageModel, count: Math.max(1, input.imageCount ?? 1) }]
      : []

  for (const imageTarget of imageTargets) {
    const estimation = getImageEstimation(imageTarget.service, imageTarget.model)
    const imageCount = Math.max(1, imageTarget.count)
    steps.push({
      step: 'image',
      provider: imageTarget.service,
      model: imageTarget.model,
      processingTimeMs: roundMs(imageCount * estimation.msPerImage),
      inputMetric: 'images',
      inputValue: imageCount,
    })
  }

  const videoTargets = input.videoTargets && input.videoTargets.length > 0
    ? input.videoTargets
    : input.videoService && input.videoModel
      ? [{ service: input.videoService, model: input.videoModel, durationSeconds: input.videoDurationSeconds }]
      : []

  for (const videoTarget of videoTargets) {
    if (typeof videoTarget.durationSeconds === 'number') {
      const estimation = getVideoEstimation(videoTarget.service, videoTarget.model)
      steps.push({
        step: 'video',
        provider: videoTarget.service,
        model: videoTarget.model,
        processingTimeMs: roundMs(videoTarget.durationSeconds * estimation.msPerSecond),
        inputMetric: 'durationSeconds',
        inputValue: videoTarget.durationSeconds,
      })
    }
  }

  const musicTargets = input.musicTargets && input.musicTargets.length > 0
    ? input.musicTargets
    : input.musicService && input.musicModel
      ? [{ service: input.musicService, model: input.musicModel, durationSeconds: input.musicDurationSeconds }]
      : []

  for (const musicTarget of musicTargets) {
    const durationSeconds = resolveMusicTimingDurationSeconds(musicTarget)
    if (typeof durationSeconds === 'number') {
      const estimation = getMusicEstimation(musicTarget.service, musicTarget.model)
      steps.push({
        step: 'music',
        provider: musicTarget.service,
        model: musicTarget.model,
        processingTimeMs: roundMs(durationSeconds * estimation.msPerSecond),
        inputMetric: 'durationSeconds',
        inputValue: durationSeconds,
      })
    }
  }

  return {
    totalProcessingTimeMs: steps.reduce((sum, step) => sum + step.processingTimeMs, 0),
    steps,
  }
}

export const computeActualProcessingTimes = (
  input: ComputeActualProcessingTimesInput
): StepTimingBreakdown => {
  const steps: TimingStepEntry[] = []

  if (Array.isArray(input.step2)) {
    if (input.step2.every(isExtractionMetadata)) {
      for (const step2Entry of input.step2) {
        const { provider, model } = resolveExtractionProviderModel(step2Entry)
        steps.push({
          step: 'extract',
          provider,
          model,
          processingTimeMs: roundMs(step2Entry.processingTime),
          inputMetric: 'pages',
          inputValue: step2Entry.totalPages,
        })
      }
    } else {
      for (const step2Entry of input.step2) {
        const model = resolveTranscriptionModel(step2Entry)
        steps.push({
          step: 'stt',
          provider: step2Entry.transcriptionService,
          model,
          processingTimeMs: roundMs(step2Entry.processingTime),
          ...(typeof input.audioDurationSeconds === 'number'
            ? {
                inputMetric: 'durationSeconds' as const,
                inputValue: input.audioDurationSeconds,
              }
            : {
                inputMetric: 'tokens' as const,
                inputValue: step2Entry.tokenCount,
              }),
        })
      }
    }
  } else if (input.step2 && isTranscriptionMetadata(input.step2)) {
    const model = resolveTranscriptionModel(input.step2)
    steps.push({
      step: 'stt',
      provider: input.step2.transcriptionService,
      model,
      processingTimeMs: roundMs(input.step2.processingTime),
      ...(typeof input.audioDurationSeconds === 'number'
        ? {
            inputMetric: 'durationSeconds',
            inputValue: input.audioDurationSeconds,
          }
        : {
            inputMetric: 'tokens',
            inputValue: input.step2.tokenCount,
          }),
    })
  } else if (
    input.step2
    && isExtractionMetadata(input.step2)
  ) {
    const { provider, model } = resolveExtractionProviderModel(input.step2)
    steps.push({
      step: 'extract',
      provider,
      model,
      processingTimeMs: roundMs(input.step2.processingTime),
      inputMetric: 'pages',
      inputValue: input.step2.totalPages,
    })
  }

  for (const step3 of toArray(input.step3)) {
    const tokenCount = step3.inputTokenCount + step3.outputTokenCount
    steps.push({
      step: 'llm',
      provider: step3.llmService,
      model: step3.llmModel,
      processingTimeMs: roundMs(step3.processingTime),
      inputMetric: 'tokens',
      inputValue: tokenCount,
    })
  }

  const step4Array = toArray(input.step4)

  if (step4Array.length > 0 && typeof input.ttsCharacterCount === 'number') {
    for (const step4 of step4Array) {
      steps.push({
        step: 'tts',
        provider: step4.ttsService,
        model: step4.ttsModel,
        processingTimeMs: roundMs(step4.processingTime),
        inputMetric: 'characters',
        inputValue: input.ttsCharacterCount,
      })
    }
  }

  for (const step5 of toArray(input.step5)) {
    steps.push({
      step: 'image',
      provider: step5.imageService,
      model: step5.imageModel,
      processingTimeMs: roundMs(step5.processingTime),
      inputMetric: 'images',
      inputValue: step5.imageCount,
    })
  }

  for (const s6 of toArray(input.step6)) {
    steps.push({
      step: 'video',
      provider: s6.videoGenService,
      model: s6.videoGenModel,
      processingTimeMs: roundMs(s6.processingTime),
      ...(typeof s6.videoDuration === 'number'
        ? {
            inputMetric: 'durationSeconds',
            inputValue: s6.videoDuration,
          }
        : {}),
    })
  }

  if (input.step7) {
    for (const item of toArray(input.step7)) {
      steps.push({
        step: 'music',
        provider: item.musicService,
        model: item.musicModel,
        processingTimeMs: roundMs(item.processingTime),
        ...(typeof item.musicDurationMs === 'number'
          ? {
              inputMetric: 'durationSeconds',
              inputValue: item.musicDurationMs / 1000,
            }
          : {}),
      })
    }
  }

  return {
    totalProcessingTimeMs: steps.reduce((sum, step) => sum + step.processingTimeMs, 0),
    steps,
  }
}
