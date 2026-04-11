import type {
  Step2Metadata,
  TranscriptionResult,
  TranscriptionSegment,
  DiarizationOptions,
  RetryClass
} from '~/types'
import { AssemblyAiTranscriptResponseSchema } from '~/types'
import * as l from '~/logger'
import { countTokens, toTimestamp, buildTranscriptionOutputBase, formatTranscriptText, resolveTranscriptionOutput, buildSegmentsFromWords } from '~/cli/commands/process-steps/step-2-stt/stt-utils/transcription-utils'
import { readEnv, readEnvFallback } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { withRetry, classifyFetchRetry } from '~/utils/retries'

const INITIAL_POLL_INTERVAL_MS = 1000
const MAX_POLL_INTERVAL_MS = 10000
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

type AssemblyAiHttpError = Error & {
  status: number
  headers: Headers
  stage?: 'upload' | 'create' | 'poll'
  retryClass?: RetryClass
}

const formatSpeaker = (speaker: string | undefined): string | undefined => {
  if (speaker === undefined || speaker.length === 0) return undefined
  return `speaker-${speaker}`
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

const parseRetryAfterMs = (headers: Headers): number | null => {
  const retryAfter = headers.get('retry-after')
  if (!retryAfter) {
    return null
  }

  const asSeconds = Number.parseFloat(retryAfter)
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.round(asSeconds * 1000)
  }

  const asDate = Date.parse(retryAfter)
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now())
  }

  return null
}

const attachAssemblyAiErrorContext = (
  error: unknown,
  stage: 'upload' | 'create' | 'poll',
  retryClass: RetryClass
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as AssemblyAiHttpError).stage = stage
  ;(source as AssemblyAiHttpError).retryClass = retryClass
  throw source
}

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
  let uploadResult: unknown
  try {
    uploadResult = await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'assemblyai-upload',
        policy: { maxAttempts: 4 },
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
      const uploadResponse = await fetch(`${baseURL}/v2/upload`, {
        method: 'POST',
        headers: {
          'authorization': apiKey,
          'content-type': 'application/octet-stream'
        },
        body: fileBuffer,
        signal: signal ?? null
      })

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text()
        throw Object.assign(
          new Error(`AssemblyAI upload failed (${uploadResponse.status}): ${errText}`),
          {
            status: uploadResponse.status,
            headers: uploadResponse.headers,
            stage: 'upload',
            retryClass: 'runtime_http_create_conservative'
          } satisfies Pick<AssemblyAiHttpError, 'status' | 'headers' | 'stage' | 'retryClass'>
        )
      }

      return await uploadResponse.json()
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
    )
  } catch (error) {
    attachAssemblyAiErrorContext(error, 'upload', 'runtime_http_create_conservative')
  }
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

  let createResult: unknown
  try {
    createResult = await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'assemblyai-create-transcript',
        policy: { maxAttempts: 4 },
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
      const createResponse = await fetch(`${baseURL}/v2/transcript`, {
        method: 'POST',
        headers,
        body: JSON.stringify(transcriptBody),
        signal: signal ?? null
      })

      if (!createResponse.ok) {
        const errText = await createResponse.text()
        throw Object.assign(
          new Error(`AssemblyAI transcript creation failed (${createResponse.status}): ${errText}`),
          {
            status: createResponse.status,
            headers: createResponse.headers,
            stage: 'create',
            retryClass: 'runtime_http_create_conservative'
          } satisfies Pick<AssemblyAiHttpError, 'status' | 'headers' | 'stage' | 'retryClass'>
        )
      }

      return await createResponse.json()
      },
      (error) => classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
    )
  } catch (error) {
    attachAssemblyAiErrorContext(error, 'create', 'runtime_http_create_conservative')
  }
  const createRecord = createResult as Record<string, unknown> | null
  if (typeof createRecord !== 'object' || createRecord === null || typeof createRecord['id'] !== 'string') {
    throw new Error('AssemblyAI transcript creation response missing id')
  }
  const transcriptId = createRecord['id']

  l.info(`AssemblyAI transcript created: ${transcriptId}, polling for completion...`)

  let pollPayload: unknown
  let pollDelayMs = INITIAL_POLL_INTERVAL_MS
  while (true) {
    await sleep(pollDelayMs)

    let pollResult!: { payload: unknown, retryAfterMs: number | null }
    try {
      pollResult = await withRetry(
        {
          retryClass: 'runtime_http_read',
          operationName: 'assemblyai-poll-transcript',
          policy: { maxAttempts: 6 },
          timeoutMs: POLL_REQUEST_TIMEOUT_MS
        },
        async (signal) => {
        const pollResponse = await fetch(`${baseURL}/v2/transcript/${transcriptId}`, {
          method: 'GET',
          headers: { 'authorization': apiKey },
          signal: signal ?? null
        })

        if (!pollResponse.ok) {
          const errText = await pollResponse.text()
          throw Object.assign(
            new Error(`AssemblyAI polling failed (${pollResponse.status}): ${errText}`),
            {
              status: pollResponse.status,
              headers: pollResponse.headers,
              stage: 'poll',
              retryClass: 'runtime_http_read'
            } satisfies Pick<AssemblyAiHttpError, 'status' | 'headers' | 'stage' | 'retryClass'>
          )
        }

        return {
          payload: await pollResponse.json(),
          retryAfterMs: parseRetryAfterMs(pollResponse.headers)
        }
        },
        (error) => classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
      )
    } catch (error) {
      attachAssemblyAiErrorContext(error, 'poll', 'runtime_http_read')
    }

    pollPayload = pollResult.payload
    const validated = validateData(AssemblyAiTranscriptResponseSchema, pollPayload, 'AssemblyAI transcript response')

    if (validated.status === 'completed') {
      pollPayload = validated
      break
    }

    if (validated.status === 'error') {
      throw new Error(`AssemblyAI transcription failed: ${validated.error ?? 'unknown error'}`)
    }

    pollDelayMs = pollResult.retryAfterMs !== null
      ? Math.min(MAX_POLL_INTERVAL_MS, Math.max(INITIAL_POLL_INTERVAL_MS, pollResult.retryAfterMs))
      : Math.min(MAX_POLL_INTERVAL_MS, pollDelayMs * 2)
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
