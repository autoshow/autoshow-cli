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
  ActualTimingBreakdown,
  DocumentMetadata,
  EstimatedTimingBreakdown,
  ExtractionMetadata,
  Step2Metadata,
  Step3Metadata,
  Step4Metadata,
  Step5Metadata,
  Step6VideoMetadata,
  Step7MusicMetadata,
  TimingStepEntry,
} from '~/types'

const WHISPER_MODEL_PATH_PATTERN = /ggml-([a-z0-9.-]+)\.bin/i

const roundMs = (value: number): number => Math.max(0, Math.round(value))

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

type ComputeEstimatedProcessingTimesInput = {
  sttTargets?: Array<{ service: Step2Metadata['transcriptionService'], model: string }> | undefined
  transcriptionService?: Step2Metadata['transcriptionService'] | undefined
  transcriptionModel?: string | undefined
  audioDurationSeconds?: number | undefined
  mistralOcrModel?: string | undefined
  glmOcrModel?: string | undefined
  extractTargets?: Array<{ provider: 'mistral' | 'glm' | 'firecrawl', model: string, pageCount?: number }> | undefined
  extractPageCount?: number | undefined
  llmService?: Step3Metadata['llmService'] | undefined
  llmModel?: string | undefined
  llmInputTokenCount?: number | undefined
  llmOutputTokenCount?: number | undefined
  skipLLM?: boolean | undefined
  ttsTargets?: Array<{ service: Step4Metadata['ttsService'], model: string }> | undefined
  ttsService?: Step4Metadata['ttsService'] | undefined
  ttsModel?: string | undefined
  ttsCharacterCount?: number | undefined
  imageTargets?: Array<{ service: Step5Metadata['imageService'], model: string, count: number }> | undefined
  imageService?: Step5Metadata['imageService'] | undefined
  imageModel?: string | undefined
  imageCount?: number | undefined
  videoService?: Step6VideoMetadata['videoGenService'] | undefined
  videoModel?: string | undefined
  videoDurationSeconds?: number | undefined
  videoTargets?: Array<{ service: Step6VideoMetadata['videoGenService'], model: string, durationSeconds?: number }> | undefined
  musicTargets?: Array<{ service: Step7MusicMetadata['musicService'], model: string, durationSeconds?: number }> | undefined
  musicService?: Step7MusicMetadata['musicService'] | undefined
  musicModel?: string | undefined
  musicDurationSeconds?: number | undefined
}

type ComputeActualProcessingTimesInput = {
  step1?: DocumentMetadata | undefined
  audioDurationSeconds?: number | undefined
  step2?: Step2Metadata | Step2Metadata[] | ExtractionMetadata | ExtractionMetadata[] | undefined
  step3?: Step3Metadata | Step3Metadata[] | undefined
  step4?: Step4Metadata | Step4Metadata[] | undefined
  step5?: Step5Metadata | Step5Metadata[] | undefined
  step6?: Step6VideoMetadata | Step6VideoMetadata[] | undefined
  step7?: Step7MusicMetadata | Step7MusicMetadata[] | undefined
  ttsCharacterCount?: number | undefined
}

export const computeEstimatedProcessingTimes = (
  input: ComputeEstimatedProcessingTimesInput
): EstimatedTimingBreakdown => {
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

  if (!input.skipLLM && input.llmService && input.llmModel) {
    const registryService = input.llmService === 'llama.cpp' ? 'llama' : input.llmService
    const estimation = getLlmEstimation(registryService, input.llmModel)
    const tokenCount = Math.max(0, (input.llmInputTokenCount ?? 0) + (input.llmOutputTokenCount ?? 0))
    steps.push({
      step: 'llm',
      provider: input.llmService,
      model: input.llmModel,
      processingTimeMs: roundMs((tokenCount / 1000) * estimation.msPer1KTokens),
      inputMetric: 'tokens',
      inputValue: tokenCount,
    })
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
    if (typeof musicTarget.durationSeconds === 'number') {
      const estimation = getMusicEstimation(musicTarget.service, musicTarget.model)
      steps.push({
        step: 'music',
        provider: musicTarget.service,
        model: musicTarget.model,
        processingTimeMs: roundMs(musicTarget.durationSeconds * estimation.msPerSecond),
        inputMetric: 'durationSeconds',
        inputValue: musicTarget.durationSeconds,
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
): ActualTimingBreakdown => {
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
