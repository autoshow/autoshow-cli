import type {
  AsyncSttLifecycleHooks,
  HappyScribeExport,
  HappyScribeOrder,
  HappyScribeTranscription,
  RetryClass,
  Step2Metadata,
  Step2RuntimeMetadata,
  TranscriptionResult
} from '~/types'
import * as l from '~/utils/logger'
import { logSttAsyncJobLifecycle, logSttSegmentLifecycle } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-logging'
import {
  buildTranscriptionOutputBase,
  countTokens,
  formatTranscriptText
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-utils/stt-utils'
import {
  pollAsyncSttJobUntilComplete,
  readPersistedAsyncSttRuntime,
  writeAsyncSttProgressMetadata
} from '~/cli/commands/process-steps/step-2-extract/step-2-stt/async-lifecycle'
import {
  buildHappyScribeOrganizationResolutionError,
  getHappyScribeApiKey,
  getHappyScribeBaseUrl,
  resolveHappyScribeOrganizationSelection
} from './happyscribe'
import { createHappyScribeApiClient } from './happyscribe-api'
import { buildHappyScribeRegistryEstimate } from './happyscribe-pricing'
import {
  buildHappyScribeOrderFailureMessage,
  resolveHappyScribeOrderTranscriptionId
} from './happyscribe-response-parsers'
import {
  attachHappyScribeErrorContext,
  getHappyScribeErrorStatus
} from './happyscribe-utils'
import { parseHappyScribeTranscriptPayload } from './parse-happyscribe-transcript'

const INITIAL_POLL_INTERVAL_MS = 1_000
const MAX_POLL_INTERVAL_MS = 10_000

const buildPollingDeadlineError = (
  orderId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`Happy Scribe timed out waiting for transcription completion for ${orderId} (deadline exceeded after ${pollDeadlineMs}ms)`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const buildExportDeadlineError = (
  exportId: string,
  pollDeadlineMs: number
): never => {
  const error = Object.assign(
    new Error(`Happy Scribe timed out waiting for export completion for ${exportId} (deadline exceeded after ${pollDeadlineMs}ms)`),
    {
      stage: 'result',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const buildResumeProbeError = (
  orderId: string,
  probeCount: number,
  totalWaitMs: number
): never => {
  const error = Object.assign(
    new Error(`Happy Scribe order ${orderId} is still pending after ${probeCount} resume status checks (${totalWaitMs}ms total backoff). Retry the command later.`),
    {
      stage: 'poll',
      retryClass: 'runtime_http_read' as RetryClass,
      retryable: true
    }
  )
  throw error
}

const buildBillingMetadata = (
  modelName: string,
  audioDurationSeconds: number | undefined,
  order: HappyScribeOrder,
  transcription: HappyScribeTranscription
): Step2Metadata['billing'] | undefined => {
  const totalCost = order.details?.currency === 'usd'
    ? order.details.totalCents ?? transcription.costInCents
    : undefined
  const creditsUsed = order.details?.currency === 'usd'
    ? order.details.totalCredits
    : undefined

  if (typeof totalCost === 'number' && Number.isFinite(totalCost) && totalCost >= 0) {
    const billing: NonNullable<Step2Metadata['billing']> = {
      totalCost,
      source: 'provider_quote',
      mode: 'order'
    }
    if (typeof creditsUsed === 'number' && Number.isFinite(creditsUsed) && creditsUsed >= 0) {
      billing.creditsUsed = creditsUsed
      if (creditsUsed > 0) {
        billing.creditRateCents = totalCost / creditsUsed
      }
    }
    return billing
  }

  if (typeof audioDurationSeconds === 'number' && Number.isFinite(audioDurationSeconds) && audioDurationSeconds >= 0) {
    return {
      totalCost: buildHappyScribeRegistryEstimate(modelName, audioDurationSeconds),
      source: 'registry_fallback',
      mode: 'duration'
    }
  }

  return undefined
}

export const runHappyScribeStt = async (
  audioPath: string,
  outputDir: string,
  options: {
    model: string
    happyscribeOrganizationId?: string | undefined
    segmentOffsetMinutes: number
    segmentNumber?: number | undefined
    totalSegments?: number | undefined
    audioDurationSeconds?: number | undefined
    runMode?: 'initial' | 'backfill' | undefined
    lifecycle?: AsyncSttLifecycleHooks | undefined
  }
): Promise<{ result: TranscriptionResult, metadata: Step2Metadata }> => {
  const {
    model: modelName,
    happyscribeOrganizationId,
    segmentOffsetMinutes = 0,
    segmentNumber,
    totalSegments,
    audioDurationSeconds,
    runMode,
    lifecycle
  } = options
  const apiKey = getHappyScribeApiKey()
  if (!apiKey) {
    throw new Error('HAPPYSCRIBE_API_KEY environment variable is required for Happy Scribe transcription')
  }

  const baseURL = getHappyScribeBaseUrl()
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
  let billing: Step2Metadata['billing'] | undefined

  const apiClient = createHappyScribeApiClient({
    apiKey,
    baseURL,
    onRequest: () => {
      requestCount += 1
    },
    onRetry: (error) => {
      retryCount += 1
      if (getHappyScribeErrorStatus(error) === 429) {
        rateLimitCount += 1
      }
    }
  })

  if (segmentNumber && totalSegments) {
    logSttSegmentLifecycle(l, { provider: 'happyscribe', action: 'started', segmentNumber, totalSegments, model: modelName })
  }

  const organizationSelection = await resolveHappyScribeOrganizationSelection({
    preferredOrganizationId: happyscribeOrganizationId
  })
  if (!organizationSelection.selected) {
    throw buildHappyScribeOrganizationResolutionError(organizationSelection)
  }
  if (organizationSelection.selected.currency && organizationSelection.selected.currency !== 'usd') {
    throw new Error([
      `Happy Scribe organization ${organizationSelection.selected.id}${organizationSelection.selected.name ? ` (${organizationSelection.selected.name})` : ''} reports currency ${organizationSelection.selected.currency}, but v1 execution supports exact-cost capture only for usd organizations.`,
      `Organizations: ${organizationSelection.organizations.length > 0 ? organizationSelection.organizations.map((organization) => `${organization.id}${organization.name ? ` "${organization.name}"` : ''}${organization.currency ? ` currency=${organization.currency}` : ''}`).join(', ') : 'none'}.`,
      'Pass --stt-happyscribe-organization-id <id> or save defaults.extract.stt.happyscribeOrganizationId with bun as config.'
    ].join(' '))
  }

  let runtime = await readPersistedAsyncSttRuntime(outputDir, {
    transcriptionService: 'happyscribe',
    transcriptionModel: modelName
  })
  let orderId = runtime?.remoteJobId
  let uploadUrl = runtime?.remoteAssetUrl
  let resumedExistingOrder = false
  let jobReadyNotified = false

  const buildProgressMetadata = (nextRuntime: Step2RuntimeMetadata): Step2Metadata => ({
    transcriptionService: 'happyscribe',
    transcriptionModel: modelName,
    processingTime: Date.now() - startTime,
    tokenCount: 0,
    ...(billing ? { billing } : {}),
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

  if (runtime && (runtime.stage === 'created' || runtime.stage === 'polling')) {
    resumedExistingOrder = true
    runtime = {
      ...runtime,
      mode: 'resumed',
      stage: 'polling'
    }
    orderId = runtime.remoteJobId
    uploadUrl = runtime.remoteAssetUrl
    await persistProgressMetadata(runtime)
    await notifyJobReady(runtime)
  } else {
    try {
      const uploadStartedAt = Date.now()
      uploadUrl = await apiClient.getSignedUploadUrl(audioPath)
      await apiClient.uploadMedia(uploadUrl, audioPath)
      uploadMs += Date.now() - uploadStartedAt
    } catch (error) {
      attachHappyScribeErrorContext(error, 'upload', 'runtime_http_create_conservative')
    }

    if (!uploadUrl) {
      throw new Error('Happy Scribe signed upload response missing signedUrl')
    }

    let createdOrder: HappyScribeOrder | undefined
    try {
      const createStartedAt = Date.now()
      createdOrder = await apiClient.createOrder({
        audioPath,
        uploadUrl,
        organizationId: organizationSelection.selected.id
      })
      createMs += Date.now() - createStartedAt
      createCount += 1
    } catch (error) {
      attachHappyScribeErrorContext(error, 'create', 'runtime_http_create_conservative')
    }

    if (!createdOrder) {
      throw new Error('Happy Scribe order creation did not return an order id')
    }
    orderId = createdOrder.id

    const createdRuntime: Step2RuntimeMetadata = {
      mode: 'fresh',
      stage: 'polling',
      remoteJobId: orderId,
      remoteAssetUrl: uploadUrl,
      createCompletedAt: new Date().toISOString()
    }
    await persistProgressMetadata(createdRuntime)
    await notifyJobReady(createdRuntime)
  }

  if (!orderId) {
    throw new Error('Happy Scribe order creation did not return an order id')
  }
  const activeOrderId = orderId

  logSttAsyncJobLifecycle(l, {
    provider: `happyscribe/${modelName}`,
    action: resumedExistingOrder ? 'resumed' : 'created',
    remoteId: activeOrderId,
    state: 'polling'
  })

  const orderPollResult = await pollAsyncSttJobUntilComplete({
    jobId: activeOrderId,
    initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
    maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
    audioDurationSeconds,
    pollMode: resumedExistingOrder ? 'resume-probe' : 'fresh',
    buildDeadlineError: (jobId, pollDeadlineMs) => buildPollingDeadlineError(jobId, pollDeadlineMs),
    buildResumeProbeError: (jobId, probeCount, totalWaitMs) => buildResumeProbeError(jobId, probeCount, totalWaitMs),
    poll: async () => {
      const pollStartedAt = Date.now()
      const result = await apiClient.pollOrder(activeOrderId)
      pollMs += Date.now() - pollStartedAt
      return result
    },
    isComplete: (order) => order.state === 'fulfilled',
    isFailed: (order) =>
      order.state === 'failed' || order.state === 'locked'
        ? buildHappyScribeOrderFailureMessage(order)
        : undefined,
    onProgress: async () => {
      await persistProgressMetadata({
        ...(runtime ?? {
          mode: 'fresh',
          stage: 'polling',
          remoteJobId: activeOrderId
        }),
        mode: runtime?.mode ?? 'fresh',
        stage: 'polling',
        remoteJobId: activeOrderId,
        ...(uploadUrl ? { remoteAssetUrl: uploadUrl } : {}),
        ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
        lastPollAt: new Date().toISOString()
      })
    },
    withPollSlot: lifecycle?.withPollSlot
  })

  pollSleepMs += orderPollResult.pollSleepMs
  pollCount += orderPollResult.pollCount
  const completedOrder = orderPollResult.status

  const transcriptionId = resolveHappyScribeOrderTranscriptionId(completedOrder)
  if (!transcriptionId) {
    throw new Error('Happy Scribe order completed without a transcription identifier')
  }

  let transcription: HappyScribeTranscription | undefined
  try {
    const transcriptStartedAt = Date.now()
    transcription = await apiClient.getTranscription(transcriptionId)
    transcriptMs += Date.now() - transcriptStartedAt
  } catch (error) {
    attachHappyScribeErrorContext(error, 'result', 'runtime_http_read')
  }
  if (!transcription) {
    throw new Error('Happy Scribe transcription lookup did not return transcription metadata')
  }

  const completedRuntime: Step2RuntimeMetadata = {
    ...(runtime ?? {
      mode: 'fresh',
      stage: 'completed',
      remoteJobId: activeOrderId
    }),
    mode: runtime?.mode ?? 'fresh',
    stage: 'completed',
    remoteJobId: activeOrderId,
    ...(uploadUrl ? { remoteAssetUrl: uploadUrl } : {}),
    ...(runtime?.createCompletedAt ? { createCompletedAt: runtime.createCompletedAt } : {}),
    ...(runtime?.lastPollAt ? { lastPollAt: runtime.lastPollAt } : {}),
    completedAt: new Date().toISOString()
  }
  billing = buildBillingMetadata(modelName, audioDurationSeconds, completedOrder, transcription)
  await persistProgressMetadata(completedRuntime)

  let result: TranscriptionResult | undefined
  const tryDirectDownload = async (): Promise<TranscriptionResult | undefined> => {
    if (!transcription.downloadUrl) {
      return undefined
    }

    try {
      const structuredPayload = await apiClient.fetchDownloadPayload(transcription.downloadUrl)
      return parseHappyScribeTranscriptPayload(structuredPayload, { offsetSeconds })
    } catch {
      return undefined
    }
  }

  result = await tryDirectDownload()

  if (!result) {
    let exportRecord: HappyScribeExport | undefined
    try {
      const transcriptStartedAt = Date.now()
      exportRecord = await apiClient.createExport(transcription.id ?? transcriptionId)
      const activeExportId = exportRecord.id
      createCount += 1

      const exportPollResult = await pollAsyncSttJobUntilComplete({
        jobId: activeExportId,
        initialPollIntervalMs: INITIAL_POLL_INTERVAL_MS,
        maxPollIntervalMs: MAX_POLL_INTERVAL_MS,
        audioDurationSeconds,
        buildDeadlineError: (jobId, pollDeadlineMs) => buildExportDeadlineError(jobId, pollDeadlineMs),
        poll: async () => apiClient.pollExport(activeExportId),
        isComplete: (exportStatus) => exportStatus.state === 'ready',
        isFailed: (exportStatus) =>
          exportStatus.state === 'failed' || exportStatus.state === 'expired'
            ? `Happy Scribe export ${exportStatus.id} failed in state "${exportStatus.state}"`
            : undefined,
        withPollSlot: lifecycle?.withPollSlot
      })

      pollSleepMs += exportPollResult.pollSleepMs
      pollCount += exportPollResult.pollCount
      exportRecord = exportPollResult.status
      if (!exportRecord.downloadLink) {
        throw new Error('Happy Scribe export completed without download_link')
      }

      const structuredPayload = await apiClient.fetchDownloadPayload(exportRecord.downloadLink)
      result = parseHappyScribeTranscriptPayload(structuredPayload, { offsetSeconds })
      transcriptMs += Date.now() - transcriptStartedAt
    } catch (error) {
      attachHappyScribeErrorContext(error, 'result', 'runtime_http_read')
    }
  }

  if (!result) {
    throw new Error('Happy Scribe transcript retrieval did not produce a transcript')
  }

  const formattedTranscriptPath = `${outputBase}.txt`
  await Bun.write(formattedTranscriptPath, formatTranscriptText(result.segments))

  const processingTime = Date.now() - startTime
  const remoteProcessingMs = Math.max(0, processingTime - uploadMs - createMs - pollMs - transcriptMs)
  const metadata: Step2Metadata = {
    transcriptionService: 'happyscribe',
    transcriptionModel: modelName,
    processingTime,
    tokenCount: countTokens(result.text),
    runtime: completedRuntime,
    ...(billing ? { billing } : {}),
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
    logSttSegmentLifecycle(l, { provider: 'happyscribe', action: 'completed', segmentNumber, totalSegments, model: modelName, processingTimeMs: processingTime })
  }

  return {
    result,
    metadata
  }
}
