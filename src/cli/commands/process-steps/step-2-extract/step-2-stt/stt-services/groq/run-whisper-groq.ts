import type { Step2Metadata, TranscriptionResult } from '~/types'
import { readEnv } from '~/utils/validate/env-utils'
import { runOpenAICompatibleSingleSpeakerStt } from '../openai-compatible-single-speaker'

export const runGroqTranscribe = async (
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
  const { model: modelName, segmentOffsetMinutes = 0, segmentNumber, totalSegments, audioDurationSeconds } = options
  const apiKey = readEnv('GROQ_API_KEY')
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is required for Groq STT models')
  }

  const baseURL = readEnv('GROQ_BASE_URL') ?? 'https://api.groq.com/openai/v1'
  return await runOpenAICompatibleSingleSpeakerStt(audioPath, outputDir, {
    service: 'groq',
    providerLabel: 'Groq',
    apiKey,
    baseURL,
    model: modelName,
    segmentOffsetMinutes,
    segmentNumber,
    totalSegments,
    audioDurationSeconds
  })
}
