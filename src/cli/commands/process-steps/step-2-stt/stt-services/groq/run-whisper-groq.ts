import type { Step2Metadata, TranscriptionResult, TranscriptionSegment } from '~/types'
import * as l from '~/logger'
import { countTokens, toTimestamp } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import type { GroqTranscriptionSegment, GroqTranscriptionResponse } from '~/types'

const parseSegments = (raw: unknown, offsetSeconds: number): TranscriptionSegment[] => {
  if (!Array.isArray(raw)) {
    return []
  }

  const segments: TranscriptionSegment[] = []
  for (const segment of raw) {
    const s = segment as GroqTranscriptionSegment
    if (typeof s.start !== 'number' || typeof s.end !== 'number' || typeof s.text !== 'string') {
      continue
    }
    const start = s.start + offsetSeconds
    const end = s.end + offsetSeconds
    segments.push({
      start: toTimestamp(start),
      end: toTimestamp(end),
      text: s.text.trim()
    })
  }
  return segments.filter(seg => seg.text.length > 0)
}

export const runGroqTranscribe = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const { model: modelName, segmentOffsetMinutes = 0, segmentNumber, totalSegments } = options
  const apiKey = readEnvFallback('GROQ_API_KEY')
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is required for Groq STT models')
  }

  if (segmentNumber && totalSegments) {
    l.info(`Transcribing segment ${segmentNumber}/${totalSegments} with Groq model: ${modelName}`)
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const segmentSuffix = segmentNumber ? `_segment_${String(segmentNumber).padStart(3, '0')}` : ''
  const outputBase = `${outputDir}/transcription${segmentSuffix}`

  const form = new FormData()
  form.append('model', modelName)
  form.append('response_format', 'verbose_json')
  form.append('timestamp_granularities[]', 'segment')
  form.append('file', Bun.file(audioPath))

  const baseURL = readEnv('GROQ_BASE_URL') ?? 'https://api.groq.com/openai/v1'
  const response = await fetch(`${baseURL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Groq transcription failed (${response.status}): ${errText}`)
  }

  const payload = await response.json() as GroqTranscriptionResponse
  const segments = parseSegments(payload.segments, offsetSeconds)
  const text = typeof payload.text === 'string'
    ? payload.text.trim()
    : segments.map(seg => seg.text).join(' ').trim()

  const finalSegments = segments.length > 0
    ? segments
    : [{
        start: toTimestamp(offsetSeconds),
        end: toTimestamp(offsetSeconds),
        text
      }]

  const formattedTranscriptPath = `${outputBase}.txt`
  const formattedText = finalSegments.map(seg => `[${seg.start}] ${seg.text}`).join('\n')
  await Bun.write(formattedTranscriptPath, formattedText)

  const processingTime = Date.now() - startTime
  const metadata: Step2Metadata = {
    transcriptionService: 'groq',
    transcriptionModel: modelName,
    transcriptionModelName: modelName,
    processingTime,
    tokenCount: countTokens(text)
  }

  if (segmentNumber && totalSegments) {
    l.success(`Segment ${segmentNumber}/${totalSegments} transcription completed in ${processingTime}ms`)
  }

  return {
    result: {
      text,
      segments: finalSegments
    },
    metadata
  }
}
