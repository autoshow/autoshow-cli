import { basename, extname } from 'node:path'
import * as v from 'valibot'
import * as l from '~/utils/logger'
import type { DocumentMetadata, PageResult } from '~/types'
import { validateData } from '~/utils/validate/validation'
import { OCR_POLL_DEADLINE_MS, readPositiveIntegerEnv } from '~/utils/timeouts'
import { classifyFetchRetry, withRetry } from '~/utils/retries'
import { AppError } from '~/utils/error-handler'
import { withOcrCreateRetry } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry'
import { logOcrJobProgress } from '../../ocr-logging'
import { getUnstructuredApiKey, resolveUnstructuredApiUrl } from './unstructured'

const DEFAULT_UNSTRUCTURED_POLL_INTERVAL_MS = 5000
const DEFAULT_UNSTRUCTURED_STALL_DEADLINE_MS = 10 * 60_000
const DEFAULT_UNSTRUCTURED_EMPTY_WORKFLOW_DEADLINE_MS = 2 * 60_000
const DEFAULT_UNSTRUCTURED_POLL_REQUEST_TIMEOUT_MS = 60_000

const resolveUnstructuredPollIntervalMs = (): number =>
  readPositiveIntegerEnv('AUTOSHOW_UNSTRUCTURED_OCR_POLL_INTERVAL_MS', DEFAULT_UNSTRUCTURED_POLL_INTERVAL_MS)

const resolveUnstructuredPollDeadlineMs = (): number =>
  readPositiveIntegerEnv('AUTOSHOW_UNSTRUCTURED_OCR_POLL_DEADLINE_MS', OCR_POLL_DEADLINE_MS)

const resolveUnstructuredStallDeadlineMs = (pollDeadlineMs: number): number =>
  Math.min(
    pollDeadlineMs,
    readPositiveIntegerEnv('AUTOSHOW_UNSTRUCTURED_OCR_STALL_DEADLINE_MS', DEFAULT_UNSTRUCTURED_STALL_DEADLINE_MS)
  )

const resolveUnstructuredEmptyWorkflowDeadlineMs = (pollDeadlineMs: number): number =>
  Math.min(
    pollDeadlineMs,
    readPositiveIntegerEnv('AUTOSHOW_UNSTRUCTURED_OCR_EMPTY_WORKFLOW_DEADLINE_MS', DEFAULT_UNSTRUCTURED_EMPTY_WORKFLOW_DEADLINE_MS)
  )

const resolveUnstructuredPollRequestTimeoutMs = (): number =>
  readPositiveIntegerEnv('AUTOSHOW_UNSTRUCTURED_OCR_POLL_REQUEST_TIMEOUT_MS', DEFAULT_UNSTRUCTURED_POLL_REQUEST_TIMEOUT_MS)

const isTimeoutError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return true
  }
  if (error instanceof Error) {
    return error.name === 'TimeoutError' || /timed out|timeout/i.test(error.message)
  }
  return false
}

const StringOrNumberSchema = v.union([v.string(), v.number()])
const OptionalStringOrNumberSchema = v.optional(StringOrNumberSchema, undefined)

const UnstructuredNodeFileSchema = v.looseObject({
  node_id: v.optional(v.string(), undefined),
  nodeId: v.optional(v.string(), undefined),
  file_id: v.optional(v.string(), undefined),
  fileId: v.optional(v.string(), undefined),
  id: v.optional(v.string(), undefined)
})

const UnstructuredJobInfoSchema = v.looseObject({
  id: v.string(),
  status: v.optional(v.string(), undefined),
  processing_status: v.optional(v.string(), undefined),
  input_file_ids: v.optional(v.nullable(v.array(v.string())), undefined),
  inputFileIds: v.optional(v.nullable(v.array(v.string())), undefined),
  output_node_files: v.optional(v.nullable(v.array(UnstructuredNodeFileSchema)), undefined),
  outputNodeFiles: v.optional(v.nullable(v.array(UnstructuredNodeFileSchema)), undefined),
  message: v.optional(v.nullable(v.string()), undefined),
  error: v.optional(v.unknown(), undefined)
})

const UnstructuredNodeStatsSchema = v.looseObject({
  ready: OptionalStringOrNumberSchema,
  in_progress: OptionalStringOrNumberSchema,
  success: OptionalStringOrNumberSchema,
  failure: OptionalStringOrNumberSchema,
  node_name: v.optional(v.nullable(v.string()), undefined),
  nodeName: v.optional(v.nullable(v.string()), undefined),
  node_type: v.optional(v.nullable(v.string()), undefined),
  nodeType: v.optional(v.nullable(v.string()), undefined),
  node_subtype: v.optional(v.nullable(v.string()), undefined),
  nodeSubtype: v.optional(v.nullable(v.string()), undefined)
})

const UnstructuredJobDetailsSchema = v.looseObject({
  id: v.string(),
  processing_status: v.optional(v.string(), undefined),
  processingStatus: v.optional(v.string(), undefined),
  status: v.optional(v.string(), undefined),
  node_stats: v.optional(v.nullable(v.array(UnstructuredNodeStatsSchema)), undefined),
  nodeStats: v.optional(v.nullable(v.array(UnstructuredNodeStatsSchema)), undefined),
  message: v.optional(v.nullable(v.string()), undefined),
  error: v.optional(v.unknown(), undefined)
})

const UnstructuredCreateJobResponseSchema = v.union([
  UnstructuredJobInfoSchema,
  v.looseObject({
    job_information: UnstructuredJobInfoSchema
  }),
  v.looseObject({
    jobInformation: UnstructuredJobInfoSchema
  })
])

const UnstructuredElementMetadataSchema = v.looseObject({
  page_number: v.optional(StringOrNumberSchema, undefined),
  pageNumber: v.optional(StringOrNumberSchema, undefined)
})

const UnstructuredElementSchema = v.looseObject({
  text: v.optional(v.nullable(v.string()), undefined),
  metadata: v.optional(v.nullable(UnstructuredElementMetadataSchema), undefined),
  page_number: v.optional(StringOrNumberSchema, undefined),
  pageNumber: v.optional(StringOrNumberSchema, undefined)
})

const UnstructuredFailedFileSchema = v.looseObject({
  document: v.optional(v.nullable(v.string()), undefined),
  error: v.optional(v.nullable(v.string()), undefined)
})

const UnstructuredFailedFilesSchema = v.looseObject({
  failed_files: v.array(UnstructuredFailedFileSchema)
})

type UnstructuredJobInfo = v.InferOutput<typeof UnstructuredJobInfoSchema>
type UnstructuredNodeFile = v.InferOutput<typeof UnstructuredNodeFileSchema>
type UnstructuredNodeStats = v.InferOutput<typeof UnstructuredNodeStatsSchema>
type UnstructuredJobDetails = v.InferOutput<typeof UnstructuredJobDetailsSchema>
type UnstructuredElement = v.InferOutput<typeof UnstructuredElementSchema>
type UnstructuredFailedFile = v.InferOutput<typeof UnstructuredFailedFileSchema>

type DownloadCandidate = {
  fileId: string
  nodeId?: string | undefined
}

type UnstructuredPollSnapshot = {
  jobInfo: UnstructuredJobInfo | undefined
  details: UnstructuredJobDetails
}

const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
}

const resolveMimeType = (filePath: string): string => {
  const ext = extname(filePath).toLowerCase()
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

const summarizeBody = (body: unknown): string => {
  if (body === undefined) return 'Unknown error'
  if (typeof body === 'string') return body.slice(0, 1000)
  try {
    return JSON.stringify(body).slice(0, 1000)
  } catch {
    return String(body).slice(0, 1000)
  }
}

const createUnstructuredHttpError = (
  stage: string,
  response: Response,
  body: unknown
): Error & { status: number, headers: Headers, stage: string, body: unknown, rawResponse: unknown } =>
  Object.assign(
    new Error(`Unstructured ${stage} failed (${response.status}): ${summarizeBody(body)}`),
    {
      status: response.status,
      headers: response.headers,
      stage,
      body,
      rawResponse: body
    }
  )

const readJsonOrText = async (
  response: Response,
  stage: string
): Promise<unknown> => {
  const rawText = await response.text()
  const body = rawText.trim().length === 0
    ? {}
    : (() => {
        try {
          return JSON.parse(rawText) as unknown
        } catch {
          return rawText
        }
      })()

  if (!response.ok) {
    throw createUnstructuredHttpError(stage, response, body)
  }

  if (typeof body === 'string') {
    throw new AppError(`Unstructured ${stage} returned a non-JSON response: ${body.slice(0, 200)}`, {
      kind: 'validation',
      status: response.status,
      stage,
      metadata: {
        body,
        rawResponse: body
      }
    })
  }

  return body
}

const withUnstructuredReadRetry = async <T>(
  operationName: string,
  operation: (signal?: AbortSignal) => Promise<T>
): Promise<T> =>
  await withRetry(
    {
      retryClass: 'runtime_http_read',
      operationName,
      timeoutMs: resolveUnstructuredPollRequestTimeoutMs()
    },
    operation,
    (error) => isTimeoutError(error)
      ? { shouldRetry: true, delayMs: 0, reason: 'timeout' }
      : classifyFetchRetry(error, 'runtime_http_read', { retryAbortOnConservative: true })
  )

const normalizeCreateJobInfo = (payload: unknown): UnstructuredJobInfo => {
  const response = validateData(UnstructuredCreateJobResponseSchema, payload, 'Unstructured create job response')
  const record = response as Record<string, unknown>
  if (record['job_information']) {
    return validateData(UnstructuredJobInfoSchema, record['job_information'], 'Unstructured job_information')
  }
  if (record['jobInformation']) {
    return validateData(UnstructuredJobInfoSchema, record['jobInformation'], 'Unstructured jobInformation')
  }
  return validateData(UnstructuredJobInfoSchema, response, 'Unstructured job information')
}

const createUnstructuredJob = async (
  filePath: string,
  apiKey: string,
  model: string
): Promise<UnstructuredJobInfo> => {
  logOcrJobProgress(l, {
    provider: 'unstructured',
    action: 'create-job',
    state: 'starting',
    detail: basename(filePath)
  })

  const payload = await withOcrCreateRetry('unstructured-ocr-create', async (signal) => {
    const form = new FormData()
    form.append('request_data', JSON.stringify({ template_id: model }))
    form.append('input_files', Bun.file(filePath, { type: resolveMimeType(filePath) }), basename(filePath))

    const response = await fetch(resolveUnstructuredApiUrl('/jobs/'), {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'unstructured-api-key': apiKey
      },
      body: form,
      ...(signal ? { signal } : {})
    })
    return await readJsonOrText(response, 'create job')
  })

  const jobInfo = normalizeCreateJobInfo(payload)
  logOcrJobProgress(l, {
    provider: 'unstructured',
    action: 'create-job',
    remoteId: jobInfo.id,
    state: 'started'
  })
  return jobInfo
}

const normalizeStatus = (jobInfo: UnstructuredJobInfo): string =>
  (jobInfo.status ?? jobInfo.processing_status ?? '').toUpperCase()

const normalizeDetailsStatus = (details: UnstructuredJobDetails): string =>
  (details.processing_status ?? details.processingStatus ?? details.status ?? '').toUpperCase()

const normalizeSnapshotStatus = (snapshot: UnstructuredPollSnapshot): string =>
  normalizeDetailsStatus(snapshot.details) || (snapshot.jobInfo ? normalizeStatus(snapshot.jobInfo) : '')

const parseCount = (value: unknown): number => {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN

  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0
}

const getDetailsNodeStats = (details: UnstructuredJobDetails): UnstructuredNodeStats[] =>
  details.node_stats ?? details.nodeStats ?? []

const getNodeStatsLabel = (stats: UnstructuredNodeStats): string =>
  stats.node_name
  ?? stats.nodeName
  ?? stats.node_subtype
  ?? stats.nodeSubtype
  ?? stats.node_type
  ?? stats.nodeType
  ?? 'node'

const summarizeNodeStats = (details: UnstructuredJobDetails): string | undefined => {
  const nodeStats = getDetailsNodeStats(details)
  if (nodeStats.length === 0) return undefined

  return nodeStats.map((stats) => {
    const label = getNodeStatsLabel(stats)
    const ready = parseCount(stats.ready)
    const inProgress = parseCount(stats.in_progress)
    const success = parseCount(stats.success)
    const failure = parseCount(stats.failure)
    return `${label} ready=${ready} in_progress=${inProgress} success=${success} failure=${failure}`
  }).join('; ')
}

const hasAnyNodeCounter = (details: UnstructuredJobDetails): boolean =>
  getDetailsNodeStats(details).some((stats) =>
    parseCount(stats.ready) > 0
    || parseCount(stats.in_progress) > 0
    || parseCount(stats.success) > 0
    || parseCount(stats.failure) > 0
  )

const isEmptyInProgressWorkflow = (snapshot: UnstructuredPollSnapshot): boolean =>
  normalizeSnapshotStatus(snapshot) === 'IN_PROGRESS'
  && getDetailsNodeStats(snapshot.details).length > 0
  && !hasAnyNodeCounter(snapshot.details)

export const buildUnstructuredProgressKey = (details: UnstructuredJobDetails): string => {
  const status = normalizeDetailsStatus(details)
  const stats = getDetailsNodeStats(details).map((nodeStats) => JSON.stringify({
    ready: parseCount(nodeStats.ready),
    in_progress: parseCount(nodeStats.in_progress),
    success: parseCount(nodeStats.success),
    failure: parseCount(nodeStats.failure),
    node_name: getNodeStatsLabel(nodeStats)
  })).sort()
  return JSON.stringify({
    status,
    stats
  })
}

const formatFailedFiles = (failedFiles: UnstructuredFailedFile[]): string | undefined => {
  if (failedFiles.length === 0) return undefined

  return failedFiles
    .map((failedFile) => {
      const document = failedFile.document ?? 'document'
      const error = failedFile.error ?? 'unknown error'
      return `${document}: ${error}`
    })
    .join('; ')
}

const formatJobFailureReason = (
  snapshot: UnstructuredPollSnapshot,
  failedFiles: UnstructuredFailedFile[] = []
): string => {
  const details = snapshot.details
  const jobInfo = snapshot.jobInfo
  const failedFileSummary = formatFailedFiles(failedFiles)
  if (failedFileSummary) {
    return failedFileSummary
  }
  if (details.message && details.message.length > 0) {
    return details.message
  }
  if (jobInfo?.message && jobInfo.message.length > 0) {
    return jobInfo.message
  }
  if (details.error !== undefined) {
    return summarizeBody(details.error)
  }
  if (jobInfo?.error !== undefined) {
    return summarizeBody(jobInfo.error)
  }
  return normalizeSnapshotStatus(snapshot) || 'unknown error'
}

const formatPollDetail = (
  attempt: number,
  details: UnstructuredJobDetails
): string => {
  const parts = [`attempt ${attempt}`]
  const statsSummary = summarizeNodeStats(details)
  if (statsSummary) {
    parts.push(statsSummary)
  }
  if (details.message && details.message.length > 0) {
    parts.push(details.message)
  }
  return parts.join(' | ')
}

const fetchUnstructuredJobInfo = async (
  apiKey: string,
  jobId: string
): Promise<UnstructuredJobInfo> => {
  const payload = await withUnstructuredReadRetry('unstructured-ocr-get-job', async (signal) => {
    const response = await fetch(resolveUnstructuredApiUrl(`/jobs/${encodeURIComponent(jobId)}`), {
      headers: {
        'accept': 'application/json',
        'unstructured-api-key': apiKey
      },
      ...(signal ? { signal } : {})
    })
    return await readJsonOrText(response, 'get job')
  })
  return validateData(UnstructuredJobInfoSchema, payload, 'Unstructured job response')
}

const fetchUnstructuredJobDetails = async (
  apiKey: string,
  jobId: string
): Promise<UnstructuredJobDetails> => {
  const payload = await withUnstructuredReadRetry('unstructured-ocr-get-job-details', async (signal) => {
    const response = await fetch(resolveUnstructuredApiUrl(`/jobs/${encodeURIComponent(jobId)}/details`), {
      headers: {
        'accept': 'application/json',
        'unstructured-api-key': apiKey
      },
      ...(signal ? { signal } : {})
    })
    return await readJsonOrText(response, 'get job details')
  })
  return validateData(UnstructuredJobDetailsSchema, payload, 'Unstructured job details response')
}

const fetchUnstructuredPollSnapshot = async (
  apiKey: string,
  jobId: string
): Promise<UnstructuredPollSnapshot> => {
  const details = await fetchUnstructuredJobDetails(apiKey, jobId)
  const status = normalizeDetailsStatus(details)
  if (status) {
    return { jobInfo: undefined, details }
  }

  return {
    jobInfo: await fetchUnstructuredJobInfo(apiKey, jobId),
    details
  }
}

const getUnstructuredFailedFiles = async (
  apiKey: string,
  jobId: string
): Promise<UnstructuredFailedFile[]> => {
  const payload = await withUnstructuredReadRetry('unstructured-ocr-get-failed-files', async (signal) => {
    const response = await fetch(resolveUnstructuredApiUrl(`/jobs/${encodeURIComponent(jobId)}/failed-files`), {
      headers: {
        'accept': 'application/json',
        'unstructured-api-key': apiKey
      },
      ...(signal ? { signal } : {})
    })
    return await readJsonOrText(response, 'get failed files')
  })
  return validateData(UnstructuredFailedFilesSchema, payload, 'Unstructured failed files response').failed_files
}

const getUnstructuredFailedFilesQuietly = async (
  apiKey: string,
  jobId: string
): Promise<UnstructuredFailedFile[]> => {
  try {
    return await getUnstructuredFailedFiles(apiKey, jobId)
  } catch {
    return []
  }
}

const cancelUnstructuredJobQuietly = async (
  apiKey: string,
  jobId: string,
  reason: string
): Promise<void> => {
  try {
    await withUnstructuredReadRetry('unstructured-ocr-cancel-job', async (signal) => {
      const response = await fetch(resolveUnstructuredApiUrl(`/jobs/${encodeURIComponent(jobId)}/cancel`), {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'unstructured-api-key': apiKey
        },
        ...(signal ? { signal } : {})
      })
      return await readJsonOrText(response, 'cancel job')
    })
    logOcrJobProgress(l, {
      provider: 'unstructured',
      action: 'cancel-job',
      remoteId: jobId,
      state: 'requested',
      detail: reason
    }, 'warn')
  } catch (error) {
    l.warn(`Unstructured OCR job ${jobId} cancel request failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const installUnstructuredJobSignalCleanup = (
  apiKey: string,
  jobId: string
): (() => void) => {
  let handlingSignal = false
  const handlers = new Map<NodeJS.Signals, () => void>()

  const removeHandlers = (): void => {
    for (const [signal, handler] of handlers) {
      process.off(signal, handler)
    }
    handlers.clear()
  }

  const install = (signal: NodeJS.Signals, exitCode: number): void => {
    const handler = (): void => {
      if (handlingSignal) return
      handlingSignal = true
      removeHandlers()
      void cancelUnstructuredJobQuietly(apiKey, jobId, `process received ${signal}`)
        .finally(() => {
          process.exit(exitCode)
        })
    }
    handlers.set(signal, handler)
    process.once(signal, handler)
  }

  install('SIGINT', 130)
  install('SIGTERM', 143)
  return removeHandlers
}

const pollUnstructuredJob = async (
  apiKey: string,
  jobId: string
): Promise<UnstructuredJobInfo> => {
  const startedAt = Date.now()
  const pollDeadlineMs = resolveUnstructuredPollDeadlineMs()
  const stallDeadlineMs = resolveUnstructuredStallDeadlineMs(pollDeadlineMs)
  const emptyWorkflowDeadlineMs = resolveUnstructuredEmptyWorkflowDeadlineMs(pollDeadlineMs)
  const pollIntervalMs = resolveUnstructuredPollIntervalMs()
  let attempt = 0
  let lastProgressKey: string | undefined
  let lastProgressAt = startedAt
  let emptyWorkflowAt: number | undefined

  while (Date.now() - startedAt < pollDeadlineMs) {
    if (attempt > 0) {
      const remainingPollMs = Math.max(0, pollDeadlineMs - (Date.now() - startedAt))
      const remainingStallMs = Math.max(0, stallDeadlineMs - (Date.now() - lastProgressAt))
      await Bun.sleep(Math.min(pollIntervalMs, remainingPollMs, remainingStallMs))
      if (Date.now() - startedAt >= pollDeadlineMs) {
        break
      }
    }
    attempt += 1

    const snapshot = await fetchUnstructuredPollSnapshot(apiKey, jobId)
    const status = normalizeSnapshotStatus(snapshot)
    const progressKey = buildUnstructuredProgressKey(snapshot.details)
    if (lastProgressKey === undefined || progressKey !== lastProgressKey) {
      lastProgressKey = progressKey
      lastProgressAt = Date.now()
    } else if (Date.now() - lastProgressAt >= stallDeadlineMs) {
      const detail = formatPollDetail(attempt, snapshot.details)
      await cancelUnstructuredJobQuietly(apiKey, jobId, `no observable progress for ${stallDeadlineMs}ms`)
      throw new Error(`Unstructured OCR job ${jobId} made no observable progress for ${stallDeadlineMs}ms (${detail})`)
    }

    if (isEmptyInProgressWorkflow(snapshot)) {
      emptyWorkflowAt ??= Date.now()
      if (Date.now() - emptyWorkflowAt >= emptyWorkflowDeadlineMs) {
        const detail = formatPollDetail(attempt, snapshot.details)
        await cancelUnstructuredJobQuietly(apiKey, jobId, `workflow node counters stayed empty for ${emptyWorkflowDeadlineMs}ms`)
        throw new Error(`Unstructured OCR job ${jobId} did not move any files into workflow nodes for ${emptyWorkflowDeadlineMs}ms (${detail}). This usually means Unstructured accepted the job shell but did not ingest the uploaded file, or the account is blocked behind existing running on-demand jobs.`)
      }
    } else {
      emptyWorkflowAt = undefined
    }

    if (status === 'COMPLETED' || status === 'SUCCESS' || status === 'COMPLETED_WITH_ERRORS') {
      const completedJobInfo = snapshot.jobInfo ?? await fetchUnstructuredJobInfo(apiKey, jobId)
      logOcrJobProgress(l, {
        provider: 'unstructured',
        action: 'poll-job',
        remoteId: jobId,
        state: status.toLowerCase(),
        detail: summarizeNodeStats(snapshot.details)
      }, status === 'COMPLETED_WITH_ERRORS' ? 'warn' : 'info')
      return completedJobInfo
    }

    if (status === 'FAILED' || status === 'STOPPED' || status === 'CANCELED' || status === 'CANCELLED') {
      const failedFiles = await getUnstructuredFailedFilesQuietly(apiKey, jobId)
      logOcrJobProgress(l, {
        provider: 'unstructured',
        action: 'poll-job',
        remoteId: jobId,
        state: 'failed',
        detail: formatJobFailureReason(snapshot, failedFiles)
      })
      throw new Error(`Unstructured OCR job ${jobId} failed: ${formatJobFailureReason(snapshot, failedFiles)}`)
    }

    if (attempt === 1 || attempt % 12 === 0) {
      logOcrJobProgress(l, {
        provider: 'unstructured',
        action: 'poll-job',
        remoteId: jobId,
        state: status.toLowerCase() || 'in_progress',
        detail: formatPollDetail(attempt, snapshot.details)
      })
    }
  }

  await cancelUnstructuredJobQuietly(apiKey, jobId, `poll deadline exceeded after ${pollDeadlineMs}ms`)
  throw new Error(`Unstructured OCR job ${jobId} did not complete before OCR poll deadline (${pollDeadlineMs}ms)`)
}

const getNodeFileId = (nodeFile: UnstructuredNodeFile): string | undefined =>
  nodeFile.file_id ?? nodeFile.fileId ?? nodeFile.id

const getNodeId = (nodeFile: UnstructuredNodeFile): string | undefined =>
  nodeFile.node_id ?? nodeFile.nodeId

const getInputFileIds = (jobInfo: UnstructuredJobInfo): string[] =>
  jobInfo.input_file_ids ?? jobInfo.inputFileIds ?? []

const getOutputNodeFiles = (jobInfo: UnstructuredJobInfo): UnstructuredNodeFile[] =>
  jobInfo.output_node_files ?? jobInfo.outputNodeFiles ?? []

const collectDownloadCandidates = (
  createInfo: UnstructuredJobInfo,
  completedInfo: UnstructuredJobInfo
): DownloadCandidate[] => {
  const candidates: DownloadCandidate[] = []
  const seen = new Set<string>()

  const addCandidate = (candidate: DownloadCandidate): void => {
    const key = `${candidate.nodeId ?? ''}:${candidate.fileId}`
    if (seen.has(key)) return
    seen.add(key)
    candidates.push(candidate)
  }

  for (const jobInfo of [completedInfo, createInfo]) {
    for (const nodeFile of getOutputNodeFiles(jobInfo)) {
      const fileId = getNodeFileId(nodeFile)
      if (fileId) {
        addCandidate({
          fileId,
          nodeId: getNodeId(nodeFile)
        })
      }
    }
  }

  for (const jobInfo of [completedInfo, createInfo]) {
    for (const fileId of getInputFileIds(jobInfo)) {
      addCandidate({ fileId })
    }
  }

  return candidates
}

const downloadUnstructuredOutput = async (
  apiKey: string,
  jobId: string,
  candidate: DownloadCandidate
): Promise<unknown> => {
  const url = new URL(resolveUnstructuredApiUrl(`/jobs/${encodeURIComponent(jobId)}/download`))
  url.searchParams.set('file_id', candidate.fileId)
  if (candidate.nodeId) {
    url.searchParams.set('node_id', candidate.nodeId)
  }

  return await withUnstructuredReadRetry('unstructured-ocr-download-output', async (signal) => {
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'unstructured-api-key': apiKey
      },
      ...(signal ? { signal } : {})
    })
    return await readJsonOrText(response, 'download job output')
  })
}

const extractElementPayload = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (Array.isArray(record['elements'])) {
      return record['elements']
    }
    if (Array.isArray(record['data'])) {
      return record['data']
    }
    if (Array.isArray(record['results'])) {
      return record['results']
    }
  }

  throw new Error('Unstructured download response did not contain a JSON elements array')
}

const parsePageNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number.parseInt(value, 10)
      : Number.NaN

  if (!Number.isFinite(parsed) || parsed < 1) {
    return undefined
  }

  return Math.floor(parsed)
}

const resolveElementPageNumber = (element: UnstructuredElement): number => {
  const metadata = element.metadata ?? undefined
  return parsePageNumber(metadata?.page_number)
    ?? parsePageNumber(metadata?.pageNumber)
    ?? parsePageNumber(element.page_number)
    ?? parsePageNumber(element.pageNumber)
    ?? 1
}

const buildPageResults = (
  payload: unknown,
  step1Metadata: DocumentMetadata
): { pages: PageResult[], totalPages: number } => {
  const elementPayload = extractElementPayload(payload)
  const elements = validateData(v.array(UnstructuredElementSchema), elementPayload, 'Unstructured OCR elements')
  const pageTexts = new Map<number, string[]>()
  let maxPage = 1

  for (const element of elements) {
    if (!element.text) {
      continue
    }

    const pageNumber = resolveElementPageNumber(element)
    maxPage = Math.max(maxPage, pageNumber)
    const lines = pageTexts.get(pageNumber) ?? []
    lines.push(element.text)
    pageTexts.set(pageNumber, lines)
  }

  const totalPages = Math.max(1, step1Metadata.pageCount, maxPage)
  const pages: PageResult[] = []
  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    pages.push({
      pageNumber,
      method: 'ocr',
      text: (pageTexts.get(pageNumber) ?? []).join('\n')
    })
  }

  return { pages, totalPages }
}

export const runUnstructuredOcr = async (
  filePath: string,
  step1Metadata: DocumentMetadata,
  model: string
): Promise<{
  pages: PageResult[]
  extractionMethod: 'unstructured-ocr'
  totalPages: number
}> => {
  const apiKey = getUnstructuredApiKey()
  if (!apiKey) {
    throw new Error('UNSTRUCTURED_API_KEY environment variable is required for Unstructured OCR')
  }

  const createInfo = await createUnstructuredJob(filePath, apiKey, model)
  const inputFileIds = getInputFileIds(createInfo)
  if (inputFileIds.length === 0) {
    await cancelUnstructuredJobQuietly(apiKey, createInfo.id, 'create job returned no input_file_ids')
    throw new Error(`Unstructured OCR job ${createInfo.id} did not return input_file_ids from create-job; the uploaded file was not accepted into the on-demand job`)
  }

  const removeSignalCleanup = installUnstructuredJobSignalCleanup(apiKey, createInfo.id)
  try {
    const completedInfo = await pollUnstructuredJob(apiKey, createInfo.id)
    const candidates = collectDownloadCandidates(createInfo, completedInfo)
    if (candidates.length === 0) {
      throw new Error(`Unstructured OCR job ${createInfo.id} did not include downloadable file IDs`)
    }

    let lastError: unknown
    for (const candidate of candidates) {
      try {
        const payload = await downloadUnstructuredOutput(apiKey, createInfo.id, candidate)
        const { pages, totalPages } = buildPageResults(payload, step1Metadata)
        logOcrJobProgress(l, {
          provider: 'unstructured',
          action: 'download-job-output',
          remoteId: createInfo.id,
          state: 'completed',
          pages: totalPages,
          detail: candidate.nodeId ? `${candidate.nodeId}/${candidate.fileId}` : candidate.fileId
        })
        return {
          pages,
          extractionMethod: 'unstructured-ocr',
          totalPages
        }
      } catch (error) {
        lastError = error
        l.warn(`Unstructured OCR download candidate failed (${candidate.nodeId ? `${candidate.nodeId}/` : ''}${candidate.fileId}): ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    throw new Error(`Unstructured OCR job ${createInfo.id} output download failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
  } finally {
    removeSignalCleanup()
  }
}
