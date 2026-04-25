import type { Step2Metadata, TranscriptionResult } from '~/types'
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
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { model, segmentOffsetMinutes = 0, segmentNumber, totalSegments } = options
  const apiKey = readEnv('TOGETHER_API_KEY')
  if (!apiKey) {
    throw new Error('TOGETHER_API_KEY environment variable is required for Together transcription')
  }

  return await runOpenAICompatibleSingleSpeakerStt(audioPath, outputDir, {
    service: 'together',
    providerLabel: 'Together',
    apiKey,
    baseURL: readEnv('TOGETHER_BASE_URL') ?? 'https://api.together.xyz/v1',
    model,
    segmentOffsetMinutes,
    segmentNumber,
    totalSegments
  })
}
