import type { AggregatedPriceEstimate, ComputeEstimatedProcessingTimesInput, ExtractStepEstimate, Step4Metadata, StepEstimate, TtsStepEstimate } from '~/types'
import { computeEstimatedProcessingTimes } from '../compute-processing-time'

type TimedExtractProvider = NonNullable<ComputeEstimatedProcessingTimesInput['extractTargets']>[number]['provider']

const TIMED_EXTRACT_PROVIDERS = new Set<TimedExtractProvider>([
  'defuddle',
  'mistral',
  'glm',
  'kimi',
  'openai',
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

  return extractTimingTargets.length > 0 || (ttsTimingTargets.length > 0 && typeof ttsTimingCharacterCount === 'number')
    ? computeEstimatedProcessingTimes({
        ...(extractTimingTargets.length > 0 ? { extractTargets: extractTimingTargets } : {}),
        ...(ttsTimingTargets.length > 0 && typeof ttsTimingCharacterCount === 'number'
          ? { ttsTargets: ttsTimingTargets, ttsCharacterCount: ttsTimingCharacterCount }
          : {})
      })
    : undefined
}
