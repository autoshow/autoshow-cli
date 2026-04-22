import { basename, extname } from 'node:path'
import { rm } from 'node:fs/promises'
import * as v from 'valibot'
import type {
  AsyncSttLifecycleHooks,
  AwsCliError,
  DiarizationOptions,
  Step2Metadata,
  Step2RuntimeMetadata,
  TranscriptionResult
} from '~/types'
import * as l from '~/logger'
import { logSttAsyncJobLifecycle } from '~/cli/commands/process-steps/step-2-stt/stt-logging'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText
} from '~/cli/commands/process-steps/step-2-stt/stt-utils/stt-utils'
import {
  pollAsyncSttJobUntilComplete,
  readPersistedAsyncSttRuntime,
  writeAsyncSttProgressMetadata
} from '~/cli/commands/process-steps/step-2-stt/async-lifecycle'
import { exec } from '~/utils/cli-utils'
import { validateData } from '~/utils/validate/validation'
import {
  ensureAwsSttSetup,
  resolveAwsMaxSpeakerLabels
} from './aws'
import { parseAwsTranscribeOutput } from './parse-aws-transcribe-output'

const INITIAL_POLL_INTERVAL_MS = 2000
const MAX_POLL_INTERVAL_MS = 10000
const AWS_STT_COMMAND_ENV = {
  AWS_PAGER: '',
  PAGER: ''
} as const

const AwsTranscriptionStatusSchema = v.object({
  TranscriptionJob: v.object({
    TranscriptionJobName: v.string(),
    TranscriptionJobStatus: v.picklist(['QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED']),
    FailureReason: v.optional(v.string(), undefined),
    Transcript: v.optional(v.object({
      TranscriptFileUri: v.optional(v.string(), undefined)
    }), undefined)
  })
})

type AwsTranscriptionStatus = v.InferOutput<typeof AwsTranscriptionStatusSchema>
type AwsCliStage = NonNullable<AwsCliError['stage']>

const readAwsCommandText = (stdout: string, stderr: string): string => {
  const stdoutText = stdout.trim()
  if (stdoutText.length > 0) {
    return stdoutText
  }

  const stderrText = stderr.trim()
  return stderrText.length > 0 ? stderrText : 'command failed'
}

const buildAwsCliError = (
  stage: AwsCliStage,
  message: string,
  rawResponse?: unknown,
  retryable = false
): AwsCliError => Object.assign(
  new Error(message),
  {
    stage,
    retryable,
    ...(rawResponse !== undefined ? { rawResponse } : {})
  }
)

const normalizeJobNamePart = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

const buildAwsJobName = (
  audioPath: string,
  segmentNumber?: number | undefined
): string => {
  const base = normalizeJobNamePart(basename(audioPath, extname(audioPath))) || 'audio'
  const segment = segmentNumber ? `-seg-${String(segmentNumber).padStart(3, '0')}` : ''
  return `autoshow-${Date.now()}-${base.slice(0, 24)}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}${segment}`.slice(0, 200)
}

const inferAwsMediaFormat = (audioPath: string): string | undefined => {
  const extension = extname(audioPath).toLowerCase().replace(/^\./, '')
  const supported = new Set(['mp3', 'mp4', 'wav', 'flac', 'ogg', 'amr', 'webm', 'm4a'])
  return supported.has(extension) ? extension : undefined
}

const buildPollingDeadlineError = (
  jobId: string,
  pollDeadlineMs: number
): never => {
  throw buildAwsCliError(
    'poll',
    `AWS Transcribe timed out waiting for transcription completion for ${jobId} (deadline exceeded after ${pollDeadlineMs}ms)`,
    undefined,
    true
  )
}

const buildResumeProbeError = (
  jobId: string,
  probeCount: number,
  totalWaitMs: number
): never => {
  throw buildAwsCliError(
    'poll',
    `AWS Transcribe job ${jobId} is still pending after ${probeCount} resume status checks (${totalWaitMs}ms total backoff). Retry the command later.`,
    undefined,
    true
  )
}

const buildFailedJobMessage = (
  status: AwsTranscriptionStatus
): string => {
  const failureReason = status.TranscriptionJob.FailureReason?.trim()
  if (failureReason && failureReason.length > 0) {
    return `AWS Transcribe failed: ${failureReason}`
  }

  return 'AWS Transcribe failed: job entered failed state'
}

export const runAwsStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    region?: string | undefined
    bucket?: string | undefined
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
    region: preferredRegion,
    bucket: preferredBucket,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    diarizationOptions,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options

  const resolved = await ensureAwsSttSetup({
    preferredRegion,
    preferredBucket
  })

  if (segmentNumber && totalSegments) {
    l.info(`Transcribing segment ${segmentNumber}/${totalSegments} with AWS Transcribe model: ${modelName}`)
  }

  const maxSpeakerLabels = resolveAwsMaxSpeakerLabels(diarizationOptions?.speakerCount)
  l.info(`AWS diarization enabled with max speakers: ${maxSpeakerLabels}`)

  const offsetSeconds = segmentOffsetMinutes * 60
  const outputBase = buildTranscriptionOutputBase(outputDir, segmentNumber)
  const startTime = Date.now()
  let uploadMs = 0
  let createMs = 0
  let pollMs = 0
  let pollSleepMs = 0
  let transcriptMs = 0
  let createCount = 0
  let pollCount = 0
  let requestCount = 0
  let retryCount = 0
  let rateLimitCount = 0
  const backfillCount = runMode === 'backfill' ? 1 : 0

  let runtime = await readPersistedAsyncSttRuntime(outputDir, {
    transcriptionService: 'aws',
    transcriptionModel: modelName
  })
  let jobName = runtime?.remoteJobId
  let remotePrefix = runtime?.remoteAssetId
  let inputUri = runtime?.remoteAssetUrl
  let resumedExistingJob = false
  let jobReadyNotified = false
  let lastKnownJobStatus: AwsTranscriptionStatus | undefined
  let metadata: Step2Metadata | undefined

  const buildProgressMetadata = (nextRuntime: Step2RuntimeMetadata): Step2Metadata => ({
    transcriptionService: 'aws',
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
      ...(transcriptMs > 0 ? { transcriptMs } : {}),
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

  const runAwsCommand = async (
    stage: AwsCliStage,
    args: string[]
  ): Promise<{ stdout: string, stderr: string, exitCode: number }> => {
    requestCount += 1
    const result = await exec('aws', [...args, '--region', resolved.region], {
      env: AWS_STT_COMMAND_ENV
    })
    if (result.exitCode !== 0) {
      throw buildAwsCliError(
        stage,
        `AWS ${stage} failed: ${readAwsCommandText(result.stdout, result.stderr)}`,
        {
          command: ['aws', ...args, '--region', resolved.region],
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode
        }
      )
    }
    return result
  }

  const runAwsJson = async <T>(
    stage: AwsCliStage,
    args: string[],
    schema: v.BaseSchema<unknown, T, v.BaseIssue<unknown>>
  ): Promise<T> => {
    const result = await runAwsCommand(stage, [...args, '--output', 'json'])
    let payload: unknown
    try {
      payload = JSON.parse(result.stdout)
    } catch (error) {
      throw buildAwsCliError(
        stage,
        `AWS ${stage} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        { stdout: result.stdout, stderr: result.stderr }
      )
    }

    try {
      return validateData(schema, payload, `AWS ${stage} response`)
    } catch (error) {
      throw buildAwsCliError(
        stage,
        error instanceof Error ? error.message : String(error),
        payload
      )
    }
  }

  const deleteRemoteJob = async (
    transcriptionJobName: string
  ): Promise<boolean> => {
    try {
      await runAwsCommand('cleanup', [
        'transcribe',
        'delete-transcription-job',
        '--transcription-job-name',
        transcriptionJobName
      ])
      return true
    } catch (error) {
      l.warn(`AWS cleanup failed for job ${transcriptionJobName}: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  const deleteRemoteAssets = async (
    prefix: string
  ): Promise<boolean> => {
    try {
      await runAwsCommand('cleanup', [
        's3',
        'rm',
        `s3://${resolved.bucket}/${prefix}`,
        '--recursive',
        '--only-show-errors'
      ])
      return true
    } catch (error) {
      l.warn(`AWS cleanup failed for s3://${resolved.bucket}/${prefix}: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  try {
    if (runtime && (runtime.stage === 'created' || runtime.stage === 'polling')) {
      resumedExistingJob = true
      runtime = {
        ...runtime,
        mode: 'resumed',
        stage: 'polling'
      }
      jobName = runtime.remoteJobId
      remotePrefix = runtime.remoteAssetId
      inputUri = runtime.remoteAssetUrl
      await persistProgressMetadata(runtime)
      await notifyJobReady(runtime)
    } else {
      jobName = buildAwsJobName(audioPath, segmentNumber)
      remotePrefix = `autoshow/transcribe/${jobName}`
      const inputKey = `${remotePrefix}/input/${basename(audioPath)}`
      const outputKeyPrefix = `${remotePrefix}/output/`
      inputUri = `s3://${resolved.bucket}/${inputKey}`

      const uploadStartedAt = Date.now()
      await runAwsCommand('upload', [
        's3',
        'cp',
        audioPath,
        inputUri,
        '--only-show-errors'
      ])
      uploadMs += Date.now() - uploadStartedAt

      const createArgs = [
        'transcribe',
        'start-transcription-job',
        '--transcription-job-name',
        jobName,
        '--media',
        `MediaFileUri=${inputUri}`,
        '--output-bucket-name',
        resolved.bucket,
        '--output-key',
        outputKeyPrefix,
        '--settings',
        `ShowSpeakerLabels=true,MaxSpeakerLabels=${String(maxSpeakerLabels)}`,
        '--identify-language'
      ]
      const mediaFormat = inferAwsMediaFormat(audioPath)
      if (mediaFormat) {
        createArgs.push('--media-format', mediaFormat)
      }

      const createStartedAt = Date.now()
      lastKnownJobStatus = await runAwsJson('create', createArgs, AwsTranscriptionStatusSchema)
      createMs += Date.now() - createStartedAt
      createCount += 1

      const createdRuntime: Step2RuntimeMetadata = {
        mode: 'fresh',
        stage: 'polling',
        remoteJobId: jobName,
        remoteAssetId: remotePrefix,
        remoteAssetUrl: inputUri,
        createCompletedAt: new Date().toISOString()
      }
      await persistProgressMetadata(createdRuntime)
      await notifyJobReady(createdRuntime)
    }

    if (!remotePrefix && jobName) {
      remotePrefix = `autoshow/transcribe/${jobName}`
    }

    if (!jobName || !remotePrefix) {
      throw new Error('AWS transcription creation did not produce a job id')
    }

    const activeJobName = jobName
    logSttAsyncJobLifecycle(l, {
      provider: `aws/${modelName}`,
      action: resumedExistingJob ? 'resumed' : 'created',
      remoteId: activeJobName,
      state: 'polling'
    })

    const pollResult = await pollAsyncSttJobUntilComplete({
      jobId: activeJobName,
      initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
      maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
      audioDurationSeconds,
      envSpecificDeadlineKey: 'AUTOSHOW_STT_POLL_DEADLINE_MS_AWS',
      pollMode: resumedExistingJob ? 'resume-probe' : 'fresh',
      buildDeadlineError: (nextJobId, pollDeadlineMs) => buildPollingDeadlineError(nextJobId, pollDeadlineMs),
      buildResumeProbeError: (nextJobId, probeCount, totalWaitMs) => buildResumeProbeError(nextJobId, probeCount, totalWaitMs),
      poll: async () => {
        const pollStartedAt = Date.now()
        const status = await runAwsJson('poll', [
          'transcribe',
          'get-transcription-job',
          '--transcription-job-name',
          activeJobName
        ], AwsTranscriptionStatusSchema)
        pollMs += Date.now() - pollStartedAt
        return {
          status,
          retryAfterMs: null
        }
      },
      isComplete: (status) => status.TranscriptionJob.TranscriptionJobStatus === 'COMPLETED',
      isFailed: (status) => status.TranscriptionJob.TranscriptionJobStatus === 'FAILED' ? buildFailedJobMessage(status) : undefined,
      onProgress: async (status) => {
        lastKnownJobStatus = status
        await persistProgressMetadata({
          ...(runtime ?? {
            mode: 'fresh',
            stage: 'polling',
            remoteJobId: activeJobName
          }),
          mode: runtime?.mode ?? 'fresh',
          stage: 'polling',
          remoteJobId: activeJobName,
          ...(remotePrefix ? { remoteAssetId: remotePrefix } : {}),
          ...(inputUri ? { remoteAssetUrl: inputUri } : {}),
          ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
          lastPollAt: new Date().toISOString()
        })
      },
      withPollSlot: lifecycle?.withPollSlot
    })

    pollSleepMs += pollResult.pollSleepMs
    pollCount += pollResult.pollCount
    lastKnownJobStatus = pollResult.status

    const completedRuntime: Step2RuntimeMetadata = {
      ...(runtime ?? {
        mode: 'fresh',
        stage: 'completed',
        remoteJobId: activeJobName
      }),
      mode: runtime?.mode ?? 'fresh',
      stage: 'completed',
      remoteJobId: activeJobName,
      ...(remotePrefix ? { remoteAssetId: remotePrefix } : {}),
      ...(inputUri ? { remoteAssetUrl: inputUri } : {}),
      ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
      ...(runtime?.lastPollAt ? { lastPollAt: runtime.lastPollAt } : {}),
      completedAt: new Date().toISOString()
    }

    const transcriptFileUri = pollResult.status.TranscriptionJob.Transcript?.TranscriptFileUri
    const transcriptS3Uri = transcriptFileUri?.startsWith('s3://')
      ? transcriptFileUri
      : `s3://${resolved.bucket}/${remotePrefix}/output/${activeJobName}.json`
    const transcriptTempPath = `${outputBase}.aws-transcribe.json`
    let transcriptPayload: unknown

    try {
      const transcriptStartedAt = Date.now()
      await runAwsCommand('transcript', [
        's3',
        'cp',
        transcriptS3Uri,
        transcriptTempPath,
        '--only-show-errors'
      ])
      const rawTranscript = await Bun.file(transcriptTempPath).text()
      transcriptPayload = JSON.parse(rawTranscript)
      transcriptMs += Date.now() - transcriptStartedAt
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw buildAwsCliError('transcript', `AWS transcript download returned invalid JSON: ${error.message}`, {
          transcriptFileUri: transcriptS3Uri
        })
      }
      if (error instanceof Error && 'stage' in error) {
        throw error
      }
      throw buildAwsCliError('transcript', error instanceof Error ? error.message : String(error), {
        transcriptFileUri: transcriptS3Uri
      })
    } finally {
      await rm(transcriptTempPath, { force: true }).catch(() => undefined)
    }

    let result: TranscriptionResult
    try {
      result = parseAwsTranscribeOutput(transcriptPayload, { offsetSeconds })
    } catch (error) {
      throw buildAwsCliError(
        'transcript',
        error instanceof Error ? error.message : String(error),
        transcriptPayload
      )
    }

    await Bun.write(`${outputBase}.txt`, formatTranscriptText(result.segments))

    const processingTime = Date.now() - startTime
    const remoteProcessingMs = Math.max(0, processingTime - uploadMs - createMs - pollMs - transcriptMs)
    metadata = {
      transcriptionService: 'aws',
      transcriptionModel: modelName,
      processingTime,
      tokenCount: countTokens(result.text),
      runtime: completedRuntime,
      ...((uploadMs > 0 || createMs > 0 || pollMs > 0 || pollSleepMs > 0 || transcriptMs > 0 || remoteProcessingMs > 0 || requestCount > 0 || retryCount > 0 || rateLimitCount > 0)
        ? {
            timings: {
              ...(uploadMs > 0 ? { uploadMs } : {}),
              ...(createMs > 0 ? { createMs } : {}),
              ...(createCount > 0 ? { createCount } : {}),
              ...(pollMs > 0 ? { pollMs } : {}),
              ...(pollSleepMs > 0 ? { pollSleepMs } : {}),
              ...(pollCount > 0 ? { pollCount } : {}),
              ...(transcriptMs > 0 ? { transcriptMs } : {}),
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

    return { result, metadata }
  } finally {
    const cleanupStartedAt = Date.now()
    const shouldDeleteRemoteJob = !!jobName && (metadata !== undefined || lastKnownJobStatus?.TranscriptionJob.TranscriptionJobStatus === 'FAILED')
    const shouldDeleteRemoteAssets = !!remotePrefix && (metadata !== undefined || lastKnownJobStatus?.TranscriptionJob.TranscriptionJobStatus === 'FAILED')
    const remoteJobDeleted = shouldDeleteRemoteJob && jobName ? await deleteRemoteJob(jobName) : false
    const remoteAssetDeleted = shouldDeleteRemoteAssets && remotePrefix ? await deleteRemoteAssets(remotePrefix) : false
    const cleanupMs = Date.now() - cleanupStartedAt

    if (metadata) {
      const processingTime = metadata.processingTime
      metadata.timings = {
        ...(metadata.timings ?? {}),
        ...(cleanupMs > 0 ? { cleanupMs } : {}),
        remoteProcessingMs: Math.max(0, processingTime
          - ((metadata.timings?.uploadMs ?? 0)
          + (metadata.timings?.createMs ?? 0)
          + (metadata.timings?.pollMs ?? 0)
          + (metadata.timings?.transcriptMs ?? 0)
          + cleanupMs))
      }
      metadata.runtime = {
        ...(metadata.runtime ?? {
          mode: runtime?.mode ?? 'fresh',
          stage: 'cleanup-complete',
          remoteJobId: jobName ?? ''
        }),
        mode: metadata.runtime?.mode ?? runtime?.mode ?? 'fresh',
        stage: 'cleanup-complete',
        remoteJobId: metadata.runtime?.remoteJobId ?? jobName ?? '',
        ...(metadata.runtime?.remoteAssetId ? { remoteAssetId: metadata.runtime.remoteAssetId } : {}),
        ...(metadata.runtime?.remoteAssetUrl ? { remoteAssetUrl: metadata.runtime.remoteAssetUrl } : {}),
        ...(metadata.runtime?.createCompletedAt ? { createCompletedAt: metadata.runtime.createCompletedAt } : {}),
        ...(metadata.runtime?.lastPollAt ? { lastPollAt: metadata.runtime.lastPollAt } : {}),
        ...(metadata.runtime?.completedAt ? { completedAt: metadata.runtime.completedAt } : {}),
        cleanupCompletedAt: new Date().toISOString(),
        cleanup: {
          ...(metadata.runtime?.cleanup ?? {}),
          ...(jobName ? { remoteJobDeleted } : {}),
          ...(remotePrefix ? { remoteAssetDeleted } : {})
        }
      }
    } else if (runtime && (jobName || remotePrefix)) {
      const cleanupRuntime: Step2RuntimeMetadata = {
        ...runtime,
        stage: (shouldDeleteRemoteJob || shouldDeleteRemoteAssets) ? 'cleanup-complete' : runtime.stage,
        remoteJobId: jobName ?? runtime.remoteJobId,
        ...(remotePrefix ? { remoteAssetId: remotePrefix } : {}),
        ...(inputUri ? { remoteAssetUrl: inputUri } : {}),
        ...((shouldDeleteRemoteJob || shouldDeleteRemoteAssets) ? { cleanupCompletedAt: new Date().toISOString() } : {}),
        cleanup: {
          ...(runtime.cleanup ?? {}),
          ...(jobName ? { remoteJobDeleted } : {}),
          ...(remotePrefix ? { remoteAssetDeleted } : {})
        }
      }
      await writeAsyncSttProgressMetadata(outputDir, buildProgressMetadata(cleanupRuntime))
    }
  }
}
