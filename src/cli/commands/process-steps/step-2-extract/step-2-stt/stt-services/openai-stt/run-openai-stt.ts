import type { Step2Metadata, TranscriptionResult } from '~/types'
import { OPENAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { runOpenAICompatibleTextOnlyStt } from '../openai-compatible-single-speaker'

export const runOpenaiStt = async (
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
  const { model, segmentOffsetMinutes = 0, segmentNumber } = options
  const apiKey = readEnv('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required for OpenAI transcription')
  }

  const baseURL = OPENAI_DEFAULT_BASE_URL
  return await runOpenAICompatibleTextOnlyStt(audioPath, outputDir, {
    service: 'openai-stt',
    apiKey,
    baseURL,
    model,
    segmentOffsetMinutes,
    segmentNumber,
    formFields: { response_format: 'json' },
    errorMessagePrefix: 'OpenAI transcription failed'
  })
}
