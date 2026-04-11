import OpenAI from 'openai'
import * as v from 'valibot'
import type { Step2Metadata, TranscriptionResult, TranscriptionSegment, DiarizationOptions } from '~/types'
import * as l from '~/logger'
import { countTokens, toTimestamp, buildTranscriptionOutputBase, formatTranscriptText, resolveTranscriptionOutput } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { validateData } from '~/utils/validate/validation'
import { getOpenAIClientConfig } from '~/utils/openai-utils'
import { CLIUsageError } from '~/utils/error-handler'

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

const inferReferenceMimeType = (referencePath: string): string => {
  const lower = referencePath.toLowerCase()
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.m4a')) return 'audio/mp4'
  if (lower.endsWith('.mp4')) return 'audio/mp4'
  if (lower.endsWith('.flac')) return 'audio/flac'
  if (lower.endsWith('.ogg')) return 'audio/ogg'
  if (lower.endsWith('.webm')) return 'audio/webm'
  return 'application/octet-stream'
}

const toKnownSpeakerReferenceDataUrl = async (referencePath: string): Promise<string> => {
  if (referencePath.startsWith('data:')) {
    return referencePath
  }

  const file = Bun.file(referencePath)
  if (!await file.exists()) {
    throw CLIUsageError(`OpenAI speaker reference "${referencePath}" was not found.`)
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const mimeType = file.type || inferReferenceMimeType(referencePath)
  return `data:${mimeType};base64,${bytes.toString('base64')}`
}

const resolveKnownSpeakerReferences = async (diarizationOptions: DiarizationOptions | undefined): Promise<string[] | undefined> => {
  const references = diarizationOptions?.knownSpeakerReferencePaths
  if (!references || references.length === 0) {
    return undefined
  }

  const dataUrls: string[] = []
  for (const reference of references) {
    dataUrls.push(await toKnownSpeakerReferenceDataUrl(reference))
  }

  return dataUrls
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
  const knownSpeakerNames = diarizationOptions?.knownSpeakerNames
  const knownSpeakerReferences = await resolveKnownSpeakerReferences(diarizationOptions)

  if (segmentNumber && totalSegments) {
    l.info(`Transcribing segment ${segmentNumber}/${totalSegments} with OpenAI model: ${modelName}`)
  }
  if (knownSpeakerNames && knownSpeakerReferences) {
    l.info(`OpenAI diarization known speakers: ${knownSpeakerNames.join(', ')}`)
  }

  const config = getOpenAIClientConfig()
  const client = new OpenAI({ apiKey: config.apiKey, maxRetries: 0, ...(config.baseURL ? { baseURL: config.baseURL } : {}) })

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  const rawPayload = await client.audio.transcriptions.create({
    file: Bun.file(audioPath),
    model: modelName,
    response_format: 'diarized_json',
    chunking_strategy: 'auto',
    ...(knownSpeakerNames ? { known_speaker_names: knownSpeakerNames } : {}),
    ...(knownSpeakerReferences ? { known_speaker_references: knownSpeakerReferences } : {})
  })

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
