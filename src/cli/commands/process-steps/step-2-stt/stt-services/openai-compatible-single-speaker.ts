import type {
  OpenAICompatibleTranscriptionResponse,
  OpenAICompatibleTranscriptionSegment,
  Step2Metadata,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import * as l from '~/logger'
import { logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-stt/stt-logging'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/stt-utils'

const parseSegments = (
  raw: unknown,
  offsetSeconds: number
): TranscriptionSegment[] => {
  if (!Array.isArray(raw)) {
    return []
  }

  const segments: TranscriptionSegment[] = []
  for (const segment of raw) {
    const entry = segment as OpenAICompatibleTranscriptionSegment
    if (typeof entry.start !== 'number' || typeof entry.end !== 'number' || typeof entry.text !== 'string') {
      continue
    }

    const text = entry.text.trim()
    if (text.length === 0) {
      continue
    }

    segments.push({
      start: toTimestamp(entry.start + offsetSeconds),
      end: toTimestamp(entry.end + offsetSeconds),
      text
    })
  }

  return segments
}

const normalizeBaseURL = (baseURL: string): string =>
  baseURL.replace(/\/+$/, '')

export const runOpenAICompatibleSingleSpeakerStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    service: Step2Metadata['transcriptionService']
    providerLabel: string
    apiKey: string
    baseURL: string
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const {
    service,
    providerLabel,
    apiKey,
    baseURL,
    model,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments
  } = options

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: providerLabel, action: 'started', segmentNumber, totalSegments, model })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  const form = new FormData()
  form.append('model', model)
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')
  form.append('file', Bun.file(audioPath))

  const response = await fetch(`${normalizeBaseURL(baseURL)}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`${providerLabel} transcription failed (${response.status}): ${errText}`)
  }

  const payload = await response.json() as OpenAICompatibleTranscriptionResponse
  const segments = parseSegments(payload.segments, offsetSeconds)
  const text = typeof payload.text === 'string'
    ? payload.text.trim()
    : segments.map((segment) => segment.text).join(' ').trim()
  const { finalSegments, finalText } = resolveTranscriptionOutput(segments, text, offsetSeconds)

  await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

  const processingTime = Date.now() - startTime
  const metadata: Step2Metadata = {
    transcriptionService: service,
    transcriptionModel: model,
    processingTime,
    tokenCount: countTokens(finalText)
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: providerLabel, action: 'completed', segmentNumber, totalSegments, model, processingTimeMs: processingTime })
  }

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
        timingQuality: 'segment_interpolated',
        rawResponse: payload
      }
    },
    metadata
  }
}
