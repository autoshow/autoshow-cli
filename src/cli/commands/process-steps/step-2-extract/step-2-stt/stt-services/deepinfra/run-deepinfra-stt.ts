import type { Step2Metadata, TranscriptionResult } from '~/types'
import { DEEPINFRA_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { runOpenAICompatibleSingleSpeakerStt } from '../openai-compatible-single-speaker'

const normalizeDeepinfraBaseURL = (baseURL: string): string =>
  baseURL.replace(/\/+$/, '').replace(/\/openai$/, '')

export const runDeepinfraTranscribe = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    audioDurationSeconds?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { model, segmentOffsetMinutes = 0, segmentNumber, totalSegments, audioDurationSeconds } = options
  const apiKey = readEnv('DEEPINFRA_API_KEY')
  if (!apiKey) {
    throw new Error('DEEPINFRA_API_KEY environment variable is required for DeepInfra transcription')
  }

  const baseURL = normalizeDeepinfraBaseURL(DEEPINFRA_DEFAULT_BASE_URL)
  return await runOpenAICompatibleSingleSpeakerStt(audioPath, outputDir, {
    service: 'deepinfra',
    providerLabel: 'DeepInfra',
    apiKey,
    baseURL,
    model,
    segmentOffsetMinutes,
    segmentNumber,
    totalSegments,
    audioDurationSeconds
  })
}
