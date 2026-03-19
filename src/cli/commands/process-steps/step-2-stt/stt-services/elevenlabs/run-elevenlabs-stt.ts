import type {
  Step2Metadata,
  TranscriptionResult,
  TranscriptionSegment,
  ElevenLabsSttResponse,
  DiarizationOptions
} from '~/types'
import { ElevenLabsSttResponseSchema } from '~/types'
import * as l from '~/logger'
import { countTokens, toTimestamp, parseSeconds, appendToken } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'

const appendElevenLabsDiarizationOptions = (
  form: FormData,
  diarizationOptions: DiarizationOptions | undefined
): void => {
  const speakerCount = diarizationOptions?.speakerCount
  if (speakerCount === undefined) {
    return
  }

  if (!Number.isInteger(speakerCount) || speakerCount < 1 || speakerCount > 32) {
    throw new Error(`Invalid speaker count ${speakerCount} for ElevenLabs. Expected an integer from 1 to 32.`)
  }

  form.append('diarize', 'true')
  form.append('num_speakers', String(speakerCount))
}

const formatSpeaker = (speakerId: string | number | undefined): string | undefined => {
  if (speakerId === undefined) {
    return undefined
  }
  if (typeof speakerId === 'number') {
    return `speaker-${speakerId}`
  }
  return speakerId.trim().length > 0 ? speakerId : undefined
}

const textFromWords = (words: ElevenLabsSttResponse['words']): string => {
  if (!words) {
    return ''
  }

  let text = ''
  for (const word of words) {
    const token = (word.text ?? word.word ?? '').trim()
    if (token.length === 0) {
      continue
    }
    text = appendToken(text, token)
  }

  return text.trim()
}

const segmentsFromApiSegments = (
  segments: ElevenLabsSttResponse['segments'],
  offsetSeconds: number
): TranscriptionSegment[] => {
  if (!segments) {
    return []
  }

  const parsed: TranscriptionSegment[] = []
  for (const segment of segments) {
    const text = (segment.text ?? '').trim()
    if (text.length === 0) {
      continue
    }

    const startRaw = parseSeconds(segment.start)
    const endRaw = parseSeconds(segment.end)
    const start = (startRaw ?? 0) + offsetSeconds
    const end = (endRaw ?? startRaw ?? 0) + offsetSeconds

    parsed.push({
      start: toTimestamp(start),
      end: toTimestamp(end),
      text,
      ...(segment.speaker_id !== undefined ? { speaker: formatSpeaker(segment.speaker_id) } : {})
    })
  }

  return parsed
}

const segmentsFromWords = (
  words: ElevenLabsSttResponse['words'],
  offsetSeconds: number
): TranscriptionSegment[] => {
  if (!words) {
    return []
  }

  const segments: TranscriptionSegment[] = []
  const maxWordsPerSegment = 35
  const minWordsForPunctuationBreak = 18

  let currentText = ''
  let currentWordCount = 0
  let segmentStart: number | null = null
  let segmentEnd: number | null = null
  let currentSpeaker: string | undefined

  const flush = (): void => {
    const text = currentText.trim()
    if (text.length === 0) {
      currentText = ''
      currentWordCount = 0
      segmentStart = null
      segmentEnd = null
      currentSpeaker = undefined
      return
    }

    const start = segmentStart ?? 0
    const end = segmentEnd ?? start
    segments.push({
      start: toTimestamp(start + offsetSeconds),
      end: toTimestamp(end + offsetSeconds),
      text,
      ...(currentSpeaker ? { speaker: currentSpeaker } : {})
    })

    currentText = ''
    currentWordCount = 0
    segmentStart = null
    segmentEnd = null
    currentSpeaker = undefined
  }

  for (const word of words) {
    const token = (word.text ?? word.word ?? '').trim()
    if (token.length === 0) {
      continue
    }

    const start = parseSeconds(word.start)
    const end = parseSeconds(word.end)

    if (segmentStart === null && start !== null) {
      segmentStart = start
    }
    if (end !== null) {
      segmentEnd = end
    } else if (start !== null) {
      segmentEnd = start
    }

    currentText = appendToken(currentText, token)
    currentWordCount += 1

    if (currentSpeaker === undefined) {
      currentSpeaker = formatSpeaker(word.speaker_id)
    }

    const punctuationBreak = /[.!?]$/.test(token) && currentWordCount >= minWordsForPunctuationBreak
    const sizeBreak = currentWordCount >= maxWordsPerSegment

    if (punctuationBreak || sizeBreak) {
      flush()
    }
  }

  flush()
  return segments
}

export const runElevenLabsTranscribe = async (
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
  const apiKey = readEnvFallback('ELEVENLABS_API_KEY')
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY environment variable is required for ElevenLabs transcription')
  }

  if (segmentNumber && totalSegments) {
    l.info(`Transcribing segment ${segmentNumber}/${totalSegments} with ElevenLabs model: ${modelName}`)
  }
  if (diarizationOptions?.speakerCount !== undefined) {
    l.info(`ElevenLabs diarization speaker-count hint: ${diarizationOptions.speakerCount}`)
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const segmentSuffix = segmentNumber ? `_segment_${String(segmentNumber).padStart(3, '0')}` : ''
  const outputBase = `${outputDir}/transcription${segmentSuffix}`

  const form = new FormData()
  form.append('model_id', modelName)
  form.append('file', Bun.file(audioPath))
  appendElevenLabsDiarizationOptions(form, diarizationOptions)

  const baseURL = readEnv('ELEVENLABS_BASE_URL') ?? 'https://api.elevenlabs.io/v1'
  const response = await fetch(`${baseURL}/speech-to-text`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
    },
    body: form
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`ElevenLabs transcription failed (${response.status}): ${errText}`)
  }

  const rawPayload: unknown = await response.json()
  const payload = validateData(ElevenLabsSttResponseSchema, rawPayload, 'ElevenLabs STT response')

  const text = (payload.text ?? '').trim() || textFromWords(payload.words)

  const segmentsFromApi = segmentsFromApiSegments(payload.segments, offsetSeconds)
  const segmentsFromWordTiming = segmentsFromWords(payload.words, offsetSeconds)
  const segments = segmentsFromApi.length > 0 ? segmentsFromApi : segmentsFromWordTiming

  const finalSegments = segments.length > 0
    ? segments
    : [{
        start: toTimestamp(offsetSeconds),
        end: toTimestamp(offsetSeconds),
        text
      }]

  const finalText = text.length > 0
    ? text
    : finalSegments.map(seg => seg.text).join(' ').trim()

  const formattedTranscriptPath = `${outputBase}.txt`
  const formattedText = finalSegments.map(seg => {
    const speakerPrefix = seg.speaker ? `[${seg.speaker}] ` : ''
    return `[${seg.start}] ${speakerPrefix}${seg.text}`
  }).join('\n')
  await Bun.write(formattedTranscriptPath, formattedText)

  const processingTime = Date.now() - startTime
  const metadata: Step2Metadata = {
    transcriptionService: 'elevenlabs',
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
