import type { Step2Metadata, TranscriptionResult } from '~/types'
import { TOGETHER_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { runOpenAICompatibleSingleSpeakerStt } from '../openai-compatible-single-speaker'

export const runTogetherStt = async (
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
  const apiKey = readEnv('TOGETHER_API_KEY')
  if (!apiKey) {
    throw new Error('TOGETHER_API_KEY environment variable is required for Together transcription')
  }

  return await runOpenAICompatibleSingleSpeakerStt(audioPath, outputDir, {
    service: 'together',
    providerLabel: 'Together',
    apiKey,
    baseURL: TOGETHER_DEFAULT_BASE_URL,
    model,
    segmentOffsetMinutes,
    segmentNumber,
    totalSegments,
    audioDurationSeconds
  })
}
