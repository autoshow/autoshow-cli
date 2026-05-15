import { mkdir, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type {
  AggregatedPriceEstimate,
  ExistingSttRun,
  PreparedSttMedia,
  ProcessSttRunOptions,
  ProviderFailure,
  RuntimeOptions,
  StepTimingCost,
  SttBatchBlockedProviderReason,
  SttProviderState,
  SttProviderSuccess,
  SttTarget
} from '~/types'
import type { MistralSttPassController } from '../stt-services/mistral/mistral-stt-pass-controller'
import * as l from '~/utils/logger'
import { runWithLogContext } from '~/utils/logger'
import { logLocationsTable } from '~/utils/logger/human-table'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { logRunManifestLocation } from '../../../write-manifest-log'
import {
  describeSttBatchProviderSlotLimits,
  runCoordinatedSttTargetPool,
  SttPartialCompletionError
} from '../batch'
import { writeSttRunManifest } from '../manifest'
import { sttTarget } from '../run-stt'
import {
  formatSttTargetLabel,
  getSttTargetDirectoryName,
  getSttTargetKey
} from '../stt-targets'
import { writeSttResultArtifact } from '../stt-utils/stt-result-artifacts'
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
} from '../stt-batch/stt-run-state'
import {
  buildPromptFile,
  buildProviderModelLabel,
  buildTimingProviderModelLabel,
  scorePromptSelectionCandidate,
  selectPrimaryPromptProvider
} from '../stt-prompt'
import {
  filterEstimatedSttCosts,
  resolveSttEstimatedCosts
} from '../stt-costs'
import {
  classifySttProviderFailure,
  extractProviderRawResponse,
  formatProviderFailure,
  resolveTransientProviderCooldownMs,
  shouldBlockSttProviderForBatch,
  writeProviderFailureArtifacts,
  writeSkippedProviderArtifact
} from '../stt-provider-failures'
import {
  logEffectiveProviderConcurrency,
  prioritizeCloudSttTargetIndices,
  resolveEffectiveSttProviderConcurrency,
  runTargetPool
} from '../stt-provider-pool'
import {
  logSttProviderFailures,
  logSttProviderSkips,
  logSttRecoveryPass,
  logSttRunStatus
} from '../stt-logging'
import { YOUTUBE_CAPTIONS_SERVICE } from '../youtube-captions'
import {
  formatProviderStateIssue,
  resolveRecordedSttStep2,
  resolveTargetAudioPath,
  withMergedStep2Timings
} from './recorded-step2'

const STT_RECOVERY_MAX_PASSES = 3

type MultiProviderBatchContext = {
  outputDir: string
  requestedTargets: SttTarget[]
  targetsToRunKeys: Set<string>
  options: RuntimeOptions
  preflightEstimate?: AggregatedPriceEstimate | undefined
  prepared: PreparedSttMedia
  acquisitionTimeMs: number
  processStart: number
  runOptions: ProcessSttRunOptions
  mistralPassController?: MistralSttPassController | undefined
}

export const runMultiProviderSttBatch = async ({
  outputDir,
  requestedTargets,
  targetsToRunKeys,
  options,
  preflightEstimate,
  prepared,
  acquisitionTimeMs,
  processStart,
  runOptions,
  mistralPassController
}: MultiProviderBatchContext): Promise<string> => {
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
  const preparedMedia = prepared
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
          promptMd: options.promptMd,
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

      const audioPath = resolveTargetAudioPath(target, prepared)
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
          language: target.service === 'scrapecreators' ? options.scrapecreatorsLang : options.supadataLang,
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
      logSttRecoveryPass(l, {
        pass,
        maxPasses: STT_RECOVERY_MAX_PASSES,
        retryableFailures: recoveryIndices.length,
        providers: recoveryIndices.map((index) => `${requestedTargets[index]!.service}/${requestedTargets[index]!.model}`).join(', ')
      })
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

  const estimated = filterEstimatedSttCosts(resolveSttEstimatedCosts(preflightEstimate, applicableTargets, prepared.durationSeconds, prepared.step1Metadata.url))
  const actual = computeActualCosts({
    step1: prepared.step1Metadata,
    step2: successfulProviders.map((entry) => entry.metadata),
    audioDurationSeconds: prepared.durationSeconds
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
  logRunManifestLocation(outputDir, l, 'extract')
  l.debug(`Run manifest:\n${metadataJson}`)

  const actualSttSteps = actual.steps.filter((step) => step.step === 'stt')
  const stepSummaries: StepTimingCost[] = [
    {
      label: 'Download',
      processingTime: acquisitionTimeMs,
      cost: 0
    },
    ...successfulProviders.map((entry, index) => ({
      label: 'Transcribe',
      providerModel: buildTimingProviderModelLabel(entry.metadata),
      processingTime: entry.metadata.processingTime,
      cost: actualSttSteps[index]?.cost ?? 0
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
}
