import OpenAI from 'openai'
import * as v from 'valibot'
import type { Step2Metadata, TranscriptionResult, TranscriptionSegment, DiarizationOptions } from '~/types'
import * as l from '~/logger'
import { countTokens, toTimestamp, buildTranscriptionOutputBase, formatTranscriptText, resolveTranscriptionOutput } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { validateData } from '~/utils/validate/validation'
import { getOpenAIClientConfig } from '~/utils/openai-utils'

const OpenAIDiarizedSegmentSchema = v.object({
  id: v.optional(v.string(), undefined),
  start: v.number(),
  end: v.number(),
  speaker: v.string(),
  text: v.string(),
  type: v.optional(v.string(), undefined)
})

const OpenAIDiarizedResponseSchema = v.object({
  text: v.string(),
  duration: v.optional(v.number(), undefined),
  task: v.optional(v.string(), undefined),
  segments: v.array(OpenAIDiarizedSegmentSchema)
})

const buildKnownSpeakerNames = (speakerCount: number | undefined): string[] | undefined => {
  if (speakerCount === undefined) {
    return undefined
  }

  if (!Number.isInteger(speakerCount) || speakerCount < 1) {
    throw new Error(`Invalid speaker count ${speakerCount} for OpenAI STT. Expected a positive integer.`)
  }

  return Array.from({ length: speakerCount }, (_, index) => `SPEAKER_${String(index + 1).padStart(2, '0')}`)
}

const shouldRetryWithoutKnownSpeakerNames = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false
  }
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
  return message.includes('Known speaker names and references must have the same number of items')
}

const toSegments = (segments: v.InferOutput<typeof OpenAIDiarizedResponseSchema>['segments'], offsetSeconds: number): TranscriptionSegment[] => {
  const parsed: TranscriptionSegment[] = []

  for (const segment of segments) {
    const text = segment.text.trim()
    if (text.length === 0) {
      continue
    }

    const speaker = segment.speaker.trim()
    parsed.push({
      start: toTimestamp(segment.start + offsetSeconds),
      end: toTimestamp(segment.end + offsetSeconds),
      text,
      ...(speaker.length > 0 ? { speaker } : {})
    })
  }

  return parsed
}

export const runOpenAIStt = async (
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
  const { model: modelName, segmentOffsetMinutes = 0, segmentNumber, totalSegments, diarizationOptions } = options
  const knownSpeakerNames = buildKnownSpeakerNames(diarizationOptions?.speakerCount)

  if (segmentNumber && totalSegments) {
    l.info(`Transcribing segment ${segmentNumber}/${totalSegments} with OpenAI model: ${modelName}`)
  }
  if (knownSpeakerNames) {
    l.info(`OpenAI diarization speaker-count hint: ${knownSpeakerNames.length}`)
  }

  const config = getOpenAIClientConfig()
  const client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, ...(config.baseURL ? { baseURL: config.baseURL } : {}) })

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  let rawPayload: unknown
  try {
    rawPayload = await client.audio.transcriptions.create({
      file: Bun.file(audioPath),
      model: modelName,
      response_format: 'diarized_json',
      chunking_strategy: 'auto',
      ...(knownSpeakerNames ? { known_speaker_names: knownSpeakerNames } : {})
    })
  } catch (error) {
    if (!knownSpeakerNames || !shouldRetryWithoutKnownSpeakerNames(error)) {
      throw error
    }
    l.warn('OpenAI diarization rejected known_speaker_names without references; retrying transcription without speaker-name hints')
    rawPayload = await client.audio.transcriptions.create({
      file: Bun.file(audioPath),
      model: modelName,
      response_format: 'diarized_json',
      chunking_strategy: 'auto'
    })
  }

  const payload = validateData(OpenAIDiarizedResponseSchema, rawPayload, 'OpenAI diarized transcription response')
  const segments = toSegments(payload.segments, offsetSeconds)
  const text = payload.text.trim()

  const { finalSegments, finalText } = resolveTranscriptionOutput(segments, text, offsetSeconds)

  const formattedTranscriptPath = `${outputBase}.txt`
  await Bun.write(formattedTranscriptPath, formatTranscriptText(finalSegments))

  const processingTime = Date.now() - startTime
  const metadata: Step2Metadata = {
    transcriptionService: 'openai',
    transcriptionModel: modelName,
    transcriptionModelName: modelName,
    processingTime,
    tokenCount: countTokens(finalText)
  }

  if (segmentNumber && totalSegments) {
    l.success(`Segment ${segmentNumber}/${totalSegments} transcription completed in ${processingTime}ms`)
  }

  return {
    result: {
      text: finalText,
      segments: finalSegments
    },
    metadata
  }
}
