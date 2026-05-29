import type { Step2Metadata, TranscriptionResult } from '~/types'
import { GLM_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import {
  runOpenAICompatibleSingleSpeakerStt,
  runOpenAICompatibleTextOnlyStt
} from '../openai-compatible-single-speaker'

const shouldRetryMinimalGlmRequest = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /\(400\)|response_format|timestamp_granularities|unsupported|invalid/i.test(message)
}

export const runGlmStt = async (
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
  const apiKey = readEnv('GLM_API_KEY')
  if (!apiKey) {
    throw new Error('GLM_API_KEY environment variable is required for GLM transcription')
  }

  const baseURL = GLM_DEFAULT_BASE_URL
  try {
    return await runOpenAICompatibleSingleSpeakerStt(audioPath, outputDir, {
      service: 'glm-stt',
      providerLabel: 'GLM',
      apiKey,
      baseURL,
      model,
      segmentOffsetMinutes,
      segmentNumber,
      totalSegments,
      audioDurationSeconds
    })
  } catch (error) {
    if (!shouldRetryMinimalGlmRequest(error)) {
      throw error
    }
    return await runOpenAICompatibleTextOnlyStt(audioPath, outputDir, {
      service: 'glm-stt',
      apiKey,
      baseURL,
      model,
      segmentOffsetMinutes,
      segmentNumber,
      formFields: { stream: 'false' },
      errorMessagePrefix: 'GLM transcription failed'
    })
  }
}
