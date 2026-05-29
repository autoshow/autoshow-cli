import * as l from '~/utils/logger'
import type {
  AssemblyAiHttpError,
  AsyncSttLifecycleHooks,
  Step2Metadata,
  Step2RuntimeMetadata,
  TranscriptionResult,
  TranscriptionSegment,
  DiarizationOptions,
  RetryClass
} from '~/types'
import { AssemblyAiTranscriptResponseSchema } from '~/types'
import {
  logSttAsyncJobLifecycle,
  logSttDiarizationConfig,
  logSttSegmentLifecycle
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import { countTokens, toTimestamp, buildTranscriptionOutputBase, formatTranscriptText, resolveTranscriptionOutput, buildSegmentsFromWords } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import {
  pollAsyncSttJobUntilComplete,
  readPersistedAsyncSttRuntime,
  writeAsyncSttProgressMetadata
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import { ASSEMBLYAI_DEFAULT_BASE_URL } from '~/utils/base-urls'
import { readEnv } from '~/utils/validate/env-utils'
import { validateData } from '~/utils/validate/validation'
import { withRetry, classifyFetchRetry } from '~/utils/retries'

const INITIAL_POLL_INTERVAL_MS = 1000
const MAX_POLL_INTERVAL_MS = 10000
const REQUEST_TIMEOUT_MS = 20 * 60 * 1000
const POLL_REQUEST_TIMEOUT_MS = 60 * 1000

const formatSpeaker = (speaker: string | undefined): string | undefined => {
  if (speaker === undefined || speaker.length === 0) return undefined
  return `speaker-${speaker}`
}

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

const getErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

const buildPollingDeadlineError = (
  transcriptId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`AssemblyAI timed out waiting for transcription completion for ${transcriptId} (deadline exceeded after ${pollDeadlineMs}ms)`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const buildResumeProbeError = (
  transcriptId: string,
  probeCount: number,
  totalWaitMs: number
): never => {
  const error = Object.assign(
    new Error(`AssemblyAI transcript ${transcriptId} is still pending after ${probeCount} resume status checks (${totalWaitMs}ms total backoff). Retry the command later.`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
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
  const apiKey = readEnv('ASSEMBLYAI_API_KEY')
  if (!apiKey) {
    throw new Error('ASSEMBLYAI_API_KEY environment variable is required for AssemblyAI transcription')
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'assemblyai', action: 'started', segmentNumber, totalSegments, model: modelName })
  }
  if (diarizationOptions?.speakerCount !== undefined) {
    logSttDiarizationConfig(l, {
      provider: 'assemblyai',
      model: modelName,
      enabled: true,
      speakerCount: diarizationOptions.speakerCount
    })
  }

  const startTime = Date.now()
  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
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

  const baseURL = ASSEMBLYAI_DEFAULT_BASE_URL
  const headers = {
    'authorization': apiKey,
    'content-type': 'application/json'
  }

  const audioFile = Bun.file(audioPath)
  let runtime = await readPersistedAsyncSttRuntime(outputDir, {
    transcriptionService: 'assemblyai',
    transcriptionModel: modelName
  })
  let uploadUrl = runtime?.remoteAssetUrl
  let transcriptId = runtime?.remoteJobId
  let resumedExistingTranscript = false
  let jobReadyNotified = false

  const buildProgressMetadata = (nextRuntime: Step2RuntimeMetadata): Step2Metadata => ({
    transcriptionService: 'assemblyai',
    transcriptionModel: modelName,
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
    resumedExistingTranscript = true
    runtime = {
      ...runtime,
      mode: 'resumed',
      stage: 'polling'
    }
    transcriptId = runtime.remoteJobId
    uploadUrl = runtime.remoteAssetUrl
    await persistProgressMetadata(runtime)
    await notifyJobReady(runtime)
  } else {
    let uploadResult: unknown
    try {
      const uploadStartedAt = Date.now()
      uploadResult = await withRetry(
        {
          retryClass: 'runtime_http_create_conservative',
          operationName: 'assemblyai-upload',
          policy: { maxAttempts: 4 },
          timeoutMs: REQUEST_TIMEOUT_MS
        },
        async (signal) => {
          requestCount += 1
          const uploadResponse = await fetch(`${baseURL}/v2/upload`, {
            method: 'POST',
            headers: {
              'authorization': apiKey,
              'content-type': 'application/octet-stream'
            },
            body: audioFile,
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
      attachAssemblyAiErrorContext(error, 'upload', 'runtime_http_create_conservative')
    }
    const uploadRecord = uploadResult as Record<string, unknown> | null
    if (typeof uploadRecord !== 'object' || uploadRecord === null || typeof uploadRecord['upload_url'] !== 'string') {
      throw new Error('AssemblyAI upload response missing upload_url')
    }
    uploadUrl = uploadRecord['upload_url']

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
      const createStartedAt = Date.now()
      createResult = await withRetry(
        {
          retryClass: 'runtime_http_create_conservative',
          operationName: 'assemblyai-create-transcript',
          policy: { maxAttempts: 4 },
          timeoutMs: REQUEST_TIMEOUT_MS
        },
        async (signal) => {
          requestCount += 1
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
      attachAssemblyAiErrorContext(error, 'create', 'runtime_http_create_conservative')
    }
    const createRecord = createResult as Record<string, unknown> | null
    if (typeof createRecord !== 'object' || createRecord === null || typeof createRecord['id'] !== 'string') {
      throw new Error('AssemblyAI transcript creation response missing id')
    }
    transcriptId = createRecord['id']

    const createdRuntime: Step2RuntimeMetadata = {
      mode: 'fresh',
      stage: 'polling',
      remoteJobId: transcriptId,
      remoteAssetUrl: uploadUrl,
      createCompletedAt: new Date().toISOString()
    }
    await persistProgressMetadata(createdRuntime)
    await notifyJobReady(createdRuntime)
  }

  if (!transcriptId) {
    throw new Error('AssemblyAI transcript creation did not produce a transcript id')
  }
  const activeTranscriptId = transcriptId
  logSttAsyncJobLifecycle(l, {
    provider: `assemblyai/${modelName}`,
    action: resumedExistingTranscript ? 'resumed' : 'created',
    remoteId: activeTranscriptId,
    state: 'polling'
  })

  const pollResult = await pollAsyncSttJobUntilComplete({
    jobId: activeTranscriptId,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    audioDurationSeconds,
    pollMode: resumedExistingTranscript ? 'resume-probe' : 'fresh',
    buildDeadlineError: (jobId, pollDeadlineMs) => buildPollingDeadlineError(jobId, pollDeadlineMs),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs) => buildResumeProbeError(jobId, probeCount, totalWaitMs),
    poll: async () => {
      let result!: { payload: unknown, retryAfterMs: number | null }
      try {
        const pollStartedAt = Date.now()
        result = await withRetry(
          {
            retryClass: 'runtime_http_read',
            operationName: 'assemblyai-poll-transcript',
            policy: { maxAttempts: 6 },
            timeoutMs: POLL_REQUEST_TIMEOUT_MS
          },
          async (signal) => {
            requestCount += 1
            const pollResponse = await fetch(`${baseURL}/v2/transcript/${activeTranscriptId}`, {
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
        attachAssemblyAiErrorContext(error, 'poll', 'runtime_http_read')
      }

      return {
        status: validateData(AssemblyAiTranscriptResponseSchema, result.payload, 'AssemblyAI transcript response'),
        retryAfterMs: result.retryAfterMs
      }
    },
    isComplete: (status) => status.status === 'completed',
    isFailed: (status) =>
      status.status === 'error'
        ? `AssemblyAI transcription failed: ${status.error ?? 'unknown error'}`
        : undefined,
    onProgress: async () => {
        await persistProgressMetadata({
          ...(runtime ?? {
            mode: 'fresh',
            stage: 'polling',
            remoteJobId: activeTranscriptId
          }),
          mode: (runtime?.mode ?? 'fresh'),
          stage: 'polling',
          remoteJobId: activeTranscriptId,
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
      remoteJobId: activeTranscriptId
    }),
    mode: runtime?.mode ?? 'fresh',
    stage: 'completed',
    remoteJobId: activeTranscriptId,
    ...(uploadUrl ? { remoteAssetUrl: uploadUrl } : {}),
    ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
    ...(runtime?.lastPollAt ? { lastPollAt: runtime.lastPollAt } : {}),
    completedAt: new Date().toISOString()
  }

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
  const evidenceWords = transcript.words?.map((word) => ({
    startSeconds: (word.start / 1000) + offsetSeconds,
    endSeconds: (word.end / 1000) + offsetSeconds,
    text: word.text,
    normalized: word.text.toLowerCase(),
    ...(formatSpeaker(word.speaker) ? { speaker: formatSpeaker(word.speaker) } : {}),
    confidence: word.confidence,
    timingSource: 'native' as const
  })) ?? []

  const { finalSegments, finalText } = resolveTranscriptionOutput(segments, text, offsetSeconds)

  const formattedTranscriptPath = `${outputBase}.txt`
  await Bun.write(formattedTranscriptPath, formatTranscriptText(finalSegments))

  const processingTime = Date.now() - startTime
  const remoteProcessingMs = Math.max(0, processingTime - uploadMs - createMs - pollMs)
  const metadata: Step2Metadata = {
    transcriptionService: 'assemblyai',
    transcriptionModel: modelName,
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
    logSttSegmentLifecycle(l, { provider: 'assemblyai', action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
  }

  return {
    result: {
      text: finalText,
      segments: finalSegments,
      evidence: {
        ...(evidenceWords.length > 0 ? {
          words: evidenceWords
        } : {}),
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
