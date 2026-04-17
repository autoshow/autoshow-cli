import { basename } from 'node:path'
import type {
  AsyncSttLifecycleHooks,
  DiarizationOptions,
  GladiaHttpError,
  GladiaNormalizedWord,
  GladiaStatusResponse,
  GladiaUtterance,
  RetryClass,
  Step2Metadata,
  Step2RuntimeMetadata,
  TranscriptionResult,
  TranscriptionSegment
} from '~/types'
import {
  GladiaCreateResponseSchema,
  GladiaStatusResponseSchema,
  GladiaUploadResponseSchema
} from '~/types'
import * as l from '~/logger'
import {
  buildSegmentsFromWords,
  buildTranscriptionOutputBase,
  countTokens,
  formatSpeakerLabel,
  formatTranscriptText,
  resolveTranscriptionOutput,
  toTimestamp
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/stt-utils'
import {
  pollAsyncSttJobUntilComplete,
  readPersistedAsyncSttRuntime,
  writeAsyncSttProgressMetadata
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/async-stt-job-runner'
import { getGladiaBaseUrl } from './gladia'
import { readEnvFallback } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { classifyFetchRetry, parseRetryAfterMs, withRetry } from '~/utils/retries'

const INITIAL_POLL_INTERVAL_MS = 1000
const MAX_POLL_INTERVAL_MS = 10000
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

const buildGladiaUrl = (baseURL: string, path: string): string =>
  new URL(path.replace(/^\/+/, ''), baseURL.endsWith('/') ? baseURL : `${baseURL}/`).toString()

const attachGladiaErrorContext = (
  error: unknown,
  stage: 'upload' | 'create' | 'poll',
  retryClass: RetryClass,
  rawResponse?: unknown
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as GladiaHttpError).stage = stage
  ;(source as GladiaHttpError).retryClass = retryClass
  if (rawResponse !== undefined) {
    ;(source as GladiaHttpError).rawResponse = rawResponse
  }
  throw source
}

const getErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

const buildPollingDeadlineError = (
  transcriptionId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`Gladia timed out waiting for transcription completion for ${transcriptionId} (deadline exceeded after ${pollDeadlineMs}ms)`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const buildResumeProbeError = (
  transcriptionId: string,
  probeCount: number,
  totalWaitMs: number
): never => {
  const error = Object.assign(
    new Error(`Gladia transcription ${transcriptionId} is still pending after ${probeCount} resume status checks (${totalWaitMs}ms total backoff). Retry the command later.`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const flattenGladiaWords = (
  utterances: ReadonlyArray<GladiaUtterance>,
  offsetSeconds: number
): Array<{
  startSeconds: number
  endSeconds: number
  text: string
  normalized: string
  speaker?: string | undefined
  confidence?: number | undefined
  timingSource: 'native'
}> => {
  const words: Array<{
    startSeconds: number
    endSeconds: number
    text: string
    normalized: string
    speaker?: string | undefined
    confidence?: number | undefined
    timingSource: 'native'
  }> = []

  for (const utterance of utterances) {
    const speaker = formatSpeakerLabel(utterance.speaker)
    for (const word of utterance.words ?? []) {
      words.push({
        startSeconds: word.start + offsetSeconds,
        endSeconds: word.end + offsetSeconds,
        text: word.word,
        normalized: word.word.toLowerCase(),
        ...(speaker ? { speaker } : {}),
        ...(typeof word.confidence === 'number' ? { confidence: word.confidence } : {}),
        timingSource: 'native'
      })
    }
  }

  return words
}

const buildSegmentsFromUtterances = (
  utterances: ReadonlyArray<GladiaUtterance>,
  offsetSeconds: number
): TranscriptionSegment[] =>
  utterances.map((utterance) => ({
    start: toTimestamp(utterance.start + offsetSeconds),
    end: toTimestamp(utterance.end + offsetSeconds),
    text: utterance.text,
    ...(formatSpeakerLabel(utterance.speaker) ? { speaker: formatSpeakerLabel(utterance.speaker) } : {})
  }))

const extractUtterances = (status: GladiaStatusResponse) =>
  status.result?.transcription?.utterances
  ?? status.result?.diarization?.results
  ?? []

const buildNormalizedWords = (
  utterances: ReturnType<typeof extractUtterances>
): GladiaNormalizedWord[] =>
  utterances.flatMap((utterance) => {
    const speaker = formatSpeakerLabel(utterance.speaker)
    return (utterance.words ?? []).map((word) => ({
      start: word.start,
      end: word.end,
      text: word.word,
      ...(speaker ? { speaker } : {}),
      ...(typeof word.confidence === 'number' ? { confidence: word.confidence } : {})
    }))
  })

export const runGladiaStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    diarizationOptions?: DiarizationOptions | undefined
    audioDurationSeconds?: number | undefined
    runMode?: 'initial' | 'backfill' | undefined
    lifecycle?: AsyncSttLifecycleHooks | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const {
    model: modelName,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    diarizationOptions,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options
  const apiKey = readEnvFallback('GLADIA_API_KEY')
  if (!apiKey) {
    throw new Error('GLADIA_API_KEY environment variable is required for Gladia transcription')
  }

  if (segmentNumber && totalSegments) {
    l.info(`Transcribing segment ${segmentNumber}/${totalSegments} with Gladia model: ${modelName}`)
  }
  if (diarizationOptions?.speakerCount !== undefined) {
    l.info(`Gladia diarization speaker-count hint: ${diarizationOptions.speakerCount}`)
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const baseURL = getGladiaBaseUrl()
  const authHeaders = { 'x-gladia-key': apiKey }
  let uploadMs = 0
  let createMs = 0
  let pollMs = 0
  let pollSleepMs = 0
  let createCount = 0
  let pollCount = 0
  let requestCount = 0
  let retryCount = 0
  let rateLimitCount = 0
  const backfillCount = runMode === 'backfill' ? 1 : 0

  let runtime = await readPersistedAsyncSttRuntime(outputDir, {
    transcriptionService: 'gladia',
    transcriptionModel: modelName
  })
  let uploadUrl = runtime?.remoteAssetUrl
  let uploadAssetId = runtime?.remoteAssetId
  let transcriptionId = runtime?.remoteJobId
  let resumedExistingJob = false
  let jobReadyNotified = false

  const buildProgressMetadata = (nextRuntime: Step2RuntimeMetadata): Step2Metadata => ({
    transcriptionService: 'gladia',
    transcriptionModel: modelName,
    transcriptionModelName: modelName,
    processingTime: Date.now() - startTime,
    tokenCount: 0,
    timings: {
      ...(uploadMs > 0 ? { uploadMs } : {}),
      ...(createMs > 0 ? { createMs } : {}),
      ...(createCount > 0 ? { createCount } : {}),
      ...(pollMs > 0 ? { pollMs } : {}),
      ...(pollSleepMs > 0 ? { pollSleepMs } : {}),
      ...(pollCount > 0 ? { pollCount } : {}),
      ...(requestCount > 0 ? { requestCount } : {}),
      ...(retryCount > 0 ? { retryCount } : {}),
      ...(rateLimitCount > 0 ? { rateLimitCount } : {}),
      ...(backfillCount > 0 ? { backfillCount } : {})
    },
    runtime: nextRuntime
  })

  const persistProgressMetadata = async (nextRuntime: Step2RuntimeMetadata): Promise<void> => {
    runtime = nextRuntime
    await writeAsyncSttProgressMetadata(outputDir, buildProgressMetadata(nextRuntime))
  }

  const notifyJobReady = async (nextRuntime: Step2RuntimeMetadata): Promise<void> => {
    if (jobReadyNotified) {
      return
    }
    jobReadyNotified = true
    await lifecycle?.onJobReady?.(nextRuntime)
  }

  if (runtime && (runtime.stage === 'created' || runtime.stage === 'polling')) {
    resumedExistingJob = true
    runtime = {
      ...runtime,
      mode: 'resumed',
      stage: 'polling'
    }
    transcriptionId = runtime.remoteJobId
    uploadUrl = runtime.remoteAssetUrl
    uploadAssetId = runtime.remoteAssetId
    await persistProgressMetadata(runtime)
    await notifyJobReady(runtime)
  } else {
    let uploadPayload: unknown
    try {
      const uploadStartedAt = Date.now()
      uploadPayload = await withRetry(
        {
          retryClass: 'runtime_http_create_conservative',
          operationName: 'gladia-upload',
          policy: { maxAttempts: 4 },
          timeoutMs: REQUEST_TIMEOUT_MS
        },
        async (signal) => {
          requestCount += 1
          const form = new FormData()
          form.append('audio', Bun.file(audioPath), basename(audioPath))

          const response = await fetch(buildGladiaUrl(baseURL, '/v2/upload'), {
            method: 'POST',
            headers: authHeaders,
            body: form,
            signal: signal ?? null
          })

          if (!response.ok) {
            throw Object.assign(
              new Error(`Gladia upload failed (${response.status}): ${await response.text()}`),
              {
                status: response.status,
                headers: response.headers,
                stage: 'upload',
                retryClass: 'runtime_http_create_conservative'
              } satisfies Pick<GladiaHttpError, 'status' | 'headers' | 'stage' | 'retryClass'>
            )
          }

          return await response.json()
        },
        (error) => {
          const decision = classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
          if (decision.shouldRetry) {
            retryCount += 1
            if (getErrorStatus(error) === 429) {
              rateLimitCount += 1
            }
          }
          return decision
        }
      )
      uploadMs += Date.now() - uploadStartedAt
    } catch (error) {
      attachGladiaErrorContext(error, 'upload', 'runtime_http_create_conservative')
    }

    const uploadRecord = (() => {
      try {
        return validateData(GladiaUploadResponseSchema, uploadPayload, 'Gladia upload response')
      } catch (error) {
        return attachGladiaErrorContext(error, 'upload', 'runtime_http_create_conservative', uploadPayload)
      }
    })()

    uploadUrl = uploadRecord.audio_url
    uploadAssetId = uploadRecord.audio_metadata.id

    const createBody: Record<string, unknown> = {
      audio_url: uploadUrl,
      diarization: diarizationOptions?.enabled ?? true
    }
    if (diarizationOptions?.speakerCount !== undefined) {
      createBody['diarization_config'] = {
        number_of_speakers: diarizationOptions.speakerCount
      }
    }

    let createPayload: unknown
    try {
      const createStartedAt = Date.now()
      createPayload = await withRetry(
        {
          retryClass: 'runtime_http_create_conservative',
          operationName: 'gladia-create-transcription',
          policy: { maxAttempts: 4 },
          timeoutMs: REQUEST_TIMEOUT_MS
        },
        async (signal) => {
          requestCount += 1
          const response = await fetch(buildGladiaUrl(baseURL, '/v2/pre-recorded'), {
            method: 'POST',
            headers: {
              ...authHeaders,
              'content-type': 'application/json'
            },
            body: JSON.stringify(createBody),
            signal: signal ?? null
          })

          if (!response.ok) {
            throw Object.assign(
              new Error(`Gladia transcription creation failed (${response.status}): ${await response.text()}`),
              {
                status: response.status,
                headers: response.headers,
                stage: 'create',
                retryClass: 'runtime_http_create_conservative'
              } satisfies Pick<GladiaHttpError, 'status' | 'headers' | 'stage' | 'retryClass'>
            )
          }

          return await response.json()
        },
        (error) => {
          const decision = classifyFetchRetry(error, 'runtime_http_create_conservative', { retryAbortOnConservative: true })
          if (decision.shouldRetry) {
            retryCount += 1
            if (getErrorStatus(error) === 429) {
              rateLimitCount += 1
            }
          }
          return decision
        }
      )
      createMs += Date.now() - createStartedAt
      createCount += 1
    } catch (error) {
      attachGladiaErrorContext(error, 'create', 'runtime_http_create_conservative')
    }

    const createRecord = (() => {
      try {
        return validateData(GladiaCreateResponseSchema, createPayload, 'Gladia create response')
      } catch (error) {
        return attachGladiaErrorContext(error, 'create', 'runtime_http_create_conservative', createPayload)
      }
    })()

    transcriptionId = createRecord.id

    const createdRuntime: Step2RuntimeMetadata = {
      mode: 'fresh',
      stage: 'polling',
      remoteJobId: transcriptionId,
      ...(uploadAssetId ? { remoteAssetId: uploadAssetId } : {}),
      ...(uploadUrl ? { remoteAssetUrl: uploadUrl } : {}),
      createCompletedAt: new Date().toISOString()
    }
    await persistProgressMetadata(createdRuntime)
    await notifyJobReady(createdRuntime)
  }

  if (!transcriptionId) {
    throw new Error('Gladia transcription creation did not produce a transcription id')
  }

  const activeTranscriptionId = transcriptionId
  l.info(`${resumedExistingJob ? 'Gladia transcription resumed' : 'Gladia transcription created'}: ${activeTranscriptionId}, polling for completion...`)

  const pollResult = await pollAsyncSttJobUntilComplete({
    jobId: activeTranscriptionId,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    audioDurationSeconds,
    envSpecificDeadlineKey: 'AUTOSHOW_STT_POLL_DEADLINE_MS_GLADIA',
    pollMode: resumedExistingJob ? 'resume-probe' : 'fresh',
    buildDeadlineError: (jobId, pollDeadlineMs) => buildPollingDeadlineError(jobId, pollDeadlineMs),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs) => buildResumeProbeError(jobId, probeCount, totalWaitMs),
    poll: async () => {
      let result!: { payload: unknown, retryAfterMs: number | null }
      try {
        const pollStartedAt = Date.now()
        result = await withRetry(
          {
            retryClass: 'runtime_http_read',
            operationName: 'gladia-poll-transcription',
            policy: { maxAttempts: 6 },
            timeoutMs: POLL_REQUEST_TIMEOUT_MS
          },
          async (signal) => {
            requestCount += 1
            const response = await fetch(buildGladiaUrl(baseURL, `/v2/pre-recorded/${activeTranscriptionId}`), {
              method: 'GET',
              headers: authHeaders,
              signal: signal ?? null
            })

            if (!response.ok) {
              throw Object.assign(
                new Error(`Gladia polling failed (${response.status}): ${await response.text()}`),
                {
                  status: response.status,
                  headers: response.headers,
                  stage: 'poll',
                  retryClass: 'runtime_http_read'
                } satisfies Pick<GladiaHttpError, 'status' | 'headers' | 'stage' | 'retryClass'>
              )
            }

            return {
              payload: await response.json(),
              retryAfterMs: parseRetryAfterMs(response.headers) ?? null
            }
          },
          (error) => {
            const decision = classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
            if (decision.shouldRetry) {
              retryCount += 1
              if (getErrorStatus(error) === 429) {
                rateLimitCount += 1
              }
            }
            return decision
          }
        )
        pollMs += Date.now() - pollStartedAt
      } catch (error) {
        attachGladiaErrorContext(error, 'poll', 'runtime_http_read')
      }

      const status = (() => {
        try {
          return validateData(GladiaStatusResponseSchema, result.payload, 'Gladia transcription status response')
        } catch (error) {
          return attachGladiaErrorContext(error, 'poll', 'runtime_http_read', result.payload)
        }
      })()

      return {
        status,
        retryAfterMs: result.retryAfterMs
      }
    },
    isComplete: (status) => status.status === 'done',
    isFailed: (status) =>
      status.status === 'error'
        ? `Gladia transcription failed: ${status.message ?? (typeof status.error_code === 'number' ? `error code ${status.error_code}` : 'unknown error')}`
        : undefined,
    onProgress: async () => {
      await persistProgressMetadata({
        ...(runtime ?? {
          mode: 'fresh',
          stage: 'polling',
          remoteJobId: activeTranscriptionId
        }),
        mode: runtime?.mode ?? 'fresh',
        stage: 'polling',
        remoteJobId: activeTranscriptionId,
        ...(uploadAssetId ? { remoteAssetId: uploadAssetId } : {}),
        ...(uploadUrl ? { remoteAssetUrl: uploadUrl } : {}),
        ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
        lastPollAt: new Date().toISOString()
      })
    },
    withPollSlot: lifecycle?.withPollSlot
  })

  pollSleepMs += pollResult.pollSleepMs
  pollCount += pollResult.pollCount

  const transcript = pollResult.status
  const completedRuntime: Step2RuntimeMetadata = {
    ...(runtime ?? {
      mode: 'fresh',
      stage: 'completed',
      remoteJobId: activeTranscriptionId
    }),
    mode: runtime?.mode ?? 'fresh',
    stage: 'completed',
    remoteJobId: activeTranscriptionId,
    ...(uploadAssetId ? { remoteAssetId: uploadAssetId } : {}),
    ...(uploadUrl ? { remoteAssetUrl: uploadUrl } : {}),
    ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
    ...(runtime?.lastPollAt ? { lastPollAt: runtime.lastPollAt } : {}),
    completedAt: new Date().toISOString()
  }

  const utterances = extractUtterances(transcript)
  const normalizedWords = buildNormalizedWords(utterances)
  const evidenceWords = flattenGladiaWords(utterances, offsetSeconds)

  const segments = utterances.length > 0
    ? buildSegmentsFromUtterances(utterances, offsetSeconds)
    : normalizedWords.length > 0
      ? buildSegmentsFromWords(normalizedWords, offsetSeconds)
      : []

  const text = (transcript.result?.transcription?.full_transcript ?? '').trim()
  const { finalSegments, finalText } = resolveTranscriptionOutput(segments, text, offsetSeconds)

  await Bun.write(`${outputBase}.txt`, formatTranscriptText(finalSegments))

  const processingTime = Date.now() - startTime
  const remoteProcessingMs = Math.max(0, processingTime - uploadMs - createMs - pollMs)
  const metadata: Step2Metadata = {
    transcriptionService: 'gladia',
    transcriptionModel: modelName,
    transcriptionModelName: modelName,
    processingTime,
    tokenCount: countTokens(finalText),
    runtime: completedRuntime,
    ...((uploadMs > 0 || createMs > 0 || pollMs > 0 || pollSleepMs > 0 || remoteProcessingMs > 0 || requestCount > 0 || retryCount > 0 || rateLimitCount > 0)
      ? {
          timings: {
            ...(uploadMs > 0 ? { uploadMs } : {}),
            ...(createMs > 0 ? { createMs } : {}),
            ...(createCount > 0 ? { createCount } : {}),
            ...(pollMs > 0 ? { pollMs } : {}),
            ...(pollSleepMs > 0 ? { pollSleepMs } : {}),
            ...(pollCount > 0 ? { pollCount } : {}),
            ...(remoteProcessingMs > 0 ? { remoteProcessingMs } : {}),
            ...(requestCount > 0 ? { requestCount } : {}),
            ...(retryCount > 0 ? { retryCount } : {}),
            ...(rateLimitCount > 0 ? { rateLimitCount } : {}),
            ...(backfillCount > 0 ? { backfillCount } : {})
          }
        }
      : {})
  }

  if (segmentNumber && totalSegments) {
    l.success(`Segment ${segmentNumber}/${totalSegments} transcription completed in ${processingTime}ms`)
  }

  return {
    result: {
      text: finalText,
      segments: finalSegments,
      evidence: {
        ...(evidenceWords.length > 0 ? { words: evidenceWords } : {}),
        capabilities: {
          hasNativeWordTiming: evidenceWords.length > 0,
          hasConfidence: evidenceWords.some((word) => typeof word.confidence === 'number'),
          hasSpeakerLabels: evidenceWords.some((word) => word.speaker !== undefined) || finalSegments.some((segment) => segment.speaker !== undefined)
        },
        timingQuality: evidenceWords.length > 0 ? 'native_word' : 'segment_interpolated',
        rawResponse: transcript
      }
    },
    metadata
  }
}
