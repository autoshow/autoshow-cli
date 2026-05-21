import type {
  AggregatedPriceEstimate,
  ComputeEstimatedProcessingTimesInput,
  ExtractStepEstimate,
  ImageStepEstimate,
  LlmStepEstimate,
  MusicStepEstimate,
  Step3Metadata,
  Step4Metadata,
  StepEstimate,
  SttStepEstimate,
  TtsStepEstimate,
  VideoStepEstimate
} from '~/types'
import { computeEstimatedProcessingTimes } from '../compute-processing-time'

type TimedSttService = NonNullable<ComputeEstimatedProcessingTimesInput['sttTargets']>[number]['service']
type TimedExtractProvider = NonNullable<ComputeEstimatedProcessingTimesInput['extractTargets']>[number]['provider']
type TimedImageService = NonNullable<ComputeEstimatedProcessingTimesInput['imageTargets']>[number]['service']
type TimedVideoService = NonNullable<ComputeEstimatedProcessingTimesInput['videoTargets']>[number]['service']
type TimedMusicService = NonNullable<ComputeEstimatedProcessingTimesInput['musicTargets']>[number]['service']

const TIMED_EXTRACT_PROVIDERS = new Set<TimedExtractProvider>([
  'defuddle',
  'mistral',
  'glm',
  'kimi',
  'openai',
  'grok',
  'anthropic',
  'gemini',
  'deepinfra',
  'firecrawl',
  'glm-reader',
  'spider',
  'zyte',
  'gcloud-docai',
  'aws-textract'
])

const isTimedExtractProvider = (provider: ExtractStepEstimate['provider']): provider is TimedExtractProvider =>
  TIMED_EXTRACT_PROVIDERS.has(provider as TimedExtractProvider)

export const buildAggregateTiming = (
  steps: StepEstimate[],
  ttsTimingCharacterCount: number | undefined
): AggregatedPriceEstimate['timing'] => {
  const sttTimingTargets = steps
    .filter((step): step is SttStepEstimate & { durationSeconds: number } =>
      step.step === 'stt' && typeof step.durationSeconds === 'number' && step.durationSeconds > 0
    )
    .map((step) => ({
      service: step.provider as TimedSttService,
      model: step.model
    }))
  const sttTimingDurationSeconds = steps
    .find((step): step is SttStepEstimate & { durationSeconds: number } =>
      step.step === 'stt' && typeof step.durationSeconds === 'number' && step.durationSeconds > 0
    )?.durationSeconds
  const extractTimingTargets = steps
    .filter((step): step is ExtractStepEstimate & { provider: TimedExtractProvider, pageCount: number } =>
      step.step === 'extract' && isTimedExtractProvider(step.provider) && typeof step.pageCount === 'number'
    )
    .map((step) => ({
      provider: step.provider,
      model: step.model,
      pageCount: step.pageCount
    }))
  const ttsTimingTargets = steps
    .filter((step): step is TtsStepEstimate & { characterCount: number } =>
      step.step === 'tts' && typeof step.characterCount === 'number'
    )
    .map((step) => ({
      service: step.provider as Step4Metadata['ttsService'],
      model: step.model,
      ...(typeof step.setupTimeMs === 'number' ? { setupTimeMs: step.setupTimeMs } : {})
    }))
  const llmTimingTargets = steps
    .filter((step): step is LlmStepEstimate =>
      step.step === 'llm'
      && ((step.estimatedInputTokens ?? 0) + (step.estimatedOutputTokens ?? 0)) > 0
    )
    .map((step) => ({
      service: step.provider as Step3Metadata['llmService'],
      model: step.model,
      inputTokens: step.estimatedInputTokens ?? 0,
      outputTokens: step.estimatedOutputTokens ?? 0
    }))
  const imageTimingTargets = steps
    .filter((step): step is ImageStepEstimate =>
      step.step === 'image' && step.imageCount > 0
    )
    .map((step) => ({
      service: step.provider as TimedImageService,
      model: step.model,
      count: step.imageCount
    }))
  const videoTimingTargets = steps
    .filter((step): step is VideoStepEstimate =>
      step.step === 'video' && step.durationSeconds > 0
    )
    .map((step) => ({
      service: step.provider as TimedVideoService,
      model: step.model,
      durationSeconds: step.durationSeconds
    }))
  const musicTimingTargets = steps
    .filter((step): step is MusicStepEstimate =>
      step.step === 'music' && step.durationSeconds > 0
    )
    .map((step) => ({
      service: step.provider as TimedMusicService,
      model: step.model,
      durationSeconds: step.durationSeconds
    }))

  return (sttTimingTargets.length > 0 && typeof sttTimingDurationSeconds === 'number')
    || extractTimingTargets.length > 0
    || llmTimingTargets.length > 0
    || (ttsTimingTargets.length > 0 && typeof ttsTimingCharacterCount === 'number')
    || imageTimingTargets.length > 0
    || videoTimingTargets.length > 0
    || musicTimingTargets.length > 0
    ? computeEstimatedProcessingTimes({
        ...(sttTimingTargets.length > 0 && typeof sttTimingDurationSeconds === 'number'
          ? {
              sttTargets: sttTimingTargets,
              audioDurationSeconds: sttTimingDurationSeconds
            }
          : {}),
        ...(extractTimingTargets.length > 0 ? { extractTargets: extractTimingTargets } : {}),
        ...(llmTimingTargets.length > 0 ? { llmTargets: llmTimingTargets } : {}),
        ...(ttsTimingTargets.length > 0 && typeof ttsTimingCharacterCount === 'number'
          ? { ttsTargets: ttsTimingTargets, ttsCharacterCount: ttsTimingCharacterCount }
          : {}),
        ...(imageTimingTargets.length > 0 ? { imageTargets: imageTimingTargets } : {}),
        ...(videoTimingTargets.length > 0 ? { videoTargets: videoTimingTargets } : {}),
        ...(musicTimingTargets.length > 0 ? { musicTargets: musicTimingTargets } : {})
      })
    : undefined
}
