import type { Step2Metadata, TranscriptionResult } from '~/types'
import { OPENAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText,
  resolveTranscriptionOutput
} from '../../stt-utils/stt-utils'

const normalizeBaseURL = (baseURL: string): string =>
  baseURL.replace(/\/+$/, '')

const runJsonOpenaiStt = async (
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
  form.append('response_format', 'json')
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
    throw new Error(`OpenAI transcription failed (${response.status}): ${rawText}`)
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
      transcriptionService: 'openai-stt',
      transcriptionModel: options.model,
      processingTime: Date.now() - startTime,
      tokenCount: countTokens(finalText)
    }
  }
}

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
  return await runJsonOpenaiStt(audioPath, outputDir, {
    apiKey,
    baseURL,
    model,
    segmentOffsetMinutes,
    segmentNumber
  })
}
