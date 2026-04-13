import type {
  Step2Metadata,
  TranscriptionResult,
  TranscriptionSegment,
  ElevenLabsSttResponse,
  DiarizationOptions,
  RetryClass
} from '~/types'
import { ElevenLabsSttResponseSchema } from '~/types'
import * as l from '~/logger'
import { countTokens, toTimestamp, parseSeconds, appendToken, buildTranscriptionOutputBase, formatTranscriptText, resolveTranscriptionOutput, formatSpeakerLabel, buildSegmentsFromWords } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { withRetry, classifyFetchRetry } from '~/utils/retries'

const REQUEST_TIMEOUT_MS = 20 * 60 * 1000

type ElevenLabsHttpError = Error & {
  status: number
  headers: Headers
  stage?: 'transcribe'
  retryClass?: RetryClass
}

const attachElevenLabsErrorContext = (
  error: unknown,
  stage: 'transcribe',
  retryClass: RetryClass
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as ElevenLabsHttpError).stage = stage
  ;(source as ElevenLabsHttpError).retryClass = retryClass
  throw source
}

const appendElevenLabsDiarizationOptions = (
  form: FormData,
  diarizationOptions: DiarizationOptions | undefined
): void => {
  const diarizationEnabled = diarizationOptions?.enabled === true || diarizationOptions?.speakerCount !== undefined
  const speakerCount = diarizationOptions?.speakerCount
  if (!diarizationEnabled) {
    return
  }

  form.append('diarize', 'true')
  if (speakerCount !== undefined) {
    if (!Number.isInteger(speakerCount) || speakerCount < 1 || speakerCount > 32) {
      throw new Error(`Invalid speaker count ${speakerCount} for ElevenLabs. Expected an integer from 1 to 32.`)
    }

    form.append('num_speakers', String(speakerCount))
  }
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
      ...(segment.speaker_id !== undefined ? { speaker: formatSpeakerLabel(segment.speaker_id) } : {})
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
  const normalized = words
    .map(w => {
      const start = parseSeconds(w.start) ?? 0
      const rawEnd = parseSeconds(w.end)
      return {
        start,
        end: rawEnd !== null ? rawEnd : start,
        text: (w.text ?? w.word ?? '').trim(),
        speaker: formatSpeakerLabel(w.speaker_id)
      }
    })
    .filter(w => w.text.length > 0)
  return buildSegmentsFromWords(normalized, offsetSeconds)
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
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)

  const form = new FormData()
  form.append('model_id', modelName)
  form.append('file', Bun.file(audioPath))
  appendElevenLabsDiarizationOptions(form, diarizationOptions)

  const baseURL = readEnv('ELEVENLABS_BASE_URL') ?? 'https://api.elevenlabs.io/v1'
  let rawPayload: unknown
  try {
    rawPayload = await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'elevenlabs-stt',
        policy: { maxAttempts: 4 },
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
      const response = await fetch(`${baseURL}/speech-to-text`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
        },
        body: form,
        signal: signal ?? null
      })

        if (!response.ok) {
          const errText = await response.text()
          throw Object.assign(
            new Error(`ElevenLabs transcription failed (${response.status}): ${errText}`),
            {
              status: response.status,
              headers: response.headers,
              stage: 'transcribe',
              retryClass: 'runtime_http_create_conservative'
            } satisfies Pick<ElevenLabsHttpError, 'status' | 'headers' | 'stage' | 'retryClass'>
          )
        }

      return await response.json()
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
    )
  } catch (error) {
    attachElevenLabsErrorContext(error, 'transcribe', 'runtime_http_create_conservative')
  }
  const payload = validateData(ElevenLabsSttResponseSchema, rawPayload, 'ElevenLabs STT response')

  const text = (payload.text ?? '').trim() || textFromWords(payload.words)

  const segmentsFromApi = segmentsFromApiSegments(payload.segments, offsetSeconds)
  const segmentsFromWordTiming = segmentsFromWords(payload.words, offsetSeconds)
  const segments = segmentsFromApi.length > 0 ? segmentsFromApi : segmentsFromWordTiming

  const { finalSegments, finalText } = resolveTranscriptionOutput(segments, text, offsetSeconds)

  const formattedTranscriptPath = `${outputBase}.txt`
  await Bun.write(formattedTranscriptPath, formatTranscriptText(finalSegments))

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
