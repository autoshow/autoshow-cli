import type { Step2Metadata, TranscriptionResult } from '~/types'
import { readEnv } from '~/utils/validate/env-utils'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText,
  resolveTranscriptionOutput
} from '../../stt-utils/stt-utils'
import { runOpenAICompatibleSingleSpeakerStt } from '../openai-compatible-single-speaker'

const normalizeBaseURL = (baseURL: string): string =>
  baseURL.replace(/\/+$/, '')

const shouldRetryMinimalGlmRequest = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /\(400\)|response_format|timestamp_granularities|unsupported|invalid/i.test(message)
}

const runMinimalGlmStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    apiKey: string
    baseURL: string
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const startTime = Date.now()
  const offsetSeconds = options.segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, options.segmentNumber)
  const form = new FormData()
  form.append('model', options.model)
  form.append('stream', 'false')
  form.append('file', Bun.file(audioPath))

  const response = await fetch(`${normalizeBaseURL(options.baseURL)}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`
    },
    body: form
  })

  const rawText = await response.text()
  let payload: unknown = rawText
  try {
    payload = JSON.parse(rawText) as unknown
  } catch {
    payload = rawText
  }

  if (!response.ok) {
    throw new Error(`GLM transcription failed (${response.status}): ${rawText}`)
  }

  const text = typeof payload === 'object' && payload !== null && 'text' in payload
    ? String((payload as { text?: unknown }).text ?? '').trim()
    : rawText.trim()
  const { finalSegments, finalText } = resolveTranscriptionOutput([], text, offsetSeconds)
  await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

  return {
    result: {
      text: finalText,
      segments: finalSegments,
      evidence: {
        capabilities: {
          hasNativeWordTiming: false,
          hasConfidence: false,
          hasSpeakerLabels: false
        },
        timingQuality: 'coarse',
        rawResponse: payload
      }
    },
    metadata: {
      transcriptionService: 'glm-stt',
      transcriptionModel: options.model,
      processingTime: Date.now() - startTime,
      tokenCount: countTokens(finalText)
    }
  }
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

  const baseURL = readEnv('GLM_BASE_URL') ?? 'https://api.z.ai/api/paas/v4'
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
    return await runMinimalGlmStt(audioPath, outputDir, {
      apiKey,
      baseURL,
      model,
      segmentOffsetMinutes,
      segmentNumber
    })
  }
}
