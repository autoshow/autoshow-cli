import type { Step2Metadata, TranscriptionResult } from '~/types'
import { readEnv } from '~/utils/validate/env-utils'
import { runOpenAICompatibleSingleSpeakerStt } from '../openai-compatible-single-speaker'

const resolveFireworksBaseURL = (model: string): string => {
  const override = readEnv('FIREWORKS_BASE_URL')
  if (override) {
    return override
  }

  return model === 'whisper-v3'
    ? 'https://audio-prod.api.fireworks.ai/v1'
    : 'https://audio-turbo.api.fireworks.ai/v1'
}

export const runFireworksStt = async (
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
  const apiKey = readEnv('FIREWORKS_API_KEY')
  if (!apiKey) {
    throw new Error('FIREWORKS_API_KEY environment variable is required for Fireworks transcription')
  }

  return await runOpenAICompatibleSingleSpeakerStt(audioPath, outputDir, {
    service: 'fireworks',
    providerLabel: 'Fireworks',
    apiKey,
    baseURL: resolveFireworksBaseURL(model),
    model,
    segmentOffsetMinutes,
    segmentNumber,
    totalSegments
  })
}
