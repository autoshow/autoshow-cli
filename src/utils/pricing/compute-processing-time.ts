import {
  getExtractEstimation,
  getImageEstimation,
  getLlmEstimation,
  getMusicEstimation,
  getSttEstimation,
  getTtsEstimation,
  getVideoEstimation,
} from '~/cli/commands/models/model-loader'
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
  transcriptionService?: Step2Metadata['transcriptionService'] | undefined
  transcriptionModel?: string | undefined
  audioDurationSeconds?: number | undefined
  mistralOcrModel?: string | undefined
  extractPageCount?: number | undefined
  llmService?: Step3Metadata['llmService'] | undefined
  llmModel?: string | undefined
  llmInputTokenCount?: number | undefined
  llmOutputTokenCount?: number | undefined
  skipLLM?: boolean | undefined
  ttsService?: Step4Metadata['ttsService'] | undefined
  ttsModel?: string | undefined
  ttsCharacterCount?: number | undefined
  imageService?: Step5Metadata['imageService'] | undefined
  imageModel?: string | undefined
  imageCount?: number | undefined
  videoService?: Step6VideoMetadata['videoGenService'] | undefined
  videoModel?: string | undefined
  videoDurationSeconds?: number | undefined
  musicService?: Step7MusicMetadata['musicService'] | undefined
  musicModel?: string | undefined
  musicDurationSeconds?: number | undefined
}

type ComputeActualProcessingTimesInput = {
  step1?: DocumentMetadata | undefined
  audioDurationSeconds?: number | undefined
  step2?: Step2Metadata | ExtractionMetadata | undefined
  step3?: Step3Metadata | Step3Metadata[] | undefined
  step4?: Step4Metadata | undefined
  step5?: Step5Metadata | undefined
  step6?: Step6VideoMetadata | undefined
  step7?: Step7MusicMetadata | undefined
  ttsCharacterCount?: number | undefined
}

export const computeEstimatedProcessingTimes = (
  input: ComputeEstimatedProcessingTimesInput
): EstimatedTimingBreakdown => {
  const steps: TimingStepEntry[] = []

  if (
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

  if (input.mistralOcrModel && typeof input.extractPageCount === 'number') {
    const estimation = getExtractEstimation('mistral', input.mistralOcrModel)
    steps.push({
      step: 'extract',
      provider: 'mistral',
      model: input.mistralOcrModel,
      processingTimeMs: roundMs(input.extractPageCount * estimation.msPerPage),
      inputMetric: 'pages',
      inputValue: input.extractPageCount,
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

  if (input.ttsService && input.ttsModel) {
    const estimation = getTtsEstimation(input.ttsService, input.ttsModel)
    const characterCount = Math.max(0, input.ttsCharacterCount ?? 0)
    steps.push({
      step: 'tts',
      provider: input.ttsService,
      model: input.ttsModel,
      processingTimeMs: roundMs((characterCount / 1000) * estimation.msPer1KChars),
      inputMetric: 'characters',
      inputValue: characterCount,
    })
  }

  if (input.imageService && input.imageModel) {
    const estimation = getImageEstimation(input.imageService, input.imageModel)
    const imageCount = Math.max(1, input.imageCount ?? 1)
    steps.push({
      step: 'image',
      provider: input.imageService,
      model: input.imageModel,
      processingTimeMs: roundMs(imageCount * estimation.msPerImage),
      inputMetric: 'images',
      inputValue: imageCount,
    })
  }

  if (input.videoService && input.videoModel && typeof input.videoDurationSeconds === 'number') {
    const estimation = getVideoEstimation(input.videoService, input.videoModel)
    steps.push({
      step: 'video',
      provider: input.videoService,
      model: input.videoModel,
      processingTimeMs: roundMs(input.videoDurationSeconds * estimation.msPerSecond),
      inputMetric: 'durationSeconds',
      inputValue: input.videoDurationSeconds,
    })
  }

  if (input.musicService && input.musicModel && typeof input.musicDurationSeconds === 'number') {
    const estimation = getMusicEstimation(input.musicService, input.musicModel)
    steps.push({
      step: 'music',
      provider: input.musicService,
      model: input.musicModel,
      processingTimeMs: roundMs(input.musicDurationSeconds * estimation.msPerSecond),
      inputMetric: 'durationSeconds',
      inputValue: input.musicDurationSeconds,
    })
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

  if (input.step2 && isTranscriptionMetadata(input.step2)) {
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
    && input.step2.extractionMethod.includes('mistral-ocr')
    && typeof input.step2.ocrModel === 'string'
  ) {
    steps.push({
      step: 'extract',
      provider: 'mistral',
      model: input.step2.ocrModel,
      processingTimeMs: roundMs(input.step2.processingTime),
      inputMetric: 'pages',
      inputValue: input.step2.totalPages,
    })
  }

  const step3Array = input.step3
    ? Array.isArray(input.step3) ? input.step3 : [input.step3]
    : []

  for (const step3 of step3Array) {
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

  if (input.step4 && typeof input.ttsCharacterCount === 'number') {
    steps.push({
      step: 'tts',
      provider: input.step4.ttsService,
      model: input.step4.ttsModel,
      processingTimeMs: roundMs(input.step4.processingTime),
      inputMetric: 'characters',
      inputValue: input.ttsCharacterCount,
    })
  }

  if (input.step5) {
    steps.push({
      step: 'image',
      provider: input.step5.imageService,
      model: input.step5.imageModel,
      processingTimeMs: roundMs(input.step5.processingTime),
      inputMetric: 'images',
      inputValue: input.step5.imageCount,
    })
  }

  if (input.step6) {
    steps.push({
      step: 'video',
      provider: input.step6.videoGenService,
      model: input.step6.videoGenModel,
      processingTimeMs: roundMs(input.step6.processingTime),
      ...(typeof input.step6.videoDuration === 'number'
        ? {
            inputMetric: 'durationSeconds',
            inputValue: input.step6.videoDuration,
          }
        : {}),
    })
  }

  if (input.step7) {
    steps.push({
      step: 'music',
      provider: input.step7.musicService,
      model: input.step7.musicModel,
      processingTimeMs: roundMs(input.step7.processingTime),
      ...(typeof input.step7.musicDurationMs === 'number'
        ? {
            inputMetric: 'durationSeconds',
            inputValue: input.step7.musicDurationMs / 1000,
          }
        : {}),
    })
  }

  return {
    totalProcessingTimeMs: steps.reduce((sum, step) => sum + step.processingTimeMs, 0),
    steps,
  }
}
