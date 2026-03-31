import type {
  Step2Metadata,
  TranscriptionResult,
  TranscriptionSegment,
  DiarizationOptions
} from '~/types'
import { AssemblyAiTranscriptResponseSchema } from '~/types'
import * as l from '~/logger'
import { countTokens, toTimestamp, buildTranscriptionOutputBase, formatTranscriptText, resolveTranscriptionOutput, buildSegmentsFromWords } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const POLL_INTERVAL_MS = 3000

const formatSpeaker = (speaker: string | undefined): string | undefined => {
  if (speaker === undefined || speaker.length === 0) return undefined
  return `speaker-${speaker}`
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

export const runAssemblyAiTranscribe = async (
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
  const apiKey = readEnvFallback('ASSEMBLYAI_API_KEY')
  if (!apiKey) {
    throw new Error('ASSEMBLYAI_API_KEY environment variable is required for AssemblyAI transcription')
  }

  if (segmentNumber && totalSegments) {
    l.info(`Transcribing segment ${segmentNumber}/${totalSegments} with AssemblyAI model: ${modelName}`)
  }
  if (diarizationOptions?.speakerCount !== undefined) {
    l.info(`AssemblyAI diarization speaker-count hint: ${diarizationOptions.speakerCount}`)
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  const baseURL = readEnv('ASSEMBLYAI_BASE_URL') ?? 'https://api.assemblyai.com'
  const headers = {
    'authorization': apiKey,
    'content-type': 'application/json'
  }

  const fileBuffer = await Bun.file(audioPath).arrayBuffer()
  const uploadResponse = await fetch(`${baseURL}/v2/upload`, {
    method: 'POST',
    headers: {
      'authorization': apiKey,
      'content-type': 'application/octet-stream'
    },
    body: fileBuffer
  })

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text()
    throw new Error(`AssemblyAI upload failed (${uploadResponse.status}): ${errText}`)
  }

  const uploadResult: unknown = await uploadResponse.json()
  const uploadRecord = uploadResult as Record<string, unknown> | null
  if (typeof uploadRecord !== 'object' || uploadRecord === null || typeof uploadRecord['upload_url'] !== 'string') {
    throw new Error('AssemblyAI upload response missing upload_url')
  }
  const uploadUrl = uploadRecord['upload_url']

  const transcriptBody: Record<string, unknown> = {
    audio_url: uploadUrl,
    speech_models: [modelName],
    speaker_labels: true
  }
  if (diarizationOptions?.speakerCount !== undefined) {
    transcriptBody['speakers_expected'] = diarizationOptions.speakerCount
  }

  const createResponse = await fetch(`${baseURL}/v2/transcript`, {
    method: 'POST',
    headers,
    body: JSON.stringify(transcriptBody)
  })

  if (!createResponse.ok) {
    const errText = await createResponse.text()
    throw new Error(`AssemblyAI transcript creation failed (${createResponse.status}): ${errText}`)
  }

  const createResult: unknown = await createResponse.json()
  const createRecord = createResult as Record<string, unknown> | null
  if (typeof createRecord !== 'object' || createRecord === null || typeof createRecord['id'] !== 'string') {
    throw new Error('AssemblyAI transcript creation response missing id')
  }
  const transcriptId = createRecord['id']

  l.info(`AssemblyAI transcript created: ${transcriptId}, polling for completion...`)

  let pollPayload: unknown
  while (true) {
    await sleep(POLL_INTERVAL_MS)

    const pollResponse = await fetch(`${baseURL}/v2/transcript/${transcriptId}`, {
      method: 'GET',
      headers: { 'authorization': apiKey }
    })

    if (!pollResponse.ok) {
      const errText = await pollResponse.text()
      throw new Error(`AssemblyAI polling failed (${pollResponse.status}): ${errText}`)
    }

    pollPayload = await pollResponse.json()
    const validated = validateData(AssemblyAiTranscriptResponseSchema, pollPayload, 'AssemblyAI transcript response')

    if (validated.status === 'completed') {
      pollPayload = validated
      break
    }

    if (validated.status === 'error') {
      throw new Error(`AssemblyAI transcription failed: ${validated.error ?? 'unknown error'}`)
    }
  }

  const transcript = validateData(AssemblyAiTranscriptResponseSchema, pollPayload, 'AssemblyAI transcript response')

  const segments: TranscriptionSegment[] = []

  if (transcript.utterances && transcript.utterances.length > 0) {
    for (const utterance of transcript.utterances) {
      const startSec = utterance.start / 1000 + offsetSeconds
      const endSec = utterance.end / 1000 + offsetSeconds
      segments.push({
        start: toTimestamp(startSec),
        end: toTimestamp(endSec),
        text: utterance.text,
        ...(formatSpeaker(utterance.speaker) ? { speaker: formatSpeaker(utterance.speaker) } : {})
      })
    }
  } else if (transcript.words && transcript.words.length > 0) {
    const normalized = transcript.words.map(w => ({
      start: w.start / 1000,
      end: w.end / 1000,
      text: w.text,
      speaker: formatSpeaker(w.speaker)
    }))
    segments.push(...buildSegmentsFromWords(normalized, offsetSeconds))
  }

  const text = (transcript.text ?? '').trim()

  const { finalSegments, finalText } = resolveTranscriptionOutput(segments, text, offsetSeconds)

  const formattedTranscriptPath = `${outputBase}.txt`
  await Bun.write(formattedTranscriptPath, formatTranscriptText(finalSegments))

  const processingTime = Date.now() - startTime
  const metadata: Step2Metadata = {
    transcriptionService: 'assemblyai',
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
