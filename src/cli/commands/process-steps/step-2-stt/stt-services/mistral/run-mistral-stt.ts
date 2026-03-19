import { basename } from 'node:path'
import type { Step2Metadata, TranscriptionResult, TranscriptionSegment, DiarizationOptions } from '~/types'
import { MistralTranscriptionResponseSchema } from '~/types'
import * as l from '~/logger'
import { countTokens, toTimestamp } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const formatSpeaker = (speakerId: string | number | undefined): string | undefined => {
  if (speakerId === undefined) {
    return undefined
  }
  if (typeof speakerId === 'number') {
    return `speaker-${speakerId}`
  }
  const trimmed = speakerId.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const readSpeakerId = (segment: {
  speaker_id?: string | number | undefined
  additionalProperties?: Record<string, unknown> | undefined
}): string | number | undefined => {
  if (segment.speaker_id !== undefined) {
    return segment.speaker_id
  }
  const fromAdditional = segment.additionalProperties?.['speaker_id']
  if (typeof fromAdditional === 'string' || typeof fromAdditional === 'number') {
    return fromAdditional
  }
  return undefined
}

const toSegments = (
  rawSegments: Array<{
    start: number
    end: number
    text: string
    speaker_id?: string | number | undefined
    additionalProperties?: Record<string, unknown> | undefined
  }>,
  offsetSeconds: number
): TranscriptionSegment[] => {
  const parsed: TranscriptionSegment[] = []
  for (const segment of rawSegments) {
    const text = segment.text.trim()
    if (text.length === 0) {
      continue
    }
    const speakerId = readSpeakerId(segment)
    parsed.push({
      start: toTimestamp(segment.start + offsetSeconds),
      end: toTimestamp(segment.end + offsetSeconds),
      text,
      ...(speakerId !== undefined ? { speaker: formatSpeaker(speakerId) } : {})
    })
  }
  return parsed
}

export const runMistralStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    diarizationOptions?: DiarizationOptions | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const apiKey = readEnvFallback('MISTRAL_API_KEY')
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY environment variable is required for Mistral transcription')
  }

  const { model: modelName, segmentOffsetMinutes = 0, segmentNumber, totalSegments } = options
  if (segmentNumber && totalSegments) {
    l.info(`Transcribing segment ${segmentNumber}/${totalSegments} with Mistral model: ${modelName}`)
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const segmentSuffix = segmentNumber ? `_segment_${String(segmentNumber).padStart(3, '0')}` : ''
  const outputBase = `${outputDir}/transcription${segmentSuffix}`
  const fileBuffer = Buffer.from(await Bun.file(audioPath).arrayBuffer())

  const form = new FormData()
  form.append('model', modelName)
  form.append('file', new Blob([fileBuffer]), basename(audioPath))
  form.append('timestamp_granularities[]', 'segment')
  form.append('diarize', 'true')
  const baseURL = readEnv('MISTRAL_BASE_URL') ?? 'https://api.mistral.ai/v1'
  const response = await fetch(`${baseURL}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: form
  })
  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Mistral transcription failed (${response.status}): ${errText}`)
  }
  const rawPayload: unknown = await response.json()

  const payload = validateData(MistralTranscriptionResponseSchema, rawPayload, 'Mistral STT response')
  const segments = toSegments(payload.segments ?? [], offsetSeconds)
  if (segments.every(seg => seg.speaker === undefined)) {
    l.warn('Mistral diarization is enabled but the API returned no speaker labels for this audio')
  }
  const textFromPayload = (payload.text ?? '').trim()
  const text = textFromPayload.length > 0 ? textFromPayload : segments.map(seg => seg.text).join(' ').trim()

  const finalSegments = segments.length > 0
    ? segments
    : [{
        start: toTimestamp(offsetSeconds),
        end: toTimestamp(offsetSeconds),
        text
      }]

  const formattedTranscriptPath = `${outputBase}.txt`
  const formattedText = finalSegments.map(seg => {
    const speakerPrefix = seg.speaker ? `[${seg.speaker}] ` : ''
    return `[${seg.start}] ${speakerPrefix}${seg.text}`
  }).join('\n')
  await Bun.write(formattedTranscriptPath, formattedText)

  const processingTime = Date.now() - startTime
  const metadata: Step2Metadata = {
    transcriptionService: 'mistral',
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
