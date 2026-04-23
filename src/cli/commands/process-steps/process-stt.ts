import { mkdir, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import * as l from '~/logger'
import { runWithLogContext } from '~/logger'
import type { StepTimingCost } from '~/logger'
import { ensureDirectory } from '~/utils/cli-utils'
import type {
  AggregatedPriceEstimate,
  EffectiveSttProviderConcurrency,
  ExistingSttRun,
  PreparedSttMedia,
  ProcessSttRunOptions,
  PromptSelectionCandidate,
  ProviderErrorLike,
  ProviderFailure,
  ResolvedStep2Execution,
  RuntimeOptions,
  Step2Metadata,
  SttBatchBlockedProviderReason,
  SttCompletionStatus,
  SttProviderState,
  SttProviderSuccess,
  SttTarget,
  TranscriptionResult
} from '~/types'
import { getSttEstimation } from '~/cli/commands/setup-and-utilities/models/model-loader'
import { reserveBatchChildOutputDir } from './batch-child-output'
import { createUniqueDirectoryName } from './step-1-download/audio/metadata-utils'
import { buildPrompt } from './step-3-write/write-utils/prompt-utils'
import { resolvePromptNames } from '~/prompts/prompt-loader'
import { collectSttTargets, formatSttTargetLabel, getSttTargetDirectoryName, getSttTargetKey } from './step-2-stt/stt-targets'
import { prepareSttMedia, resolveSttSourceMetadata } from './step-2-stt/media'
import { getSttEngineCapabilities, sttTarget } from './step-2-stt/orchestrator'
import { writeSttResultArtifact } from './step-2-stt/stt-utils/stt-result-artifacts'
import { mergeStep2TimingMetadata } from './step-2-stt/stt-timing-metadata'
import {
  buildMetadataErrorEntries,
  buildMissingProviders,
  buildProviderStates,
  getSttProviderArtifactDir,
  readExistingSttRun,
  resolveCompletionStatus,
  summarizeSttProviderStates,
  toRecordedProviderError,
  toRequestedProvider
} from './step-2-stt/stt-batch/stt-run-state'
import { writeSttRunManifest } from './step-2-stt/manifest'
import {
  describeSttBatchProviderSlotLimits,
  runCoordinatedSttTargetPool,
  SttPartialCompletionError
} from './step-2-stt/batch'
import { computeActualCosts, computeEstimatedCosts, preflightToEstimated } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { classifyFetchRetry, parseRetryAfterMs } from '~/utils/retries'
import {
  readStoredYoutubeCaptionSuccess,
  tryResolveYoutubeCaptionTranscription,
  YOUTUBE_CAPTIONS_SERVICE
} from './step-2-stt/youtube-captions'
import { createMistralSttPassController } from './step-2-stt/stt-services/mistral/mistral-stt-pass-controller'
import { logRunManifestLocation } from './write-manifest-log'
import { logLocationsTable } from '~/logger/human-table'
import {
  logSttAcquireSummary,
  logSttProviderConcurrency,
  logSttProviderFailures,
  logSttProviderSkips,
  logSttRunStatus
} from './step-2-stt/stt-logging'
import { buildSpeakerCountHintWarning } from './step-2-shared/inactive-flag-warnings'
import { resolveSttStep2Execution } from './step-2-shared/resolved-step2'

export { SttPartialCompletionError, isSttPartialCompletionError } from './step-2-stt/batch'
export type { SttCompletionStatus, SttProviderState, SttRequestedProvider } from '~/types'

const isProviderErrorLike = (value: unknown): value is ProviderErrorLike =>
  value instanceof Error

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
const RETRYABLE_DEADLINE_MESSAGE_PATTERN = /\bdeadline exceeded\b|\btimed out waiting for transcription completion\b/i

const emitInfoOnce = (key: string, emit: () => void): void => {
  if (emittedInfoMessages.has(key)) {
    return
  }

  emittedInfoMessages.add(key)
  emit()
}

const logWarnOnce = (message: string): void => {
  if (emittedWarnMessages.has(message)) {
    return
  }

  emittedWarnMessages.add(message)
  l.warn(message)
}

const resolveRecordedSttStep2 = (
  requestedTargets: Array<Pick<SttTarget, 'service' | 'model'>>,
  options: RuntimeOptions
): ResolvedStep2Execution => {
  const resolved = resolveSttStep2Execution(options)
  const resolvedProviders = resolved.route === 'stt' ? resolved.providers : []

  return {
    route: 'stt',
    sourceKind: 'media',
    providers: requestedTargets.map((target) => ({
      service: target.service,
      model: target.model,
      origin: resolvedProviders.find((provider) =>
        provider.service === target.service && provider.model === target.model
      )?.origin
    }))
  }
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
  const explicitRetryable = chain.find((entry) => typeof entry.retryable === 'boolean')?.retryable
  const skipped = chain.some((entry) => entry.skipped === true)
  const retryAfterMs = parseRetryAfterMs(headers)

  let retryable = false
  if (explicitRetryable !== undefined) {
    retryable = explicitRetryable
  } else if (RETRYABLE_DEADLINE_MESSAGE_PATTERN.test(message)) {
    retryable = true
  } else if (retryClass) {
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
    ...(skipped ? { skipped: true } : {}),
    ...(stage ? { stage } : {}),
    ...(typeof status === 'number' ? { status } : {}),
    ...(typeof retryAfterMs === 'number' ? { retryAfterMs } : {})
  }
}

const resolveTransientProviderCooldownMs = (
  failure: Pick<ProviderFailure, 'retryable' | 'status' | 'retryAfterMs' | 'stage' | 'message'>
): number | undefined => {
  if (!failure.retryable) {
    return undefined
  }

  if (typeof failure.retryAfterMs === 'number' && failure.retryAfterMs > 0) {
    return failure.retryAfterMs
  }

  if (failure.status === 429) {
    return 30_000
  }

  if (typeof failure.status === 'number' && failure.status >= 500) {
    return 10_000
  }

  if (failure.stage === 'poll' || RETRYABLE_DEADLINE_MESSAGE_PATTERN.test(failure.message)) {
    return 15_000
  }

  return 5_000
}

export const shouldBlockSttProviderForBatch = (
  failure: Pick<ProviderFailure, 'message' | 'retryable' | 'stage' | 'status' | 'skipped'>
): boolean => {
  if (failure.skipped === true) {
    return false
  }

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
    ...(typeof failure.retryAfterMs === 'number' ? { retryAfterMs: failure.retryAfterMs } : {}),
    ...(rawResponseFile ? { rawResponseFile } : {})
  }, null, 2))

  return {
    errorFile,
    ...(rawResponseFile ? { rawResponseFile } : {})
  }
}

const writeSkippedProviderArtifact = async (
  providerDir: string,
  reason: Pick<SttBatchBlockedProviderReason, 'service' | 'model' | 'message' | 'retryable' | 'stage' | 'status' | 'degraded'>,
  rawResponse?: unknown
): Promise<Pick<ProviderFailure, 'errorFile' | 'rawResponseFile'>> => {
  const errorFile = 'error.json'
  let rawResponseFile: string | undefined
  if (rawResponse !== undefined) {
    rawResponseFile = 'raw-response.json'
    await Bun.write(join(providerDir, rawResponseFile), toDiagnosticJson(rawResponse))
  }

  await Bun.write(join(providerDir, errorFile), JSON.stringify({
    service: reason.service,
    model: reason.model,
    message: reason.message,
    retryable: reason.retryable,
    skipped: true,
    ...(reason.stage ? { stage: reason.stage } : {}),
    ...(typeof reason.status === 'number' ? { status: reason.status } : {}),
    ...(reason.degraded === true ? { degraded: true } : {}),
    ...(rawResponseFile ? { rawResponseFile } : {})
  }, null, 2))

  return {
    errorFile,
    ...(rawResponseFile ? { rawResponseFile } : {})
  }
}

export const resolveEffectiveSttProviderConcurrency = (
  options: Pick<RuntimeOptions, 'batchConcurrency' | 'sttProviderConcurrency'>,
  targets: Pick<SttTarget, 'local'>[]
): EffectiveSttProviderConcurrency => {
  const requested = Math.max(1, options.sttProviderConcurrency)
  const hostedProviderCount = targets.filter((target) => !target.local).length

  return {
    requested,
    effective: requested,
    hostedProviderCount
  }
}

export const logSpeakerCountHintSummary = (
  targets: SttTarget[],
  requestedSpeakerCount: number | undefined
): void => {
  const warning = buildSpeakerCountHintWarning(
    targets,
    requestedSpeakerCount,
    (target) => getSttEngineCapabilities(target.service).supportsSpeakerCountHint,
    formatSttTargetLabel
  )
  if (warning) {
    logWarnOnce(warning)
  }
}

const logEffectiveProviderConcurrency = (
  resolution: EffectiveSttProviderConcurrency,
  batchConcurrency: number,
  coordinatedAcrossBatch: boolean,
  targets: SttTarget[]
): void => {
  if (resolution.hostedProviderCount <= 1) {
    return
  }

  const providerSlots = describeSttBatchProviderSlotLimits(targets, batchConcurrency)
  const dedupeKey = [
    coordinatedAcrossBatch ? 'batch_scheduler' : 'cloud_provider_concurrency',
    resolution.requested,
    resolution.effective,
    batchConcurrency,
    resolution.hostedProviderCount,
    providerSlots
  ].join(':')

  emitInfoOnce(dedupeKey, () => {
    logSttProviderConcurrency(
      l,
      resolution,
      batchConcurrency,
      coordinatedAcrossBatch,
      providerSlots
    )
  })
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

const formatProviderStateIssue = (
  state: Pick<SttProviderState, 'service' | 'model' | 'lastError'>
): string => {
  const label = formatSttTargetLabel(state)
  return state.lastError?.message ? `${label}: ${state.lastError.message}` : label
}

const withMergedStep2Timings = (
  metadata: Step2Metadata,
  ...timings: Array<Step2Metadata['timings']>
): Step2Metadata => {
  const mergedTimings = mergeStep2TimingMetadata([metadata.timings, ...timings])
  if (!mergedTimings) {
    return metadata
  }

  return {
    ...metadata,
    timings: mergedTimings
  }
}

export const filterSttPreflightEstimate = (
  estimate: AggregatedPriceEstimate
): AggregatedPriceEstimate => {
  const steps = estimate.steps.filter((step) => step.step === 'stt')
  return {
    steps,
    totalEstimatedCost: steps.reduce((sum, step) => sum + step.totalCost, 0),
    ...(estimate.notes && estimate.notes.length > 0 ? { notes: estimate.notes } : {})
  }
}

const filterSttPreflightEstimateByTargets = (
  estimate: AggregatedPriceEstimate,
  targets: SttTarget[]
): AggregatedPriceEstimate => {
  const targetKeys = new Set(targets.map(getSttTargetKey))
  const steps = estimate.steps.filter((step) =>
    step.step === 'stt' && targetKeys.has(`${step.provider}:${step.model}`)
  )

  return {
    steps,
    totalEstimatedCost: steps.reduce((sum, step) => sum + step.totalCost, 0),
    ...(estimate.notes && estimate.notes.length > 0 ? { notes: estimate.notes } : {})
  }
}

const resolveSttEstimatedCosts = (
  preflightEstimate: AggregatedPriceEstimate | undefined,
  targets: SttTarget[],
  durationSeconds: number
) => preflightEstimate
  ? preflightToEstimated(filterSttPreflightEstimateByTargets(preflightEstimate, targets))
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

export const buildProviderModelLabel = (
  metadata: Pick<Step2Metadata, 'transcriptionService' | 'transcriptionModel'>
): string => {
  const provider = metadata.transcriptionService === 'whisper' ? 'whisper.cpp' : metadata.transcriptionService
  const model = metadata.transcriptionService === 'whisper'
    ? basename(metadata.transcriptionModel.split(' | ')[0] ?? metadata.transcriptionModel)
      .replace(/^ggml-/, '')
      .replace(/\.bin$/, '')
    : metadata.transcriptionModel

  return `${provider}/${model}`
}

export const buildTimingProviderModelLabel = (
  metadata: Pick<Step2Metadata, 'transcriptionService' | 'transcriptionModel'>
): string => {
  if (metadata.transcriptionService !== 'whisper') {
    return buildProviderModelLabel(metadata)
  }

  const whisperModelPath = metadata.transcriptionModel.split(' | ')[0] ?? metadata.transcriptionModel
  return `whisper/${basename(whisperModelPath)}`
}

const buildPromptFile = async (
  outputDir: string,
  metadata: PreparedSttMedia['metadata'],
  transcription: TranscriptionResult,
  slug: string,
  options: Pick<RuntimeOptions, 'prompts'> & {
    promptSourceProvider?: string | undefined
    requestedSpeakerCount?: number | undefined
    suppressDiarizationLog?: boolean | undefined
  }
): Promise<void> => {
  const instruction = await resolvePromptNames(options.prompts ?? [], {
    exampleFormat: 'json'
  })
  const promptContent = buildPrompt(metadata, transcription, instruction, slug, {
    promptSourceProvider: options.promptSourceProvider,
    requestedSpeakerCount: options.requestedSpeakerCount,
    suppressDiarizationLog: options.suppressDiarizationLog
  })
  await Bun.write(`${outputDir}/prompt.md`, promptContent)
}

export const scorePromptSelectionCandidate = (
  candidate: PromptSelectionCandidate
): number => {
  const hasSpeakerLabels = candidate.result.segments.some((segment) =>
    typeof segment.speaker === 'string' && segment.speaker.length > 0
  )
  const hasRequestedDiarizationHint = candidate.target.diarizationOptions?.speakerCount !== undefined
  const hasDiarizationEnabled = candidate.target.diarizationOptions?.enabled === true
    || hasRequestedDiarizationHint

  return (hasSpeakerLabels ? 2 : 0) + (hasRequestedDiarizationHint ? 2 : 0) + (hasDiarizationEnabled ? 1 : 0)
}

export const selectPrimaryPromptProvider = (
  successes: Array<SttProviderSuccess | undefined>
): SttProviderSuccess | undefined => {
  const candidates = successes
    .map((entry, index) => ({ entry, index }))
    .filter((entry): entry is { entry: PromptSelectionCandidate, index: number } => entry.entry !== undefined)

  if (candidates.length === 0) {
    return undefined
  }

  return candidates
    .sort((left, right) => {
      const scoreDiff = scorePromptSelectionCandidate(right.entry) - scorePromptSelectionCandidate(left.entry)
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
    providerModel: buildTimingProviderModelLabel(step2Metadata),
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

export const processStt = async (
  source: { url?: string, filePath?: string },
  baseDir: string,
  options: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  runOptions: ProcessSttRunOptions = {}
): Promise<string> => {
  const processStart = Date.now()
  const requestedTargets = runOptions.requestedTargets ?? collectSttTargets(options)
  const mistralPassController = runOptions.mistralPassController
    ?? (requestedTargets.some((target) => target.service === 'mistral')
      ? createMistralSttPassController()
      : undefined)
  const targetsToRun = runOptions.targetsToRun ?? requestedTargets
  const targetsToRunKeys = new Set(targetsToRun.map((target) => getSttTargetKey(target)))
  const outputBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : './output'
  const metadata = await resolveSttSourceMetadata(source)
  const batchChildOutputDir = runOptions.outputDir === undefined
    ? await reserveBatchChildOutputDir(runOptions.batchChildContext, {
        title: metadata.title,
        publishedAt: metadata.publishDate,
        fallbackLabel: metadata.title
      })
    : undefined
  const outputDir = runOptions.outputDir ?? batchChildOutputDir ?? join(outputBaseDir, createUniqueDirectoryName(metadata.title))
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
    const preparedStepMedia = prepared
    const acquisitionTimeMs = Date.now() - acquisitionStartedAt
    logSttAcquireSummary(l, {
      item: preparedStepMedia.step1Metadata.slug,
      sourceMedia: preparedStepMedia.cache.sourceMedia,
      elapsedMs: acquisitionTimeMs
    })
    logSpeakerCountHintSummary(requestedTargets, options.diarizationSpeakerCount)

    if (options.youtubeCaptions && source.url) {
      const captionTranscription = await readStoredYoutubeCaptionSuccess(outputDir)
        ?? await tryResolveYoutubeCaptionTranscription(source.url, outputDir, preparedStepMedia.sourceVideoInfo)

      if (captionTranscription) {
        if (requestedTargets.length > 0) {
          l.info(`YouTube captions selected; skipping requested STT providers: ${requestedTargets.map(formatSttTargetLabel).join(', ')}`)
        }

        await buildPromptFile(outputDir, preparedStepMedia.metadata, captionTranscription.result, preparedStepMedia.step1Metadata.slug, {
          prompts: options.prompts,
          promptSourceProvider: buildProviderModelLabel(captionTranscription.metadata)
        })

        const estimated = filterEstimatedSttCosts(resolveSttEstimatedCosts(preflightEstimate, [captionTranscription.target], preparedStepMedia.durationSeconds))
        const actual = computeActualCosts({
          step1: preparedStepMedia.step1Metadata,
          step2: captionTranscription.metadata
        })
        const cost = { estimated, actual }
        const estimatedTiming = computeEstimatedProcessingTimes({
          sttTargets: [{
            service: captionTranscription.target.service,
            model: captionTranscription.target.model
          }],
          audioDurationSeconds: preparedStepMedia.durationSeconds
        })
        const actualTiming = computeActualProcessingTimes({
          audioDurationSeconds: preparedStepMedia.durationSeconds,
          step2: captionTranscription.metadata
        })
        const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
          ? { estimated: estimatedTiming, actual: actualTiming }
          : undefined

        const metadataJson = JSON.stringify({
          step1: preparedStepMedia.step1Metadata,
          step2: captionTranscription.metadata,
          resolvedStep2: resolveRecordedSttStep2([captionTranscription.target], options),
          completionStatus: 'full' as SttCompletionStatus,
          requestedProviders: [toRequestedProvider(captionTranscription.target)],
          providerStates: [{
            service: captionTranscription.target.service,
            model: captionTranscription.target.model,
            local: captionTranscription.target.local,
            artifactDir: captionTranscription.relativeDir ?? '.',
            status: 'succeeded',
            attempts: 1
          }],
          missingProviders: [],
          cost,
          ...(timing ? { timing } : {})
        }, null, 2)
        await writeSttRunManifest(outputDir, JSON.parse(metadataJson) as Record<string, unknown>)
        logRunManifestLocation(outputDir, l, 'stt')
        l.debug(`Run manifest:\n${metadataJson}`)

        const artifactFiles: Record<string, string> = {
          audio: preparedStepMedia.step1Metadata.audioFileName,
          transcript: 'transcription.txt',
          result: 'result.json',
          captions: 'youtube-captions.vtt',
          captionMetadata: 'youtube-captions.json',
          prompt: 'prompt.md',
          run: 'run.json'
        }

        l.report.complete(outputDir, artifactFiles, {
          steps: buildSingleStepSummaries(acquisitionTimeMs, captionTranscription.metadata, actual),
          totalTimeMs: Date.now() - processStart,
          totalCost: actual.totalCost
        })

        return outputDir
      }
    }

    if (requestedTargets.length === 1 && requestedTargets[0]?.service !== 'supadata') {
      const target = requestedTargets[0] as SttTarget
      const audioPath = resolveTargetAudioPath(target, preparedStepMedia)
      const audioDurationSeconds = preparedStepMedia.durationSeconds
      const transcription = await runWithLogContext({ step: 'step-2-stt' }, async () =>
        await sttTarget(audioPath, outputDir, target, {
          split: options.split,
          reverbVerbatimicity: options.reverbVerbatimicity,
          sttSegmentConcurrency: options.sttSegmentConcurrency,
          audioDurationSeconds,
          sourceUrl: preparedStepMedia.step1Metadata.url,
          language: options.supadataLang,
          happyscribeOrganizationId: options.happyscribeOrganizationId,
          ...(mistralPassController ? { mistralPassController } : {})
        })
      )

      await buildPromptFile(outputDir, preparedStepMedia.metadata, transcription.result, preparedStepMedia.step1Metadata.slug, {
        prompts: options.prompts,
        promptSourceProvider: buildProviderModelLabel(transcription.metadata),
        requestedSpeakerCount: target.diarizationOptions?.speakerCount
      })

      const estimated = filterEstimatedSttCosts(resolveSttEstimatedCosts(preflightEstimate, requestedTargets, preparedStepMedia.durationSeconds))
      const actual = computeActualCosts({
        step1: preparedStepMedia.step1Metadata,
        step2: transcription.metadata
      })
      const cost = { estimated, actual }
      const estimatedTiming = computeEstimatedProcessingTimes({
        sttTargets: requestedTargets.map((entry) => ({ service: entry.service, model: entry.model })),
        audioDurationSeconds: preparedStepMedia.durationSeconds
      })
      const actualTiming = computeActualProcessingTimes({
        audioDurationSeconds: preparedStepMedia.durationSeconds,
        step2: transcription.metadata
      })
      const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
        ? { estimated: estimatedTiming, actual: actualTiming }
        : undefined

      const metadataJson = JSON.stringify({
        step1: prepared.step1Metadata,
        step2: transcription.metadata,
        resolvedStep2: resolveRecordedSttStep2(requestedTargets, options),
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
      await writeSttRunManifest(outputDir, JSON.parse(metadataJson) as Record<string, unknown>)
      logRunManifestLocation(outputDir, l, 'stt')
      l.debug(`Run manifest:\n${metadataJson}`)

      const artifactFiles: Record<string, string> = {
        audio: prepared.step1Metadata.audioFileName,
        transcript: 'transcription.txt',
        result: 'result.json',
        prompt: 'prompt.md',
        run: 'run.json'
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
          successes: new Array<SttProviderSuccess | undefined>(requestedTargets.length),
          providerStates: new Map<string, SttProviderState>()
        } satisfies ExistingSttRun
    const successes: Array<SttProviderSuccess | undefined> = existingRun.successes
    const failuresByIndex = new Map<number, ProviderFailure>()
    const providerStateMap = new Map(existingRun.providerStates)
    const providerConcurrency = resolveEffectiveSttProviderConcurrency(options, requestedTargets)
    const batchCoordinator = runOptions.batchCoordinator
    const coordinatedAcrossBatch = batchCoordinator !== undefined && options.batchConcurrency > 1
    const preparedMedia = prepared as PreparedSttMedia
    logEffectiveProviderConcurrency(providerConcurrency, options.batchConcurrency, coordinatedAcrossBatch, requestedTargets)
    let promptRefreshChain = Promise.resolve()
    let promptRefreshError: unknown
    let lastPromptSourceKey: string | undefined
    let lastPromptScore = -1

    const queuePromptRefresh = (): void => {
      promptRefreshChain = promptRefreshChain
        .then(async () => {
          if (promptRefreshError !== undefined) {
            return
          }

          const promptSource = selectPrimaryPromptProvider(successes)
          if (!promptSource) {
            return
          }

          const promptSourceKey = getSttTargetKey(promptSource.target)
          const promptScore = scorePromptSelectionCandidate(promptSource)
          if (promptSourceKey === lastPromptSourceKey || promptScore <= lastPromptScore) {
            return
          }

          await buildPromptFile(outputDir, preparedMedia.metadata, promptSource.result, preparedMedia.step1Metadata.slug, {
            prompts: options.prompts,
            promptSourceProvider: buildProviderModelLabel(promptSource.metadata),
            requestedSpeakerCount: promptSource.target.diarizationOptions?.speakerCount,
            suppressDiarizationLog: coordinatedAcrossBatch
          })
          lastPromptSourceKey = promptSourceKey
          lastPromptScore = promptScore
        })
        .catch((error) => {
          promptRefreshError = error
        })
    }

    const markTargetSkipped = async (
      index: number,
      reason: Pick<SttBatchBlockedProviderReason, 'service' | 'model' | 'message' | 'retryable' | 'stage' | 'status' | 'degraded'>,
      options: {
        rawResponse?: unknown
        attempts?: number | undefined
      } = {}
    ): Promise<void> => {
      const target = requestedTargets[index] as SttTarget
      const providerDir = join(providersDir, getSttTargetDirectoryName(target))
      const relativeDir = getSttProviderArtifactDir(target)
      const targetKey = getSttTargetKey(target)
      await mkdir(providerDir, { recursive: true })
      const skippedArtifacts = await writeSkippedProviderArtifact(providerDir, reason, options.rawResponse)
      providerStateMap.set(targetKey, {
        service: target.service,
        model: target.model,
        local: target.local,
        artifactDir: relativeDir,
        status: 'skipped',
        attempts: options.attempts ?? providerStateMap.get(targetKey)?.attempts ?? 0,
        retryable: reason.retryable,
        lastError: toRecordedProviderError({
          message: reason.message,
          retryable: reason.retryable,
          skipped: true,
          ...(reason.stage ? { stage: reason.stage } : {}),
          ...(typeof reason.status === 'number' ? { status: reason.status } : {}),
          errorFile: `${relativeDir}/${skippedArtifacts.errorFile}`,
          ...(skippedArtifacts.rawResponseFile ? { rawResponseFile: `${relativeDir}/${skippedArtifacts.rawResponseFile}` } : {})
        } as Omit<ProviderFailure, 'index' | 'service' | 'model'>)
      })
      failuresByIndex.delete(index)
    }

    const runTargetAtIndex = async (
      index: number,
      attempt: 'initial' | 'recovery' = 'initial',
      queueWaitMs = 0
    ): Promise<void> => {
      const target = requestedTargets[index] as SttTarget
      const providerDirName = getSttTargetDirectoryName(target)
      const providerDir = join(providersDir, providerDirName)
      const relativeDir = getSttProviderArtifactDir(target)
      const targetKey = getSttTargetKey(target)
      const nextAttemptCount = (providerStateMap.get(targetKey)?.attempts ?? 0) + 1

      providerStateMap.set(targetKey, {
        service: target.service,
        model: target.model,
        local: target.local,
        artifactDir: relativeDir,
        status: 'missing',
        attempts: nextAttemptCount
      })

      try {
        if (attempt === 'recovery') {
          await rm(providerDir, { recursive: true, force: true })
        }
        await mkdir(providerDir, { recursive: true })

        const audioPath = resolveTargetAudioPath(target, prepared as PreparedSttMedia)
        if (runOptions.outputDir) {
          batchCoordinator?.noteBackfill(target)
        }
        let asyncJobReady = false
        const transcription = await runWithLogContext({ step: 'step-2-stt', provider: providerDirName }, async () =>
          await sttTarget(audioPath, providerDir, target, {
            split: options.split,
            reverbVerbatimicity: options.reverbVerbatimicity,
            sttSegmentConcurrency: options.sttSegmentConcurrency,
            audioDurationSeconds: preparedMedia.durationSeconds,
            sourceUrl: preparedMedia.step1Metadata.url,
            language: options.supadataLang,
            happyscribeOrganizationId: options.happyscribeOrganizationId,
            runMode: runOptions.outputDir ? 'backfill' : 'initial',
            ...(mistralPassController ? { mistralPassController } : {}),
            asyncLifecycle: batchCoordinator
              ? {
                  onJobReady: async () => {
                    if (asyncJobReady) {
                      return
                    }
                    asyncJobReady = true
                    batchCoordinator.releaseProviderSlot(target, { warmupSuccess: true })
                  },
                  withPollSlot: async <T,>(fn: () => Promise<T>): Promise<T> =>
                    await batchCoordinator.withPollSlot(target, fn)
                }
              : undefined
          })
        )
        const metadataWithQueueTiming = withMergedStep2Timings(
          transcription.metadata,
          queueWaitMs > 0 ? { queueWaitMs } : undefined
        )
        await writeSttResultArtifact(providerDir, metadataWithQueueTiming, transcription.result)
        successes[index] = {
          target,
          metadata: metadataWithQueueTiming,
          result: transcription.result,
          relativeDir
        }
        queuePromptRefresh()
        batchCoordinator?.reportProviderSuccess(target)
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

        if (failure.skipped === true) {
          batchCoordinator?.reportProviderFailure(target, failure)
          await markTargetSkipped(index, {
            service: target.service,
            model: target.model,
            message: failure.message,
            retryable: failure.retryable,
            ...(failure.stage ? { stage: failure.stage } : {}),
            ...(typeof failure.status === 'number' ? { status: failure.status } : {})
          }, {
            rawResponse,
            attempts: nextAttemptCount
          })
          return
        }

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
              ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
              degraded: false
            } satisfies SttBatchBlockedProviderReason
          : undefined
        batchCoordinator?.reportProviderFailure(target, failure, {
          blockedReason: batchBlockedFailure,
          cooldownMs: resolveTransientProviderCooldownMs(failure)
        })

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
            ...(typeof failure.retryAfterMs === 'number' ? { retryAfterMs: failure.retryAfterMs } : {}),
            ...(failure.errorFile ? { errorFile: `${relativeDir}/${failure.errorFile}` } : {}),
            ...(failure.rawResponseFile ? { rawResponseFile: `${relativeDir}/${failure.rawResponseFile}` } : {})
          })
        })
        failuresByIndex.set(index, failure)
      }
    }

    const localIndices = requestedTargets
      .map((target, index) => ({ target, index }))
      .filter((entry) => entry.target.local && targetsToRunKeys.has(getSttTargetKey(entry.target)))
      .map((entry) => entry.index)
    const cloudIndices = prioritizeCloudSttTargetIndices(requestedTargets)
      .filter((index) => targetsToRunKeys.has(getSttTargetKey(requestedTargets[index] as SttTarget)))

    await Promise.all([
      runTargetPool(localIndices, options.sttLocalConcurrency, runTargetAtIndex),
      batchCoordinator
        ? runCoordinatedSttTargetPool(
            cloudIndices,
            providerConcurrency.effective,
            requestedTargets,
            batchCoordinator,
            markTargetSkipped,
            async (index, queueWaitMs) => await runTargetAtIndex(index, 'initial', queueWaitMs)
          )
        : runTargetPool(cloudIndices, providerConcurrency.effective, runTargetAtIndex)
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

    const successfulProviders = successes.filter((entry): entry is SttProviderSuccess => entry !== undefined)
    const failures = [...failuresByIndex.values()].sort((left, right) => left.index - right.index)
    const providerStates = buildProviderStates(requestedTargets, successes, failuresByIndex, providerStateMap)
    const completionStatus = resolveCompletionStatus(providerStates)
    const providerStateSummary = summarizeSttProviderStates(providerStates)
    const applicableTargets = requestedTargets.filter((_, index) => providerStates[index]?.status !== 'skipped')
    const skippedProviderStates = providerStates.filter((state) => state.status === 'skipped')
    const incompleteProviderStates = providerStates.filter((state) => state.status === 'failed' || state.status === 'missing')
    const missingProviders = buildMissingProviders(providerStates, requestedTargets)
    const metadataErrors = buildMetadataErrorEntries(providerStates)
    const providerIssueMessages = incompleteProviderStates.map(formatProviderStateIssue)

    queuePromptRefresh()
    await promptRefreshChain
    if (promptRefreshError !== undefined) {
      throw promptRefreshError
    }

    const promptSource = selectPrimaryPromptProvider(successes)

    const estimated = filterEstimatedSttCosts(resolveSttEstimatedCosts(preflightEstimate, applicableTargets, prepared.durationSeconds))
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
      sttTargets: applicableTargets.map((entry) => ({ service: entry.service, model: entry.model })),
      audioDurationSeconds: prepared.durationSeconds
    })
    const actualTiming = computeActualProcessingTimes({
      audioDurationSeconds: prepared.durationSeconds,
      step2: successfulProviders.map((entry) => entry.metadata)
    })
    const schedulerSnapshot = batchCoordinator?.getSchedulerSnapshot()
    const timing = {
      estimated: estimatedTiming,
      actual: actualTiming,
      aggregate: {
        wallTimeMs: Date.now() - processStart,
        scheduler: {
          hostedProviderCount: providerConcurrency.hostedProviderCount,
          itemProviderConcurrency: providerConcurrency.effective,
          coordinatedAcrossBatch,
          ...(coordinatedAcrossBatch
            ? {
                providerSlots: describeSttBatchProviderSlotLimits(requestedTargets, options.batchConcurrency),
                ...(schedulerSnapshot ? { providerStats: schedulerSnapshot.providers } : {})
              }
            : {})
        },
        providers: successfulProviders.map((entry) => ({
          service: entry.metadata.transcriptionService,
          model: entry.metadata.transcriptionModel,
          processingTimeMs: entry.metadata.processingTime,
          ...(entry.metadata.timings ? { timings: entry.metadata.timings } : {})
        }))
      }
    }

    const metadataJson = JSON.stringify({
      step1: prepared.step1Metadata,
      step2: successfulProviders.map((entry) => entry.metadata),
      resolvedStep2: resolveRecordedSttStep2(requestedTargets, options),
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
    await writeSttRunManifest(outputDir, JSON.parse(metadataJson) as Record<string, unknown>)
    logRunManifestLocation(outputDir, l, 'stt')
    l.debug(`Run manifest:\n${metadataJson}`)

    const stepSummaries: StepTimingCost[] = [
      {
        label: 'Download',
        processingTime: acquisitionTimeMs,
        cost: 0
      },
      ...successfulProviders.map((entry) => ({
        label: 'Transcribe',
        providerModel: buildTimingProviderModelLabel(entry.metadata),
        processingTime: entry.metadata.processingTime,
        cost: actual.steps.find((step) =>
          step.step === 'stt'
          && step.provider === entry.metadata.transcriptionService
          && step.model === entry.metadata.transcriptionModel
        )?.cost ?? 0
      }))
    ]

    if (completionStatus === 'full') {
      logSttProviderSkips(l, skippedProviderStates)
      const artifactFiles: Record<string, string> = {
        prompt: 'prompt.md',
        run: 'run.json'
      }
      artifactFiles['audio'] = basename(prepared.outputArtifacts.sourceMediaPath)
      if (successfulProviders.some((entry) => entry.metadata.transcriptionService === YOUTUBE_CAPTIONS_SERVICE)) {
        artifactFiles['captions'] = 'youtube-captions.vtt'
        artifactFiles['captionMetadata'] = 'youtube-captions.json'
      }
      for (const entry of successfulProviders) {
        const dir = entry.relativeDir as string
        const key = `${entry.metadata.transcriptionService}-${entry.metadata.transcriptionModel}`
        artifactFiles[`transcript-${key}`] = `${dir}/transcription.txt`
        artifactFiles[`result-${key}`] = `${dir}/result.json`
      }

      l.report.complete(outputDir, artifactFiles, {
        metrics: {
          providersRequested: requestedTargets.length,
          providersSucceeded: providerStateSummary.succeeded,
          providersFailed: 0,
          providersSkipped: providerStateSummary.skipped,
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

    logSttRunStatus(l, {
      completionStatus,
      requested: requestedTargets.length,
      succeeded: providerStateSummary.succeeded,
      failed: providerStateSummary.failed,
      missing: missingProviders.length,
      skipped: providerStateSummary.skipped
    })
    logSttProviderFailures(l, failures)
    logSttProviderSkips(l, skippedProviderStates)
    l.warn('Output directory preserved for retry/backfill')
    logLocationsTable(l, [{ artifact: 'retryOutputDir', path: outputDir }], { level: 'warn' })

    throw new SttPartialCompletionError(
      outputDir,
      completionStatus,
      missingProviders,
      completionStatus === 'failed'
        ? failures.length > 0
          ? `All applicable STT providers failed: ${failures.map(formatProviderFailure).join('; ')}`
          : providerIssueMessages.length > 0
            ? `No requested STT provider produced a transcript: ${providerIssueMessages.join('; ')}`
            : 'No requested STT provider produced a transcript.'
        : providerIssueMessages.length > 0
          ? `Missing STT provider outputs: ${providerIssueMessages.join('; ')}`
          : missingProviders.length > 0
            ? `Missing STT provider outputs: ${missingProviders.map(formatSttTargetLabel).join(', ')}`
            : 'Missing STT provider outputs.'
    )
  } finally {
    await prepared?.cleanup?.()
  }
}
