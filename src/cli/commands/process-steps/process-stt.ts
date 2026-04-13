import { mkdir, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'
import type { StepTimingCost } from '~/logger'
import { ensureDirectory } from '~/utils/cli-utils'
import type { AggregatedPriceEstimate, RuntimeOptions, RetryClass, Step2Metadata, TranscriptionResult } from '~/types'
import { getSttEstimation } from '~/cli/commands/models/model-loader'
import { createUniqueDirectoryName } from './step-1-download/audio/metadata-utils'
import { buildPrompt } from './step-3-write/write-utils/prompt-utils'
import { resolvePromptNames } from '~/prompts/prompt-loader'
import { collectSttTargets, getSttTargetDirectoryName, type SttTarget } from './step-2-stt/stt-targets'
import { prepareSttMedia, resolveSttSourceMetadata } from './step-2-stt/stt-media-cache'
import { getTranscribeEngineCapabilities, transcribeTarget } from './step-2-stt/run-transcribe'
import { SttBatchCoordinator, type SttBatchBlockedProviderReason } from './step-2-stt/stt-batch-coordinator'
import { computeActualCosts, computeEstimatedCosts, preflightToEstimated } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { classifyFetchRetry } from '~/utils/retries'
import { CLIUsageError } from '~/utils/error-handler'

type PreparedSttMedia = Awaited<ReturnType<typeof prepareSttMedia>>

export type SttCompletionStatus = 'full' | 'incomplete' | 'failed'

export type SttRequestedProvider = Pick<SttTarget, 'service' | 'model' | 'local' | 'diarizationOptions'>

export type SttRecordedProviderError = {
  message: string
  retryable: boolean
  skipped?: boolean | undefined
  stage?: string | undefined
  status?: number | undefined
  errorFile?: string | undefined
  rawResponseFile?: string | undefined
}

export type SttProviderState = {
  service: SttTarget['service']
  model: string
  local: boolean
  artifactDir: string
  status: 'succeeded' | 'missing' | 'failed' | 'skipped'
  attempts: number
  retryable?: boolean | undefined
  lastError?: SttRecordedProviderError | undefined
}

type ProviderFailure = {
  index: number
  service: SttTarget['service']
  model: string
  message: string
  retryable: boolean
  stage?: string | undefined
  status?: number | undefined
  errorFile?: string | undefined
  rawResponseFile?: string | undefined
}

type ProviderSuccess = {
  target: SttTarget
  metadata: Step2Metadata
  result: TranscriptionResult
  relativeDir?: string | undefined
}

type ExistingSttRun = {
  successes: Array<ProviderSuccess | undefined>
  providerStates: Map<string, SttProviderState>
}

type ProcessSttRunOptions = {
  outputDir?: string | undefined
  requestedTargets?: SttTarget[] | undefined
  targetsToRun?: SttTarget[] | undefined
  batchCoordinator?: SttBatchCoordinator | undefined
}

type PromptSelectionCandidate = ProviderSuccess

type ProviderErrorLike = Error & {
  cause?: unknown
  headers?: Headers
  retryClass?: RetryClass
  stage?: string
  status?: number
  rawResponse?: unknown
}

const isProviderErrorLike = (value: unknown): value is ProviderErrorLike =>
  value instanceof Error

const TRANSCRIPT_LINE_PATTERN = /^\[(\d{2}:\d{2}:\d{2})\]\s+(?:\[([^\]]+)\]\s+)?(.*)$/
const STT_RECOVERY_MAX_PASSES = 3
const BATCH_BLOCKING_AUTH_STATUS_CODES = new Set([401, 403])
const BATCH_BLOCKING_MODEL_ERROR_CODES = new Set([400, 404, 422])
const BATCH_BLOCKING_MODEL_MESSAGE_PATTERNS = [
  /\bmodel\b.*\b(not found|does not exist|unsupported|not supported|unknown|invalid|unrecognized)\b/i,
  /\b(not found|does not exist|unsupported|not supported|unknown|invalid|unrecognized)\b.*\bmodel\b/i,
  /\bendpoint\b.*\bnot found\b/i,
  /\bspeaker reference\b.*\bnot found\b/i
]
const BATCH_BLOCKING_SETUP_MESSAGE_PATTERNS = [
  /\benvironment variable\b.*\brequired\b/i,
  /\bapi[_ -]?key\b.*\b(required|not set|missing)\b/i,
  /\bcredentials?\b.*\b(required|missing|invalid)\b/i
]

const emittedInfoMessages = new Set<string>()
const emittedWarnMessages = new Set<string>()

const logInfoOnce = (message: string): void => {
  if (emittedInfoMessages.has(message)) {
    return
  }

  emittedInfoMessages.add(message)
  l.info(message)
}

const logWarnOnce = (message: string): void => {
  if (emittedWarnMessages.has(message)) {
    return
  }

  emittedWarnMessages.add(message)
  l.warn(message)
}

const collectErrorChain = (error: unknown): ProviderErrorLike[] => {
  const chain: ProviderErrorLike[] = []
  const seen = new Set<unknown>()
  let current: unknown = error

  while (isProviderErrorLike(current) && !seen.has(current)) {
    chain.push(current)
    seen.add(current)
    current = current.cause
  }

  return chain
}

const resolveFailureMessage = (
  chain: ProviderErrorLike[],
  error: unknown
): string => {
  if (chain.length === 0) {
    return error instanceof Error ? error.message : String(error)
  }

  const outer = chain[0] as ProviderErrorLike
  const deepest = chain[chain.length - 1] as ProviderErrorLike
  if (deepest.name === 'AbortError') {
    return outer.message
  }

  return deepest.message || outer.message
}

export const classifySttProviderFailure = (
  error: unknown
): Omit<ProviderFailure, 'index' | 'service' | 'model'> => {
  const chain = collectErrorChain(error)
  const message = resolveFailureMessage(chain, error)
  const deepest = chain[chain.length - 1]
  const retryClass = chain.find((entry) => typeof entry.retryClass === 'string')?.retryClass
  const status = chain.find((entry) => typeof entry.status === 'number')?.status
  const headers = chain.find((entry) => entry.headers instanceof Headers)?.headers
  const stage = chain.find((entry) => typeof entry.stage === 'string')?.stage

  let retryable = false
  if (retryClass) {
    const retryCandidate = Object.assign(
      deepest instanceof Error ? deepest : new Error(message),
      {
        ...(typeof status === 'number' ? { status } : {}),
        ...(headers instanceof Headers ? { headers } : {})
      }
    )
    retryable = classifyFetchRetry(
      retryCandidate,
      retryClass,
      { retryAbortOnConservative: true }
    ).shouldRetry
  } else if (typeof status === 'number') {
    retryable = classifyFetchRetry(
      Object.assign(new Error(message), {
        status,
        ...(headers instanceof Headers ? { headers } : {})
      }),
      'runtime_http_read',
      { retryAbortOnConservative: true }
    ).shouldRetry
  }

  return {
    message,
    retryable,
    ...(stage ? { stage } : {}),
    ...(typeof status === 'number' ? { status } : {})
  }
}

export const shouldBlockSttProviderForBatch = (
  failure: Pick<ProviderFailure, 'message' | 'retryable' | 'stage' | 'status'>
): boolean => {
  if (failure.retryable) {
    return false
  }

  if (BATCH_BLOCKING_SETUP_MESSAGE_PATTERNS.some((pattern) => pattern.test(failure.message))) {
    return true
  }

  if (typeof failure.status === 'number' && BATCH_BLOCKING_AUTH_STATUS_CODES.has(failure.status)) {
    return true
  }

  const isProviderConfigStage = failure.stage === undefined
    || failure.stage === 'transcribe'
    || failure.stage === 'create'
    || failure.stage === 'upload'

  return isProviderConfigStage
    && typeof failure.status === 'number'
    && BATCH_BLOCKING_MODEL_ERROR_CODES.has(failure.status)
    && BATCH_BLOCKING_MODEL_MESSAGE_PATTERNS.some((pattern) => pattern.test(failure.message))
}

const extractProviderRawResponse = (error: unknown): unknown =>
  collectErrorChain(error).find((entry) => entry.rawResponse !== undefined)?.rawResponse

const toDiagnosticJson = (value: unknown): string => {
  try {
    const json = JSON.stringify(value, null, 2)
    if (typeof json === 'string') {
      return json
    }
  } catch {
  }

  return JSON.stringify({ value: String(value) }, null, 2)
}

const writeProviderFailureArtifacts = async (
  providerDir: string,
  failure: Omit<ProviderFailure, 'index'>,
  rawResponse: unknown
): Promise<Pick<ProviderFailure, 'errorFile' | 'rawResponseFile'>> => {
  const errorFile = 'error.json'
  let rawResponseFile: string | undefined

  if (rawResponse !== undefined) {
    rawResponseFile = 'raw-response.json'
    await Bun.write(join(providerDir, rawResponseFile), toDiagnosticJson(rawResponse))
  }

  await Bun.write(join(providerDir, errorFile), JSON.stringify({
    service: failure.service,
    model: failure.model,
    message: failure.message,
    retryable: failure.retryable,
    ...(failure.stage ? { stage: failure.stage } : {}),
    ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
    ...(rawResponseFile ? { rawResponseFile } : {})
  }, null, 2))

  return {
    errorFile,
    ...(rawResponseFile ? { rawResponseFile } : {})
  }
}

const writeSkippedProviderArtifact = async (
  providerDir: string,
  reason: SttBatchBlockedProviderReason
): Promise<Pick<ProviderFailure, 'errorFile'>> => {
  const errorFile = 'error.json'
  await Bun.write(join(providerDir, errorFile), JSON.stringify({
    service: reason.service,
    model: reason.model,
    message: reason.message,
    retryable: reason.retryable,
    skipped: true,
    ...(reason.stage ? { stage: reason.stage } : {}),
    ...(typeof reason.status === 'number' ? { status: reason.status } : {})
  }, null, 2))

  return { errorFile }
}

type EffectiveSttProviderConcurrency = {
  requested: number
  effective: number
  autoThrottled: boolean
  hostedProviderCount: number
}

export const resolveEffectiveSttProviderConcurrency = (
  options: Pick<RuntimeOptions, 'batchConcurrency' | 'sttProviderConcurrency'>,
  targets: Pick<SttTarget, 'local'>[]
): EffectiveSttProviderConcurrency => {
  const requested = Math.max(1, options.sttProviderConcurrency)
  const hostedProviderCount = targets.filter((target) => !target.local).length
  const autoThrottled = options.batchConcurrency > 1 && hostedProviderCount > 1 && requested > 1

  return {
    requested,
    effective: autoThrottled ? 1 : requested,
    autoThrottled,
    hostedProviderCount
  }
}

const formatSttTargetLabel = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service === 'whisper' ? 'whisper.cpp' : target.service}/${target.model}`

const logSpeakerCountHintSummary = (
  targets: SttTarget[],
  requestedSpeakerCount: number | undefined
): void => {
  if (requestedSpeakerCount === undefined || targets.length === 0) {
    return
  }

  const honored = targets
    .filter((target) => getTranscribeEngineCapabilities(target.service).supportsSpeakerCountHint)
    .map(formatSttTargetLabel)
  const ignored = targets
    .filter((target) => !getTranscribeEngineCapabilities(target.service).supportsSpeakerCountHint)
    .map(formatSttTargetLabel)

  if (ignored.length === 0) {
    return
  }

  const message = [
    `Using --speaker-count=${requestedSpeakerCount} for STT diarization`,
    `honored=${honored.length > 0 ? honored.join(', ') : 'none'}`,
    `ignored=${ignored.join(', ')}`
  ].join('; ')

  logWarnOnce(message)
}

const logEffectiveProviderConcurrency = (
  resolution: EffectiveSttProviderConcurrency,
  batchConcurrency: number
): void => {
  if (resolution.hostedProviderCount <= 1) {
    return
  }

  const message = resolution.autoThrottled
    ? `STT cloud provider concurrency auto-throttled: requested=${resolution.requested}, effective=${resolution.effective}, batchConcurrency=${batchConcurrency}, hostedProviders=${resolution.hostedProviderCount}`
    : `STT cloud provider concurrency: requested=${resolution.requested}, effective=${resolution.effective}, batchConcurrency=${batchConcurrency}, hostedProviders=${resolution.hostedProviderCount}`

  if (resolution.autoThrottled) {
    logWarnOnce(message)
    return
  }

  logInfoOnce(message)
}

const formatProviderFailure = (failure: ProviderFailure): string => {
  const context = [
    failure.stage ? `stage=${failure.stage}` : undefined,
    typeof failure.status === 'number' ? `status=${failure.status}` : undefined,
    failure.retryable ? 'retryable=true' : undefined
  ].filter((entry): entry is string => typeof entry === 'string')

  return context.length > 0
    ? `${failure.service}/${failure.model} (${context.join(', ')}): ${failure.message}`
    : `${failure.service}/${failure.model}: ${failure.message}`
}

const STT_SERVICES = new Set<SttTarget['service']>([
  'whisper',
  'reverb',
  'deepgram',
  'elevenlabs',
  'soniox',
  'groq',
  'openai',
  'mistral',
  'assemblyai'
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isSttService = (value: unknown): value is SttTarget['service'] =>
  typeof value === 'string' && STT_SERVICES.has(value as SttTarget['service'])

const getTargetKey = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `${target.service}:${target.model}`

const getProviderArtifactDir = (target: Pick<SttTarget, 'service' | 'model'>): string =>
  `providers/${getSttTargetDirectoryName(target)}`

const toRequestedProvider = (target: SttTarget): SttRequestedProvider => ({
  service: target.service,
  model: target.model,
  local: target.local,
  ...(target.diarizationOptions ? { diarizationOptions: target.diarizationOptions } : {})
})

const toRecordedProviderError = (
  failure: Omit<ProviderFailure, 'index' | 'service' | 'model'> & { skipped?: boolean | undefined }
): SttRecordedProviderError => ({
  message: failure.message,
  retryable: failure.retryable,
  ...(failure.skipped === true ? { skipped: true } : {}),
  ...(failure.stage ? { stage: failure.stage } : {}),
  ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
  ...(failure.errorFile ? { errorFile: failure.errorFile } : {}),
  ...(failure.rawResponseFile ? { rawResponseFile: failure.rawResponseFile } : {})
})

const parseTranscriptText = (text: string): TranscriptionResult => {
  const segments: TranscriptionResult['segments'] = []
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) {
      continue
    }

    const match = line.match(TRANSCRIPT_LINE_PATTERN)
    if (!match) {
      continue
    }

    const segmentText = (match[3] ?? '').trim()
    if (segmentText.length === 0) {
      continue
    }

    segments.push({
      start: match[1] as string,
      end: match[1] as string,
      text: segmentText,
      ...(typeof match[2] === 'string' && match[2].trim().length > 0
        ? { speaker: match[2].trim() }
        : {})
    })
  }

  if (segments.length === 0) {
    const trimmed = text.trim()
    return {
      text: trimmed,
      segments: trimmed.length > 0
        ? [{ start: '00:00:00', end: '00:00:00', text: trimmed }]
        : []
    }
  }

  return {
    text: segments.map((segment) => segment.text).join(' ').trim(),
    segments
  }
}

const parseStoredStep2Metadata = (value: unknown): Step2Metadata | undefined => {
  if (!isRecord(value) || !isSttService(value['transcriptionService']) || typeof value['transcriptionModel'] !== 'string') {
    return undefined
  }

  if (typeof value['processingTime'] !== 'number' || typeof value['tokenCount'] !== 'number') {
    return undefined
  }

  return {
    transcriptionService: value['transcriptionService'],
    transcriptionModel: value['transcriptionModel'],
    ...(typeof value['transcriptionModelName'] === 'string' ? { transcriptionModelName: value['transcriptionModelName'] } : {}),
    processingTime: value['processingTime'],
    tokenCount: value['tokenCount']
  }
}

const parseStoredProviderState = (value: unknown): SttProviderState | undefined => {
  if (!isRecord(value) || !isSttService(value['service']) || typeof value['model'] !== 'string') {
    return undefined
  }

  if (value['status'] !== 'succeeded' && value['status'] !== 'missing' && value['status'] !== 'failed' && value['status'] !== 'skipped') {
    return undefined
  }

  if (typeof value['artifactDir'] !== 'string' || typeof value['attempts'] !== 'number') {
    return undefined
  }

  const lastError = isRecord(value['lastError']) && typeof value['lastError']['message'] === 'string'
    ? {
        message: value['lastError']['message'],
        retryable: value['lastError']['retryable'] === true,
        ...(value['lastError']['skipped'] === true ? { skipped: true } : {}),
        ...(typeof value['lastError']['stage'] === 'string' ? { stage: value['lastError']['stage'] } : {}),
        ...(typeof value['lastError']['status'] === 'number' ? { status: value['lastError']['status'] } : {}),
        ...(typeof value['lastError']['errorFile'] === 'string' ? { errorFile: value['lastError']['errorFile'] } : {}),
        ...(typeof value['lastError']['rawResponseFile'] === 'string' ? { rawResponseFile: value['lastError']['rawResponseFile'] } : {})
      } satisfies SttRecordedProviderError
    : undefined

  return {
    service: value['service'],
    model: value['model'],
    local: value['local'] === true,
    artifactDir: value['artifactDir'],
    status: value['status'],
    attempts: value['attempts'],
    ...(typeof value['retryable'] === 'boolean' ? { retryable: value['retryable'] } : {}),
    ...(lastError ? { lastError } : {})
  }
}

const readExistingSttRun = async (
  outputDir: string,
  requestedTargets: SttTarget[]
): Promise<ExistingSttRun> => {
  const providerStates = new Map<string, SttProviderState>()
  const successes: Array<ProviderSuccess | undefined> = new Array(requestedTargets.length)
  const metadataPath = join(outputDir, 'metadata.json')
  if (!await Bun.file(metadataPath).exists()) {
    return { successes, providerStates }
  }

  let raw: unknown
  try {
    raw = await Bun.file(metadataPath).json()
  } catch {
    return { successes, providerStates }
  }

  if (!isRecord(raw)) {
    return { successes, providerStates }
  }

  const providerStateValues = Array.isArray(raw['providerStates']) ? raw['providerStates'] : []
  for (const value of providerStateValues) {
    const parsed = parseStoredProviderState(value)
    if (!parsed) {
      continue
    }
    providerStates.set(getTargetKey(parsed), parsed)
  }

  const storedStep2Values = Array.isArray(raw['step2'])
    ? raw['step2']
    : raw['step2'] === undefined
      ? []
      : [raw['step2']]

  const storedStep2Metadata = storedStep2Values
    .map(parseStoredStep2Metadata)
    .filter((entry): entry is Step2Metadata => entry !== undefined)

  await Promise.all(requestedTargets.map(async (target, index) => {
    const metadata = storedStep2Metadata.find((entry) =>
      entry.transcriptionService === target.service
      && (entry.transcriptionModelName ?? entry.transcriptionModel) === target.model
    )
    if (!metadata) {
      return
    }

    const transcriptPath = join(outputDir, getProviderArtifactDir(target), 'transcription.txt')
    const transcriptText = await Bun.file(transcriptPath).text().catch(() => '')
    successes[index] = {
      target,
      metadata,
      result: parseTranscriptText(transcriptText),
      relativeDir: getProviderArtifactDir(target)
    }
  }))

  return {
    successes,
    providerStates
  }
}

const buildProviderStates = (
  requestedTargets: SttTarget[],
  successes: Array<ProviderSuccess | undefined>,
  failuresByIndex: Map<number, ProviderFailure>,
  existingStates: Map<string, SttProviderState>
): SttProviderState[] =>
  requestedTargets.map((target, index) => {
    const key = getTargetKey(target)
    const existing = existingStates.get(key)
    const failure = failuresByIndex.get(index)
    const success = successes[index]

    if (success) {
      return {
        service: target.service,
        model: target.model,
        local: target.local,
        artifactDir: getProviderArtifactDir(target),
        status: 'succeeded',
        attempts: existing?.attempts ?? 0
      }
    }

    if (failure) {
      return {
        service: target.service,
        model: target.model,
        local: target.local,
        artifactDir: getProviderArtifactDir(target),
        status: 'failed',
        attempts: existing?.attempts ?? 0,
        retryable: failure.retryable,
        lastError: toRecordedProviderError({
          message: failure.message,
          retryable: failure.retryable,
          ...(failure.stage ? { stage: failure.stage } : {}),
          ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
          ...(failure.errorFile ? { errorFile: `${getProviderArtifactDir(target)}/${failure.errorFile}` } : {}),
          ...(failure.rawResponseFile ? { rawResponseFile: `${getProviderArtifactDir(target)}/${failure.rawResponseFile}` } : {})
        })
      }
    }

    return {
      service: target.service,
      model: target.model,
      local: target.local,
      artifactDir: getProviderArtifactDir(target),
      status: existing?.status ?? 'missing',
      attempts: existing?.attempts ?? 0,
      ...(existing?.retryable !== undefined ? { retryable: existing.retryable } : {}),
      ...(existing?.lastError ? { lastError: existing.lastError } : {})
    }
  })

const resolveCompletionStatus = (
  requestedTargets: SttTarget[],
  successes: Array<ProviderSuccess | undefined>
): SttCompletionStatus => {
  const successCount = successes.filter((entry) => entry !== undefined).length
  if (successCount === 0) {
    return 'failed'
  }
  return successCount === requestedTargets.length ? 'full' : 'incomplete'
}

const buildMissingProviders = (
  providerStates: SttProviderState[],
  requestedTargets: SttTarget[]
): SttRequestedProvider[] => {
  const missingKeys = new Set(providerStates
    .filter((state) => state.status !== 'succeeded')
    .map((state) => getTargetKey(state)))

  return requestedTargets
    .filter((target) => missingKeys.has(getTargetKey(target)))
    .map(toRequestedProvider)
}

const buildMetadataErrorEntries = (providerStates: SttProviderState[]): Array<Record<string, unknown>> =>
  providerStates
    .filter((state) => state.lastError !== undefined)
    .map((state) => ({
      service: state.service,
      model: state.model,
      message: state.lastError?.message,
      ...(state.status === 'skipped' ? { skipped: true } : {}),
      ...(state.lastError?.stage ? { stage: state.lastError.stage } : {}),
      ...(typeof state.lastError?.status === 'number' ? { status: state.lastError.status } : {}),
      retryable: state.lastError?.retryable === true,
      ...(state.lastError?.errorFile ? { errorFile: state.lastError.errorFile } : {}),
      ...(state.lastError?.rawResponseFile ? { rawResponseFile: state.lastError.rawResponseFile } : {})
    }))

export const filterSttPreflightEstimate = (
  estimate: AggregatedPriceEstimate
): AggregatedPriceEstimate => {
  const steps = estimate.steps.filter((step) => step.step === 'stt')
  return {
    steps,
    totalEstimatedCost: steps.reduce((sum, step) => sum + step.totalCost, 0)
  }
}

const resolveSttEstimatedCosts = (
  preflightEstimate: AggregatedPriceEstimate | undefined,
  targets: SttTarget[],
  durationSeconds: number
) => preflightEstimate
  ? preflightToEstimated(filterSttPreflightEstimate(preflightEstimate))
  : computeEstimatedCosts({
      sttTargets: targets.map((entry) => ({ service: entry.service, model: entry.model })),
      audioDurationSeconds: durationSeconds
    })

export const prioritizeCloudSttTargetIndices = (targets: SttTarget[]): number[] =>
  targets
    .map((target, index) => ({ target, index }))
    .filter((entry) => !entry.target.local)
    .sort((left, right) => {
      const leftAssemblyPriority = left.target.service === 'assemblyai' ? 1 : 0
      const rightAssemblyPriority = right.target.service === 'assemblyai' ? 1 : 0
      if (leftAssemblyPriority !== rightAssemblyPriority) {
        return rightAssemblyPriority - leftAssemblyPriority
      }

      const leftEstimate = getSttEstimation(left.target.service, left.target.model).msPerSecond
      const rightEstimate = getSttEstimation(right.target.service, right.target.model).msPerSecond
      if (leftEstimate !== rightEstimate) {
        return rightEstimate - leftEstimate
      }

      return left.index - right.index
    })
    .map((entry) => entry.index)

const buildAcquireSummary = (
  itemLabel: string,
  prepared: PreparedSttMedia
): string => {
  const sourceMedia = `${prepared.cache.sourceMedia}${prepared.timings.sourceMediaMs !== undefined ? `(${prepared.timings.sourceMediaMs}ms)` : ''}`
  return `stt-acquire item=${itemLabel} sourceMedia=${sourceMedia}`
}

const resolveTargetAudioPath = (
  _target: SttTarget,
  prepared: PreparedSttMedia
): string => {
  const sourceMediaPath = prepared.executionArtifacts.sourceMediaPath
  return sourceMediaPath
}

const runTargetPool = async (
  indices: number[],
  concurrency: number,
  worker: (index: number) => Promise<void>
): Promise<void> => {
  const normalizedConcurrency = Math.max(1, concurrency)
  let next = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const current = next
      next += 1
      if (current >= indices.length) {
        return
      }
      await worker(indices[current] as number)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(normalizedConcurrency, indices.length) }, async () => {
      await runWorker()
    })
  )
}

const buildProviderModelLabel = (
  metadata: Pick<Step2Metadata, 'transcriptionService' | 'transcriptionModel' | 'transcriptionModelName'>
): string =>
  `${metadata.transcriptionService === 'whisper' ? 'whisper.cpp' : metadata.transcriptionService}/${metadata.transcriptionModelName ?? metadata.transcriptionModel}`

const buildPromptFile = async (
  outputDir: string,
  metadata: PreparedSttMedia['metadata'],
  transcription: TranscriptionResult,
  slug: string,
  options: Pick<RuntimeOptions, 'prompts' | 'structured'> & {
    promptSourceProvider?: string | undefined
    requestedSpeakerCount?: number | undefined
  }
): Promise<void> => {
  const instruction = await resolvePromptNames(options.prompts ?? [], {
    exampleFormat: options.structured === false ? 'markdown' : 'json'
  })
  const promptContent = buildPrompt(metadata, transcription, instruction, slug, {
    promptSourceProvider: options.promptSourceProvider,
    requestedSpeakerCount: options.requestedSpeakerCount
  })
  await Bun.write(`${outputDir}/prompt.md`, promptContent)
}

export const selectPrimaryPromptProvider = (
  successes: Array<ProviderSuccess | undefined>
): ProviderSuccess | undefined => {
  const candidates = successes
    .map((entry, index) => ({ entry, index }))
    .filter((entry): entry is { entry: PromptSelectionCandidate, index: number } => entry.entry !== undefined)

  if (candidates.length === 0) {
    return undefined
  }

  const scoreCandidate = (candidate: PromptSelectionCandidate): number => {
    const hasSpeakerLabels = candidate.result.segments.some((segment) =>
      typeof segment.speaker === 'string' && segment.speaker.length > 0
    )
    const hasRequestedDiarizationHint = candidate.target.diarizationOptions?.speakerCount !== undefined
      || (candidate.target.diarizationOptions?.knownSpeakerNames?.length ?? 0) > 0
    const hasDiarizationEnabled = candidate.target.diarizationOptions?.enabled === true
      || hasRequestedDiarizationHint

    return (hasSpeakerLabels ? 2 : 0) + (hasRequestedDiarizationHint ? 2 : 0) + (hasDiarizationEnabled ? 1 : 0)
  }

  return candidates
    .sort((left, right) => {
      const scoreDiff = scoreCandidate(right.entry) - scoreCandidate(left.entry)
      if (scoreDiff !== 0) {
        return scoreDiff
      }
      return left.index - right.index
    })[0]?.entry
}

const buildSingleStepSummaries = (
  acquisitionTimeMs: number,
  step2Metadata: Step2Metadata,
  actualCost: ReturnType<typeof computeActualCosts>
): StepTimingCost[] => [
  {
    label: 'Download',
    processingTime: acquisitionTimeMs,
    cost: 0
  },
  {
    label: 'Transcribe',
    providerModel: `${step2Metadata.transcriptionService === 'whisper' ? 'whisper.cpp' : step2Metadata.transcriptionService}/${step2Metadata.transcriptionModelName ?? step2Metadata.transcriptionModel}`,
    processingTime: step2Metadata.processingTime,
    cost: actualCost.steps.find((step) => step.step === 'stt')?.cost ?? 0
  }
]

export const filterEstimatedSttCosts = (
  estimate: ReturnType<typeof computeEstimatedCosts>
): ReturnType<typeof computeEstimatedCosts> => {
  const steps = estimate.steps.filter((step) => step.step === 'stt')
  return {
    totalCost: steps.reduce((sum, step) => sum + step.cost, 0),
    steps
  }
}

const writeSttMetadata = async (outputDir: string, metadataJson: string): Promise<void> => {
  const metadataPath = `${outputDir}/metadata.json`
  await Bun.write(metadataPath, metadataJson)
  l.info(`Metadata file: ${metadataPath}`)
  l.debug(`Metadata:\n${metadataJson}`)
}

export class SttPartialCompletionError extends Error {
  outputDir: string
  completionStatus: SttCompletionStatus
  missingProviders: SttRequestedProvider[]
  exitCode: number

  constructor(
    outputDir: string,
    completionStatus: SttCompletionStatus,
    missingProviders: SttRequestedProvider[],
    message: string
  ) {
    super(message)
    this.name = 'SttPartialCompletionError'
    this.outputDir = outputDir
    this.completionStatus = completionStatus
    this.missingProviders = missingProviders
    this.exitCode = 2
  }
}

export const isSttPartialCompletionError = (error: unknown): error is SttPartialCompletionError =>
  error instanceof SttPartialCompletionError

export const processStt = async (
  source: { url?: string, filePath?: string },
  baseDir: string,
  options: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  runOptions: ProcessSttRunOptions = {}
): Promise<string> => {
  const processStart = Date.now()
  const requestedTargets = runOptions.requestedTargets ?? collectSttTargets(options)
  const targetsToRun = runOptions.targetsToRun ?? requestedTargets
  const targetsToRunKeys = new Set(targetsToRun.map((target) => getTargetKey(target)))
  const outputBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : './output'
  const metadata = await resolveSttSourceMetadata(source)
  const outputDir = runOptions.outputDir ?? join(outputBaseDir, createUniqueDirectoryName(metadata.title))
  await ensureDirectory(outputDir)

  let prepared: Awaited<ReturnType<typeof prepareSttMedia>> | undefined

  try {
    const acquisitionStartedAt = Date.now()
    prepared = await runWithLogContext({ step: 'step-1-download' }, async () =>
      await prepareSttMedia({
        source,
        targets: requestedTargets,
        outputDir,
        noCache: options.noCache,
        refreshCache: options.refreshCache
      })
    )
    const acquisitionTimeMs = Date.now() - acquisitionStartedAt
    l.info(buildAcquireSummary(prepared.step1Metadata.slug, prepared))
    logSpeakerCountHintSummary(requestedTargets, options.diarizationSpeakerCount)

    if (requestedTargets.length === 1) {
      if (runOptions.outputDir) {
        throw CLIUsageError('--resume-missing-from currently supports only STT batches that originally requested multiple providers.')
      }

      const target = requestedTargets[0] as SttTarget
      const audioPath = resolveTargetAudioPath(target, prepared)
      const transcription = await runWithLogContext({ step: 'step-2-stt' }, async () =>
        await transcribeTarget(audioPath, outputDir, target, {
          split: options.split,
          reverbVerbatimicity: options.reverbVerbatimicity,
          sttSegmentConcurrency: options.sttSegmentConcurrency
        })
      )

      await buildPromptFile(outputDir, prepared.metadata, transcription.result, prepared.step1Metadata.slug, {
        prompts: options.prompts,
        structured: options.structured,
        promptSourceProvider: buildProviderModelLabel(transcription.metadata),
        requestedSpeakerCount: target.diarizationOptions?.speakerCount
      })

      const estimated = filterEstimatedSttCosts(resolveSttEstimatedCosts(preflightEstimate, requestedTargets, prepared.durationSeconds))
      const actual = computeActualCosts({
        step1: prepared.step1Metadata,
        step2: transcription.metadata
      })
      const cost = { estimated, actual }
      const estimatedTiming = computeEstimatedProcessingTimes({
        sttTargets: requestedTargets.map((entry) => ({ service: entry.service, model: entry.model })),
        audioDurationSeconds: prepared.durationSeconds
      })
      const actualTiming = computeActualProcessingTimes({
        audioDurationSeconds: prepared.durationSeconds,
        step2: transcription.metadata
      })
      const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
        ? { estimated: estimatedTiming, actual: actualTiming }
        : undefined

      const metadataJson = JSON.stringify({
        step1: prepared.step1Metadata,
        step2: transcription.metadata,
        completionStatus: 'full' as SttCompletionStatus,
        requestedProviders: requestedTargets.map(toRequestedProvider),
        providerStates: [{
          service: target.service,
          model: target.model,
          local: target.local,
          artifactDir: '.',
          status: 'succeeded',
          attempts: 1
        }],
        missingProviders: [],
        cost,
        ...(timing ? { timing } : {})
      }, null, 2)
      await writeSttMetadata(outputDir, metadataJson)

      const artifactFiles: Record<string, string> = {
        audio: prepared.step1Metadata.audioFileName,
        transcript: 'transcription.txt',
        prompt: 'prompt.md',
        metadata: 'metadata.json'
      }

      l.report.complete(outputDir, artifactFiles, {
        steps: buildSingleStepSummaries(acquisitionTimeMs, transcription.metadata, actual),
        totalTimeMs: Date.now() - processStart,
        totalCost: actual.totalCost
      })

      return outputDir
    }

    const providersDir = join(outputDir, 'providers')
    await mkdir(providersDir, { recursive: true })
    const existingRun = runOptions.outputDir
      ? await readExistingSttRun(outputDir, requestedTargets)
      : {
          successes: new Array<ProviderSuccess | undefined>(requestedTargets.length),
          providerStates: new Map<string, SttProviderState>()
        } satisfies ExistingSttRun
    const successes: Array<ProviderSuccess | undefined> = existingRun.successes
    const failuresByIndex = new Map<number, ProviderFailure>()
    const providerStateMap = new Map(existingRun.providerStates)
    const providerConcurrency = resolveEffectiveSttProviderConcurrency(options, requestedTargets)
    const batchCoordinator = runOptions.batchCoordinator
    logEffectiveProviderConcurrency(providerConcurrency, options.batchConcurrency)

    const markTargetSkipped = async (
      index: number,
      reason: SttBatchBlockedProviderReason
    ): Promise<void> => {
      const target = requestedTargets[index] as SttTarget
      const providerDir = join(providersDir, getSttTargetDirectoryName(target))
      const relativeDir = getProviderArtifactDir(target)
      const targetKey = getTargetKey(target)
      await mkdir(providerDir, { recursive: true })
      const skippedArtifacts = await writeSkippedProviderArtifact(providerDir, reason)
      providerStateMap.set(targetKey, {
        service: target.service,
        model: target.model,
        local: target.local,
        artifactDir: relativeDir,
        status: 'skipped',
        attempts: providerStateMap.get(targetKey)?.attempts ?? 0,
        retryable: reason.retryable,
        lastError: toRecordedProviderError({
          message: reason.message,
          retryable: reason.retryable,
          skipped: true,
          ...(reason.stage ? { stage: reason.stage } : {}),
          ...(typeof reason.status === 'number' ? { status: reason.status } : {}),
          errorFile: `${relativeDir}/${skippedArtifacts.errorFile}`
        } as Omit<ProviderFailure, 'index' | 'service' | 'model'>)
      })
      failuresByIndex.delete(index)
    }

    const runTargetAtIndex = async (
      index: number,
      attempt: 'initial' | 'recovery' = 'initial'
    ): Promise<void> => {
      const target = requestedTargets[index] as SttTarget
      const providerDirName = getSttTargetDirectoryName(target)
      const providerDir = join(providersDir, providerDirName)
      const relativeDir = getProviderArtifactDir(target)
      const targetKey = getTargetKey(target)
      const providerDecision = batchCoordinator
        ? await batchCoordinator.beforeProviderAttempt(target)
        : { action: 'run' as const }

      if (providerDecision.action === 'skip') {
        await markTargetSkipped(index, providerDecision.reason)
        return
      }

      const nextAttemptCount = (providerStateMap.get(targetKey)?.attempts ?? 0) + 1

      providerStateMap.set(targetKey, {
        service: target.service,
        model: target.model,
        local: target.local,
        artifactDir: relativeDir,
        status: 'missing',
        attempts: nextAttemptCount
      })

      if (attempt === 'recovery') {
        await rm(providerDir, { recursive: true, force: true })
      }
      await mkdir(providerDir, { recursive: true })

      try {
        const audioPath = resolveTargetAudioPath(target, prepared as PreparedSttMedia)
        const transcription = await runWithLogContext({ step: 'step-2-stt', provider: providerDirName }, async () =>
          await transcribeTarget(audioPath, providerDir, target, {
            split: options.split,
            reverbVerbatimicity: options.reverbVerbatimicity,
            sttSegmentConcurrency: options.sttSegmentConcurrency
          })
        )
        await Bun.write(join(providerDir, 'metadata.json'), JSON.stringify(transcription.metadata, null, 2))
        successes[index] = {
          target,
          metadata: transcription.metadata,
          result: transcription.result,
          relativeDir
        }
        batchCoordinator?.reportProviderResult(target)
        providerStateMap.set(targetKey, {
          service: target.service,
          model: target.model,
          local: target.local,
          artifactDir: relativeDir,
          status: 'succeeded',
          attempts: nextAttemptCount
        })
        failuresByIndex.delete(index)
      } catch (error) {
        const failure: ProviderFailure = {
          index,
          service: target.service,
          model: target.model,
          ...classifySttProviderFailure(error)
        }
        const rawResponse = extractProviderRawResponse(error)

        try {
          Object.assign(failure, await writeProviderFailureArtifacts(providerDir, failure, rawResponse))
        } catch (artifactError) {
          l.warn(`Failed to write STT provider diagnostics for ${target.service}/${target.model}: ${artifactError instanceof Error ? artifactError.message : String(artifactError)}`)
        }

        const batchBlockedFailure = shouldBlockSttProviderForBatch(failure)
          ? {
              service: target.service,
              model: target.model,
              local: target.local,
              message: failure.message,
              retryable: failure.retryable,
              ...(failure.stage ? { stage: failure.stage } : {}),
              ...(typeof failure.status === 'number' ? { status: failure.status } : {})
            } satisfies SttBatchBlockedProviderReason
          : undefined
        batchCoordinator?.reportProviderResult(target, batchBlockedFailure)

        providerStateMap.set(targetKey, {
          service: target.service,
          model: target.model,
          local: target.local,
          artifactDir: relativeDir,
          status: 'failed',
          attempts: nextAttemptCount,
          retryable: failure.retryable,
          lastError: toRecordedProviderError({
            message: failure.message,
            retryable: failure.retryable,
            ...(failure.stage ? { stage: failure.stage } : {}),
            ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
            ...(failure.errorFile ? { errorFile: `${relativeDir}/${failure.errorFile}` } : {}),
            ...(failure.rawResponseFile ? { rawResponseFile: `${relativeDir}/${failure.rawResponseFile}` } : {})
          })
        })
        failuresByIndex.set(index, failure)
      }
    }

    const localIndices = requestedTargets
      .map((target, index) => ({ target, index }))
      .filter((entry) => entry.target.local && targetsToRunKeys.has(getTargetKey(entry.target)))
      .map((entry) => entry.index)
    const cloudIndices = prioritizeCloudSttTargetIndices(requestedTargets)
      .filter((index) => targetsToRunKeys.has(getTargetKey(requestedTargets[index] as SttTarget)))

    await Promise.all([
      runTargetPool(localIndices, options.sttLocalConcurrency, runTargetAtIndex),
      runTargetPool(cloudIndices, providerConcurrency.effective, runTargetAtIndex)
    ])

    if (!batchCoordinator) {
      for (let pass = 1; pass <= STT_RECOVERY_MAX_PASSES; pass++) {
        const recoveryIndices = [...failuresByIndex.values()]
          .filter((failure) => failure.retryable)
          .map((failure) => failure.index)

        if (recoveryIndices.length === 0) {
          break
        }

        let recoveredCount = 0
        l.warn(`Retrying ${recoveryIndices.length} transient STT provider failure(s) serially (pass ${pass}/${STT_RECOVERY_MAX_PASSES}): ${recoveryIndices.map((index) => `${requestedTargets[index]!.service}/${requestedTargets[index]!.model}`).join(', ')}`)
        await runTargetPool(recoveryIndices, 1, async (index) => {
          const hadFailure = failuresByIndex.has(index)
          await runTargetAtIndex(index, 'recovery')
          if (hadFailure && !failuresByIndex.has(index)) {
            recoveredCount += 1
          }
        })

        if (recoveredCount === 0) {
          break
        }
      }
    }

    const successfulProviders = successes.filter((entry): entry is ProviderSuccess => entry !== undefined)
    const failures = [...failuresByIndex.values()].sort((left, right) => left.index - right.index)
    const completionStatus = resolveCompletionStatus(requestedTargets, successes)
    const providerStates = buildProviderStates(requestedTargets, successes, failuresByIndex, providerStateMap)
    const missingProviders = buildMissingProviders(providerStates, requestedTargets)
    const metadataErrors = buildMetadataErrorEntries(providerStates)

    const promptSource = selectPrimaryPromptProvider(successes)
    if (promptSource) {
      await buildPromptFile(outputDir, prepared.metadata, promptSource.result, prepared.step1Metadata.slug, {
        prompts: options.prompts,
        structured: options.structured,
        promptSourceProvider: buildProviderModelLabel(promptSource.metadata),
        requestedSpeakerCount: promptSource.target.diarizationOptions?.speakerCount
      })
    }

    const estimated = filterEstimatedSttCosts(resolveSttEstimatedCosts(preflightEstimate, requestedTargets, prepared.durationSeconds))
    const actual = computeActualCosts({
      step1: prepared.step1Metadata,
      step2: successfulProviders.map((entry) => entry.metadata)
    })
    const cost = {
      estimated,
      actual,
      aggregate: {
        estimatedTotalCost: estimated.totalCost,
        actualTotalCost: actual.totalCost
      }
    }
    const estimatedTiming = computeEstimatedProcessingTimes({
      sttTargets: requestedTargets.map((entry) => ({ service: entry.service, model: entry.model })),
      audioDurationSeconds: prepared.durationSeconds
    })
    const actualTiming = computeActualProcessingTimes({
      audioDurationSeconds: prepared.durationSeconds,
      step2: successfulProviders.map((entry) => entry.metadata)
    })
    const timing = {
      estimated: estimatedTiming,
      actual: actualTiming,
      aggregate: {
        wallTimeMs: Date.now() - processStart,
        providers: successfulProviders.map((entry) => ({
          service: entry.metadata.transcriptionService,
          model: entry.metadata.transcriptionModelName ?? entry.metadata.transcriptionModel,
          processingTimeMs: entry.metadata.processingTime
        }))
      }
    }

    const metadataJson = JSON.stringify({
      step1: prepared.step1Metadata,
      step2: successfulProviders.map((entry) => entry.metadata),
      completionStatus,
      requestedProviders: requestedTargets.map(toRequestedProvider),
      providerStates,
      missingProviders,
      cost,
      timing,
      cache: {
        sourceMedia: prepared.cache.sourceMedia
      },
      ...(metadataErrors.length > 0 ? { errors: metadataErrors } : {})
    }, null, 2)
    await writeSttMetadata(outputDir, metadataJson)

    const stepSummaries: StepTimingCost[] = [
      {
        label: 'Download',
        processingTime: acquisitionTimeMs,
        cost: 0
      },
      ...successfulProviders.map((entry) => ({
        label: 'Transcribe',
        providerModel: buildProviderModelLabel(entry.metadata),
        processingTime: entry.metadata.processingTime,
        cost: actual.steps.find((step) =>
          step.step === 'stt'
          && step.provider === entry.metadata.transcriptionService
          && step.model === (entry.metadata.transcriptionModelName ?? entry.metadata.transcriptionModel)
        )?.cost ?? 0
      }))
    ]

    if (completionStatus === 'full') {
      const artifactFiles: Record<string, string> = {
        prompt: 'prompt.md',
        metadata: 'metadata.json'
      }
      artifactFiles['audio'] = basename(prepared.outputArtifacts.sourceMediaPath)
      for (const entry of successfulProviders) {
        const dir = entry.relativeDir as string
        const key = `${entry.metadata.transcriptionService}-${entry.metadata.transcriptionModelName ?? entry.metadata.transcriptionModel}`
        artifactFiles[`transcript-${key}`] = `${dir}/transcription.txt`
        artifactFiles[`metadata-${key}`] = `${dir}/metadata.json`
      }

      l.report.complete(outputDir, artifactFiles, {
        metrics: {
          providersRequested: requestedTargets.length,
          providersSucceeded: successfulProviders.length,
          providersFailed: 0,
          partial: false,
          completionStatus,
          ...(promptSource
            ? { promptSource: buildProviderModelLabel(promptSource.metadata) }
            : {})
        },
        steps: stepSummaries,
        totalTimeMs: Date.now() - processStart,
        totalCost: actual.totalCost
      })

      return outputDir
    }

    l.warn(`stt run incomplete: completionStatus=${completionStatus}, missingProviders=${missingProviders.map(formatSttTargetLabel).join(', ')}`)
    if (failures.length > 0) {
      l.warn(`stt run completed with partial failures: ${failures.map(formatProviderFailure).join('; ')}`)
    }
    l.warn(`Output directory preserved for retry/backfill: ${outputDir}`)

    throw new SttPartialCompletionError(
      outputDir,
      completionStatus,
      missingProviders,
      completionStatus === 'failed'
        ? `All requested STT providers failed: ${failures.map(formatProviderFailure).join('; ')}`
        : `Missing STT provider outputs: ${missingProviders.map(formatSttTargetLabel).join(', ')}`
    )
  } finally {
    await prepared?.cleanup?.()
  }
}
