import type {
  DiarizationOptions,
  GcloudHttpError,
  RetryClass,
  Step2Metadata,
  TranscriptionResult
} from '~/types'
import * as l from '~/logger'
import { logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-stt/stt-logging'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/stt-utils'
import { withRetry, classifyFetchRetry } from '~/utils/retries'
import { resolveGcloudSpeechContext } from './gcloud'
import { parseGcloudSttResponse } from './parse-gcloud-stt-response'

const REQUEST_TIMEOUT_MS = 20 * 60 * 1000

const getErrorStatus = (error: unknown): number | undefined =>
  error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined

const attachGcloudErrorContext = (
  error: unknown,
  stage: 'transcribe',
  retryClass: RetryClass
): never => {
  const source = error instanceof Error ? error : new Error(String(error))
  ;(source as GcloudHttpError).stage = stage
  ;(source as GcloudHttpError).retryClass = retryClass
  throw source
}

const encodeAudioContent = async (
  audioPath: string
): Promise<string> => {
  const bytes = await Bun.file(audioPath).bytes()
  return Buffer.from(bytes).toString('base64')
}

const buildDiarizationConfig = (
  diarizationOptions: DiarizationOptions | undefined
): { minSpeakerCount?: number, maxSpeakerCount?: number } => {
  const speakerCount = diarizationOptions?.speakerCount
  if (typeof speakerCount === 'number' && Number.isFinite(speakerCount) && speakerCount >= 1) {
    const normalizedCount = Math.floor(speakerCount)
    return {
      minSpeakerCount: normalizedCount,
      maxSpeakerCount: normalizedCount
    }
  }

  return {}
}

export const buildGcloudRecognizeRequest = (
  content: string,
  options: {
    model: string
    diarizationOptions?: DiarizationOptions | undefined
  }
): Record<string, unknown> => ({
  config: {
    autoDecodingConfig: {},
    languageCodes: ['auto'],
    model: options.model,
    features: {
      enableAutomaticPunctuation: true,
      enableWordTimeOffsets: true,
      diarizationConfig: buildDiarizationConfig(options.diarizationOptions)
    }
  },
  content
})

export const buildGcloudSpeechEndpoint = (
  location: string
): string =>
  location === 'global'
    ? 'https://speech.googleapis.com'
    : `https://${location}-speech.googleapis.com`

export const buildGcloudRecognizeUrl = (
  projectId: string,
  location: string
): string =>
  `${buildGcloudSpeechEndpoint(location)}/v2/projects/${projectId}/locations/${location}/recognizers/_:recognize`

export const runGcloudStt = async (
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
  const {
    model: modelName,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    diarizationOptions
  } = options

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'gcloud', action: 'started', segmentNumber, totalSegments, model: modelName })
  }
  if (diarizationOptions?.speakerCount !== undefined) {
    l.write('info', `Google Cloud diarization speaker-count hint: ${diarizationOptions.speakerCount}`)
  }

  const startTime = Date.now()
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const offsetSeconds = segmentOffsetMinutes * 60
  const speechContext = await resolveGcloudSpeechContext()
  const requestBody = buildGcloudRecognizeRequest(await encodeAudioContent(audioPath), {
    model: modelName,
    diarizationOptions
  })

  let transcribeMs = 0
  let requestCount = 0
  let retryCount = 0
  let rateLimitCount = 0

  let rawPayload: unknown
  try {
    const transcribeStartedAt = Date.now()
    rawPayload = await withRetry(
      {
        retryClass: 'runtime_http_create_conservative',
        operationName: 'gcloud-stt',
        policy: { maxAttempts: 4 },
        timeoutMs: REQUEST_TIMEOUT_MS
      },
      async (signal) => {
        requestCount += 1
        const response = await fetch(
          buildGcloudRecognizeUrl(speechContext.projectId, speechContext.location),
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${speechContext.accessToken}`,
              'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify(requestBody),
            signal: signal ?? null
          }
        )

        if (!response.ok) {
          const errorText = await response.text()
          throw Object.assign(
            new Error(`Google Cloud transcription failed (${response.status}): ${errorText}`),
            {
              status: response.status,
              headers: response.headers,
              stage: 'transcribe',
              retryClass: 'runtime_http_create_conservative',
              rawResponse: errorText
            } satisfies Pick<GcloudHttpError, 'status' | 'headers' | 'stage' | 'retryClass' | 'rawResponse'>
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
    transcribeMs += Date.now() - transcribeStartedAt
  } catch (error) {
    attachGcloudErrorContext(error, 'transcribe', 'runtime_http_create_conservative')
  }

  const result = parseGcloudSttResponse(rawPayload, { offsetSeconds })
  await Bun.write(`${outputBase}.txt`, formatTranscriptText(result.segments))

  const processingTime = Date.now() - startTime
  const remoteProcessingMs = Math.max(0, processingTime - transcribeMs)
  const metadata: Step2Metadata = {
    transcriptionService: 'gcloud',
    transcriptionModel: modelName,
    processingTime,
    tokenCount: countTokens(result.text),
    ...((transcribeMs > 0 || requestCount > 0 || retryCount > 0 || rateLimitCount > 0 || remoteProcessingMs > 0)
      ? {
          timings: {
            ...(transcribeMs > 0 ? { transcribeMs } : {}),
            ...(remoteProcessingMs > 0 ? { remoteProcessingMs } : {}),
            ...(requestCount > 0 ? { requestCount } : {}),
            ...(retryCount > 0 ? { retryCount } : {}),
            ...(rateLimitCount > 0 ? { rateLimitCount } : {})
          }
        }
      : {})
  }

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'gcloud', action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
  }

  return { result, metadata }
}
