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
import { computeActualCosts, computeEstimatedCosts, preflightToEstimated } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { classifyFetchRetry } from '~/utils/retries'

type PreparedSttMedia = Awaited<ReturnType<typeof prepareSttMedia>>

type ProviderFailure = {
  index: number
  service: string
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

const createAllProvidersFailedError = (failures: ProviderFailure[]): Error => {
  const error = new Error(failures.map(formatProviderFailure).join('; '))
  ;(error as Error & { exitCode?: number }).exitCode = 2
  return error
}

export const processStt = async (
  source: { url?: string, filePath?: string },
  baseDir: string,
  options: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate
): Promise<string> => {
  const processStart = Date.now()
  const targets = collectSttTargets(options)
  const outputBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : './output'
  const metadata = await resolveSttSourceMetadata(source)
  const outputDir = join(outputBaseDir, createUniqueDirectoryName(metadata.title))
  await ensureDirectory(outputDir)

  let prepared: Awaited<ReturnType<typeof prepareSttMedia>> | undefined

  try {
    const acquisitionStartedAt = Date.now()
    prepared = await runWithLogContext({ step: 'step-1-download' }, async () =>
      await prepareSttMedia({
        source,
        targets,
        outputDir,
        noCache: options.noCache,
        refreshCache: options.refreshCache
      })
    )
    const acquisitionTimeMs = Date.now() - acquisitionStartedAt
    l.info(buildAcquireSummary(prepared.step1Metadata.slug, prepared))
    logSpeakerCountHintSummary(targets, options.diarizationSpeakerCount)

    if (targets.length === 1) {
      const target = targets[0] as SttTarget
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

      const estimated = filterEstimatedSttCosts(resolveSttEstimatedCosts(preflightEstimate, targets, prepared.durationSeconds))
      const actual = computeActualCosts({
        step1: prepared.step1Metadata,
        step2: transcription.metadata
      })
      const cost = { estimated, actual }
      const estimatedTiming = computeEstimatedProcessingTimes({
        sttTargets: targets.map((entry) => ({ service: entry.service, model: entry.model })),
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
    const successes: Array<ProviderSuccess | undefined> = new Array(targets.length)
    const failuresByIndex = new Map<number, ProviderFailure>()
    const providerConcurrency = resolveEffectiveSttProviderConcurrency(options, targets)
    logEffectiveProviderConcurrency(providerConcurrency, options.batchConcurrency)

    const runTargetAtIndex = async (
      index: number,
      attempt: 'initial' | 'recovery' = 'initial'
    ): Promise<void> => {
      const target = targets[index] as SttTarget
      const providerDirName = getSttTargetDirectoryName(target)
      const providerDir = join(providersDir, providerDirName)
      const relativeDir = `providers/${providerDirName}`
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

        failuresByIndex.set(index, failure)
      }
    }

    const localIndices = targets
      .map((target, index) => ({ target, index }))
      .filter((entry) => entry.target.local)
      .map((entry) => entry.index)
    const cloudIndices = prioritizeCloudSttTargetIndices(targets)

    await Promise.all([
      runTargetPool(localIndices, options.sttLocalConcurrency, runTargetAtIndex),
      runTargetPool(cloudIndices, providerConcurrency.effective, runTargetAtIndex)
    ])

    const recoveryIndices = [...failuresByIndex.values()]
      .filter((failure) => failure.retryable)
      .map((failure) => failure.index)

    if (recoveryIndices.length > 0) {
      l.warn(`Retrying ${recoveryIndices.length} transient STT provider failure(s) serially: ${recoveryIndices.map((index) => `${targets[index]!.service}/${targets[index]!.model}`).join(', ')}`)
      await runTargetPool(recoveryIndices, 1, async (index) => {
        await runTargetAtIndex(index, 'recovery')
      })
    }

    const successfulProviders = successes.filter((entry): entry is ProviderSuccess => entry !== undefined)
    const failures = [...failuresByIndex.values()].sort((left, right) => left.index - right.index)
    if (successfulProviders.length === 0) {
      throw createAllProvidersFailedError(failures)
    }

    const promptSource = selectPrimaryPromptProvider(successes)
    if (promptSource) {
      await buildPromptFile(outputDir, prepared.metadata, promptSource.result, prepared.step1Metadata.slug, {
        prompts: options.prompts,
        structured: options.structured,
        promptSourceProvider: buildProviderModelLabel(promptSource.metadata),
        requestedSpeakerCount: promptSource.target.diarizationOptions?.speakerCount
      })
    }

    const estimated = filterEstimatedSttCosts(resolveSttEstimatedCosts(preflightEstimate, targets, prepared.durationSeconds))
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
      sttTargets: targets.map((entry) => ({ service: entry.service, model: entry.model })),
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
      cost,
      timing,
      cache: {
        sourceMedia: prepared.cache.sourceMedia
      },
      ...(failures.length > 0
        ? {
            errors: failures.map((entry) => ({
              service: entry.service,
              model: entry.model,
              message: entry.message,
              ...(entry.stage ? { stage: entry.stage } : {}),
              ...(typeof entry.status === 'number' ? { status: entry.status } : {}),
              retryable: entry.retryable,
              ...(entry.errorFile ? { errorFile: `providers/${getSttTargetDirectoryName({ service: entry.service as SttTarget['service'], model: entry.model })}/${entry.errorFile}` } : {}),
              ...(entry.rawResponseFile ? { rawResponseFile: `providers/${getSttTargetDirectoryName({ service: entry.service as SttTarget['service'], model: entry.model })}/${entry.rawResponseFile}` } : {})
            }))
          }
        : {})
    }, null, 2)
    await writeSttMetadata(outputDir, metadataJson)

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

    l.report.complete(outputDir, artifactFiles, {
      metrics: {
        providersRequested: targets.length,
        providersSucceeded: successfulProviders.length,
        providersFailed: failures.length,
        partial: failures.length > 0,
        ...(promptSource
          ? { promptSource: buildProviderModelLabel(promptSource.metadata) }
          : {})
      },
      steps: stepSummaries,
      totalTimeMs: Date.now() - processStart,
      totalCost: actual.totalCost
    })

    if (failures.length > 0) {
      l.warn(`stt run completed with partial failures: ${failures.map(formatProviderFailure).join('; ')}`)
    }

    return outputDir
  } finally {
    await prepared?.cleanup?.()
  }
}
