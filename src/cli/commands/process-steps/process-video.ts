import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  ProcessingOptions,
  Step1Metadata,
  VideoMetadata,
  Step3Metadata,
  Step4Metadata,
  Step5Metadata,
  Step6VideoMetadata,
  Step7MusicMetadata,
  AggregatedPriceEstimate,
  RuntimeOptions,
  Step2Metadata,
  StepTimingCost,
  SttCompletionStatus,
  SttProviderSuccess,
  SttTarget,
  TranscriptionResult,
  ProcessVideoRuntimeOptions,
  StructuredRunResult,
} from '~/types'
import * as l from '~/utils/logger'
import { runWithLogContext } from '~/utils/logger'
import { createHumanTable, logLocationsTable } from '~/utils/logger/human-table'
import { ensureDirectory } from '~/utils/cli-utils'
import { extractSourceMetadata, createUniqueDirectoryName } from './step-1-download/audio/metadata-utils'
import { sttTarget } from './step-2-extract/step-2-stt/orchestrator'
import { writeSttResultArtifact } from './step-2-extract/step-2-stt/stt-utils/stt-result-artifacts'
import { formatTranscriptText } from './step-2-extract/step-2-stt/stt-utils/stt-utils'
import { collectSttTargets, getSttTargetDirectoryName, getSttTargetKey } from './step-2-extract/step-2-stt/stt-targets'
import { prepareSttMedia } from './step-2-extract/step-2-stt/media'
import { runLLM } from './step-3-write/run-llm'
import { buildPrompt } from './step-3-write/write-utils/prompt-utils'
import { writeRenderedTextArtifacts } from './step-3-write/text-input-utils'
import { resolvePromptNames } from '~/prompts/prompt-loader'
import { runTts } from './step-4-tts/run-tts'
import { buildEstimatedTtsTargets, buildTtsArtifactMap, collectTtsTargets } from './step-4-tts/tts-targets'
import { buildImageArtifactMap, collectImageTargets, getExpectedImageCount } from './step-5-image/image-targets'
import { runImageGen } from './step-5-image/run-image-gen'
import { runVideoGen } from './step-6-video/run-video-gen'
import { buildVideoArtifactMap, collectVideoTargets } from './step-6-video/video-targets'
import { runMusicGen } from './step-7-music/run-music-gen'
import { buildMusicArtifactMap, collectMusicTargets } from './step-7-music/music-targets'
import { buildProviderStepSummaries } from './generation-command-utils'
import { computeActualCosts } from '~/utils/pricing/compute-actual-costs'
import { computeEstimatedCosts } from '~/utils/pricing/compute-estimated-costs'
import { preflightToEstimated } from '~/utils/pricing/compute-costs'
import { computeActualProcessingTimes, computeEstimatedProcessingTimes } from '~/utils/pricing/compute-processing-time'
import { serializeOneOrMany } from './target-runner'
import {
  buildProviderModelLabel,
  buildTimingProviderModelLabel,
  classifySttProviderFailure,
  logSpeakerCountHintSummary,
  prioritizeCloudSttTargetIndices,
  selectPrimaryPromptProvider
} from './step-2-extract/step-2-stt/process-stt'
import { writeRunManifest } from './manifest-utils'
import { logWriteManifestConsoleSummary } from './write-manifest-log'
import { tryResolveYoutubeCaptionTranscription, YOUTUBE_CAPTIONS_SERVICE } from './step-2-extract/step-2-stt/youtube-captions'
import { createMistralSttPassController } from './step-2-extract/step-2-stt/stt-services/mistral/mistral-stt-pass-controller'
import { getOutputRoot } from './output-root'

const toRequestedProvider = (
  target: Pick<SttTarget, 'service' | 'model'>
): { service: string, model: string } => ({
  service: target.service,
  model: target.model
})

const resolveWriteSttCompletionStatus = (
  requestedTargets: SttTarget[],
  successes: SttProviderSuccess[]
): SttCompletionStatus => {
  if (successes.length === 0) {
    return 'failed'
  }

  return successes.length === requestedTargets.length ? 'full' : 'incomplete'
}

const runTargetPool = async (
  indices: number[],
  concurrency: number,
  worker: (index: number) => Promise<void>
): Promise<void> => {
  const normalizedConcurrency = Math.max(1, concurrency)
  let nextIndex = 0

  const runWorker = async (): Promise<void> => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= indices.length) {
        return
      }
      await worker(indices[currentIndex] as number)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(normalizedConcurrency, indices.length) }, async () => {
      await runWorker()
    })
  )
}

export const processVideo = async (
  options: ProcessingOptions,
  precomputedMetadata?: VideoMetadata,
  preflightEstimate?: AggregatedPriceEstimate,
  runtimeOptions?: ProcessVideoRuntimeOptions
): Promise<string> => {
  const processStart = Date.now()
  const metadata = precomputedMetadata ?? await extractSourceMetadata({
    ...(options.url !== undefined ? { url: options.url } : {}),
    ...(options.filePath !== undefined ? { filePath: options.filePath } : {})
  })
  const baseDir = options.outputDir && options.outputDir.trim().length > 0
    ? options.outputDir
    : runtimeOptions?.outputRootDir ?? getOutputRoot()
  const outputDir = runtimeOptions?.outputDir ?? `${baseDir}/${createUniqueDirectoryName(metadata.title)}`
  await ensureDirectory(outputDir)
  const processingOptions: ProcessingOptions = {
    ...options,
    outputDir
  }
  const sttTargets = collectSttTargets(processingOptions as unknown as RuntimeOptions)
  const mistralPassController = sttTargets.some((target) => target.service === 'mistral')
    ? createMistralSttPassController()
    : undefined
  let preparedSttMedia: Awaited<ReturnType<typeof prepareSttMedia>> | undefined
  let transcriptionResult: { result: TranscriptionResult, metadata: Step2Metadata | Step2Metadata[] } | undefined
  let successfulSttProviders: SttProviderSuccess[] = []
  let sttFailures: Array<{
    service: string
    model: string
    message: string
    retryable: boolean
    skipped?: boolean | undefined
    stage?: string | undefined
    status?: number | undefined
  }> = []

  try {
    const step1Start = Date.now()
    preparedSttMedia = await runWithLogContext({ step: 'step-1-download' }, async () =>
      await prepareSttMedia({
        source: {
          ...(options.url !== undefined ? { url: options.url } : {}),
          ...(options.filePath !== undefined ? { filePath: options.filePath } : {})
        },
        targets: sttTargets,
        outputDir,
        noCache: options.noCache,
        refreshCache: options.refreshCache
      })
    )
    const preparedMedia = preparedSttMedia
    const step1Time = Date.now() - step1Start
    const step1Metadata: Step1Metadata = preparedMedia.step1Metadata
    const sourceMetadata = preparedMedia.metadata
    const audioPath = preparedMedia.executionArtifacts.sourceMediaPath
    const mediaDurationSeconds = preparedMedia.durationSeconds
    logSpeakerCountHintSummary(sttTargets, processingOptions.diarizationSpeakerCount)

    if (processingOptions.youtubeCaptions && processingOptions.url) {
      const captionTranscription = await tryResolveYoutubeCaptionTranscription(
        processingOptions.url,
        outputDir,
        preparedMedia.sourceVideoInfo
      )

      if (captionTranscription) {
        if (sttTargets.length > 0) {
          l.write('info', 'STT Provider Skips', {
            category: 'pipeline',
            humanTable: createHumanTable(
              sttTargets.map((target) => ({
                provider: `${target.service}/${target.model}`,
                reason: 'youtube-captions'
              })),
              ['provider', 'reason']
            ),
            metadata: {
              reason: 'youtube-captions',
              skippedProviders: sttTargets.map((target) => `${target.service}/${target.model}`)
            }
          })
        }

        transcriptionResult = {
          result: captionTranscription.result,
          metadata: captionTranscription.metadata
        }
        successfulSttProviders = [captionTranscription]
      }
    }

    if (successfulSttProviders.length === 0 && sttTargets.length === 1 && sttTargets[0]?.service !== 'supadata') {
      const target = sttTargets[0] as SttTarget
      const audioDurationSeconds = preparedMedia.durationSeconds
      const singleTranscription = await runWithLogContext({ step: 'step-2-stt' }, async () =>
        await sttTarget(audioPath, outputDir, target, {
          split: processingOptions.split,
          reverbVerbatimicity: processingOptions.reverbVerbatimicity,
          sttSegmentConcurrency: runtimeOptions?.sttSegmentConcurrency,
          audioDurationSeconds,
          sourceUrl: preparedMedia.step1Metadata.url,
          language: processingOptions.supadataLang,
          ...(mistralPassController ? { mistralPassController } : {})
        })
      )
      transcriptionResult = singleTranscription
      successfulSttProviders = [{
        target,
        metadata: singleTranscription.metadata,
        result: singleTranscription.result
      }]
    } else if (successfulSttProviders.length === 0) {
      const providersDir = `${outputDir}/providers`
      const audioDurationSeconds = preparedMedia.durationSeconds
      await mkdir(providersDir, { recursive: true })

      const successes: Array<SttProviderSuccess | undefined> = new Array(sttTargets.length)
      const failuresByIndex = new Map<number, typeof sttFailures[number]>()

      const runTargetAtIndex = async (index: number): Promise<void> => {
        const target = sttTargets[index] as SttTarget
        const providerDirName = getSttTargetDirectoryName(target)
        const providerDir = `${providersDir}/${providerDirName}`
        await mkdir(providerDir, { recursive: true })

        try {
          const providerTranscription = await runWithLogContext({ step: 'step-2-stt', provider: providerDirName }, async () =>
            await sttTarget(audioPath, providerDir, target, {
              split: processingOptions.split,
              reverbVerbatimicity: processingOptions.reverbVerbatimicity,
              sttSegmentConcurrency: runtimeOptions?.sttSegmentConcurrency,
              audioDurationSeconds,
              sourceUrl: preparedMedia.step1Metadata.url,
              language: processingOptions.supadataLang,
              ...(mistralPassController ? { mistralPassController } : {})
            })
          )
          successes[index] = {
            target,
            metadata: providerTranscription.metadata,
            result: providerTranscription.result,
            relativeDir: `providers/${providerDirName}`
          }
          failuresByIndex.delete(index)
        } catch (error) {
          const failure = {
            service: target.service,
            model: target.model,
            ...classifySttProviderFailure(error)
          }

          if (failure.skipped === true) {
            await Bun.write(join(providerDir, 'error.json'), JSON.stringify({
              service: failure.service,
              model: failure.model,
              message: failure.message,
              retryable: failure.retryable,
              skipped: true,
              ...(failure.stage ? { stage: failure.stage } : {}),
              ...(typeof failure.status === 'number' ? { status: failure.status } : {})
            }, null, 2))
          } else {
            await rm(providerDir, { recursive: true, force: true })
          }

          failuresByIndex.set(index, failure)
        }
      }

      const localIndices = sttTargets
        .map((target, index) => ({ target, index }))
        .filter((entry) => entry.target.local)
        .map((entry) => entry.index)
      const cloudIndices = prioritizeCloudSttTargetIndices(sttTargets)

      await Promise.all([
        runTargetPool(localIndices, runtimeOptions?.sttLocalConcurrency ?? 1, runTargetAtIndex),
        runTargetPool(cloudIndices, runtimeOptions?.sttProviderConcurrency ?? 2, runTargetAtIndex)
      ])

      successfulSttProviders = successes.filter((entry): entry is SttProviderSuccess => entry !== undefined)
      sttFailures = [...failuresByIndex.values()]

      if (successfulSttProviders.length === 0) {
        await rm(providersDir, { recursive: true, force: true })
        throw new Error(sttFailures.map((failure) => `${failure.service}/${failure.model}: ${failure.message}`).join('; '))
      }

      const promptSource = selectPrimaryPromptProvider(successes)
      if (!promptSource) {
        throw new Error('No successful transcription provider available for the write pipeline')
      }

      await Bun.write(`${outputDir}/transcription.txt`, formatTranscriptText(promptSource.result.segments))
      await writeSttResultArtifact(outputDir, promptSource.metadata, promptSource.result)
      transcriptionResult = {
        result: promptSource.result,
        metadata: successfulSttProviders.map((entry) => entry.metadata)
      }
    }

    if (!transcriptionResult) {
      throw new Error('No transcription result was produced for the write pipeline')
    }
    const finalizedTranscriptionResult = transcriptionResult
    const promptSource = selectPrimaryPromptProvider(successfulSttProviders)
    const promptOptions = promptSource
      ? {
          promptSourceProvider: buildProviderModelLabel(promptSource.metadata),
          requestedSpeakerCount: promptSource.target.diarizationOptions?.speakerCount
        }
      : undefined

    let step3RunResults: StructuredRunResult[] = []
    let step3Results: Step3Metadata[] = []
    if (processingOptions.skipLLM) {
      await runWithLogContext({ step: 'step-3-write' }, async () => {
        const promptPath = `${outputDir}/prompt.md`
        const instruction = await resolvePromptNames(processingOptions.prompts ?? [], {
          exampleFormat: 'json'
        })
        const promptContent = buildPrompt(
          sourceMetadata,
          finalizedTranscriptionResult.result,
          instruction,
          step1Metadata.slug,
          promptOptions
        )
        await Bun.write(promptPath, promptContent)
      })
    } else {
      step3RunResults = await runWithLogContext({ step: 'step-3-write' }, async () =>
        await runLLM(sourceMetadata, finalizedTranscriptionResult.result, {
          ...processingOptions,
          promptBuilder: (instruction: string) =>
            buildPrompt(
              sourceMetadata,
              finalizedTranscriptionResult.result,
              instruction,
              step1Metadata.slug,
              promptOptions
            )
        }, step1Metadata.slug)
      )
      step3Results = step3RunResults.map((result) => result.metadata)
    }

    const renderedArtifacts = step3RunResults.length > 0
      ? await writeRenderedTextArtifacts({
          outputDir,
          results: step3RunResults,
          writeInternal: processingOptions.renderedText === true,
          sourcePath: options.filePath,
          trackListPath: processingOptions.trackList,
          externalDir: processingOptions.renderedOutDir,
          externalBaseName: step1Metadata.slug
        })
      : { internalArtifacts: {}, externalFiles: [] as string[] }

    if (renderedArtifacts.externalFiles.length > 0) {
      logLocationsTable(l, [{
        artifact: 'renderedOutDir',
        path: processingOptions.renderedOutDir,
        detail: `${renderedArtifacts.externalFiles.length} file${renderedArtifacts.externalFiles.length === 1 ? '' : 's'}`
      }])
    }

	    let step4Metadata: Step4Metadata[] | null = null
	    let step5Metadata: Step5Metadata[] | null = null
	    let step6Metadata: Step6VideoMetadata[] | null = null
	    let step7Metadata: Step7MusicMetadata[] | null = null
	    let ttsCharacterCount: number | undefined
	    const ttsTargets = collectTtsTargets(processingOptions)
	    const imageTargets = collectImageTargets(processingOptions)
	    const videoTargets = collectVideoTargets(processingOptions)
	    const musicTargets = collectMusicTargets(processingOptions)
	    const ttsRequested = ttsTargets.length > 0
	    const imageRequested = imageTargets.length > 0
	    const videoRequested = videoTargets.length > 0
	    const musicRequested = musicTargets.length > 0

	    if ((ttsRequested || imageRequested || musicRequested || videoRequested) && step3Results.length > 0) {
	      if (step3Results.length > 1) {
	        if (ttsRequested) l.warn(`TTS skipped: step 4 only runs when write produces exactly one summary, but ${step3Results.length} LLM outputs were generated`)
	        if (imageRequested) l.warn(`Image gen skipped: cannot determine which of ${step3Results.length} LLM outputs to use`)
	        if (musicRequested) l.warn(`Music gen skipped: cannot determine which of ${step3Results.length} LLM outputs to use`)
	        if (videoRequested) l.warn(`Video gen skipped: cannot determine which of ${step3Results.length} LLM outputs to use`)
	      } else {
	        const textContent = step3RunResults[0]?.renderedText ?? ''
	        ttsCharacterCount = textContent.length

	        const [ttsResult, imageResult, musicResult, videoResult] = await Promise.all([
	          ttsRequested
	            ? runWithLogContext({ step: 'step-4-tts' }, async () => await runTts(textContent, outputDir, processingOptions))
	            : null,
	          imageRequested
	            ? runWithLogContext({ step: 'step-5-image' }, async () => await runImageGen(textContent, outputDir, processingOptions))
	            : null,
	          musicRequested
	            ? runWithLogContext({ step: 'step-7-music' }, async () => await runMusicGen(textContent, outputDir, processingOptions))
	            : null,
	          videoRequested
	            ? runWithLogContext({ step: 'step-6-video' }, async () => await runVideoGen(textContent, outputDir, processingOptions))
	            : null
	        ])

	        step4Metadata = ttsResult?.metadata ?? null
	        step5Metadata = imageResult?.metadata ?? null
	        step7Metadata = musicResult?.metadata ?? null
	        step6Metadata = videoResult?.metadata ?? null
	      }
	    }

	    const step3Serialized = step3Results.length === 1
	      ? step3Results[0]
	      : step3Results.length > 1
	        ? step3Results
	        : undefined

	    const attemptedTtsTargets = step3Results.length === 1 ? ttsTargets : []
	    const attemptedImageTargets = step3Results.length === 1 ? imageTargets : []
	    const attemptedVideoTargets = step3Results.length === 1 ? videoTargets : []
	    const attemptedMusicTargets = step3Results.length === 1 ? musicTargets : []
	    const ttsEstimateTargets = buildEstimatedTtsTargets(attemptedTtsTargets)
	    const imageEstimateTargets = attemptedImageTargets.map((target) => ({
	      service: target.service,
	      model: target.model,
	      count: getExpectedImageCount(target, processingOptions)
	    }))
	    const llmTargets = step3Results.map((s3) => ({
	      service: s3.llmService,
	      model: s3.llmModel,
	      inputTokens: s3.inputTokenCount,
	      outputTokens: s3.outputTokenCount
	    }))
	    const step2EntriesForEstimation = Array.isArray(transcriptionResult.metadata)
	      ? transcriptionResult.metadata
	      : [transcriptionResult.metadata]
	    const selectedSttTargets = step2EntriesForEstimation.map((entry) => ({
	      service: entry.transcriptionService,
	      model: entry.transcriptionModel
	    }))

	    const estimated = preflightEstimate
	      ? preflightToEstimated(preflightEstimate)
	      : computeEstimatedCosts({
	        applyCostMultipliers: false,
	        sttTargets: selectedSttTargets,
	        audioDurationSeconds: mediaDurationSeconds,
	        llmTargets,
	        skipLLM: processingOptions.skipLLM,
	        ttsTargets: ttsEstimateTargets,
	        ttsCharacterCount,
	        imageTargets: imageEstimateTargets,
	        imageSize: processingOptions.imageSize,
	        imageQuality: processingOptions.imageQuality,
	        videoTargets: attemptedVideoTargets.map((target) => ({
	          service: target.service,
	          model: target.model,
	          ...(processingOptions.videoDuration !== undefined ? { durationSeconds: processingOptions.videoDuration } : {})
	        })),
	        videoDuration: processingOptions.videoDuration,
	        videoSize: processingOptions.videoSize,
	        videoAspectRatio: processingOptions.videoAspectRatio,
	        videoResolution: processingOptions.videoResolution,
	        musicTargets: attemptedMusicTargets.map((t) => ({
	          service: t.service,
	          model: t.model,
	          ...(processingOptions.musicDuration !== undefined ? { durationSeconds: processingOptions.musicDuration } : {})
	        })),
	        musicDuration: processingOptions.musicDuration,
	        musicLyricsFile: processingOptions.musicLyricsFile,
	        musicInstrumental: processingOptions.musicInstrumental
	      })

	    const actual = computeActualCosts({
	      step1: step1Metadata,
	      step2: transcriptionResult.metadata,
	      audioDurationSeconds: mediaDurationSeconds,
	      ...(step3Serialized !== undefined ? { step3: step3Serialized } : {}),
	      ...(step4Metadata ? { step4: step4Metadata, ttsCharacterCount } : {}),
	      ...(step5Metadata ? { step5: step5Metadata } : {}),
	      ...(step6Metadata ? { step6: step6Metadata } : {}),
	      ...(step7Metadata ? { step7: step7Metadata } : {})
	    })

	    const cost = { estimated, actual }
	    const estimatedTiming = computeEstimatedProcessingTimes({
	      sttTargets: selectedSttTargets,
	      audioDurationSeconds: mediaDurationSeconds,
	      llmTargets,
	      skipLLM: processingOptions.skipLLM,
	      ttsTargets: ttsEstimateTargets,
	      ttsCharacterCount,
	      ...(imageEstimateTargets.length > 0 ? { imageTargets: imageEstimateTargets } : {}),
	      ...(attemptedVideoTargets.length > 0
	        ? {
	            videoTargets: attemptedVideoTargets.map((t) => ({
	              service: t.service,
	              model: t.model,
	              ...(processingOptions.videoDuration !== undefined ? { durationSeconds: processingOptions.videoDuration } : {})
	            }))
	          }
	        : {}),
	      ...(attemptedMusicTargets.length > 0
	        ? {
	            musicTargets: attemptedMusicTargets.map((t) => ({
	              service: t.service,
	              model: t.model,
	              ...(processingOptions.musicDuration !== undefined ? { durationSeconds: processingOptions.musicDuration } : {})
	            }))
	          }
	        : {}),
	    })
	    const actualTiming = computeActualProcessingTimes({
	      audioDurationSeconds: mediaDurationSeconds,
	      step2: transcriptionResult.metadata,
	      ...(step3Serialized !== undefined ? { step3: step3Serialized } : {}),
	      ...(step4Metadata ? { step4: step4Metadata, ttsCharacterCount } : {}),
	      ...(step5Metadata ? { step5: step5Metadata } : {}),
	      ...(step6Metadata ? { step6: step6Metadata } : {}),
	      ...(step7Metadata ? { step7: step7Metadata } : {}),
	    })
	    const timing = estimatedTiming.steps.length > 0 || actualTiming.steps.length > 0
	      ? { estimated: estimatedTiming, actual: actualTiming }
	      : undefined

	    const captionOnly = successfulSttProviders.length > 0
	      && successfulSttProviders.every((entry) => entry.target.service === YOUTUBE_CAPTIONS_SERVICE)
	    const requestedSttTargets = captionOnly
	      ? successfulSttProviders.map((entry) => entry.target)
	      : sttTargets
	    const successfulKeys = new Set(successfulSttProviders.map((entry) => getSttTargetKey(entry.target)))
	    const failureByKey = new Map<string, typeof sttFailures[number]>(
	      sttFailures.map((failure) => [`${failure.service}:${failure.model}`, failure])
	    )
	    const sttProviderStates = requestedSttTargets.map((target) => {
	      const success = successfulSttProviders.find((entry) => getSttTargetKey(entry.target) === getSttTargetKey(target))
	      if (success) {
	        return {
	          service: target.service,
	          model: target.model,
	          local: target.local,
	          artifactDir: success.relativeDir ?? '.',
	          status: 'succeeded',
	          attempts: 1
	        }
	      }

	      const failure = failureByKey.get(getSttTargetKey(target))
	      if (failure) {
	        return {
	          service: target.service,
	          model: target.model,
	          local: target.local,
	          artifactDir: target.service === YOUTUBE_CAPTIONS_SERVICE ? '.' : `providers/${getSttTargetDirectoryName(target)}`,
	          status: failure.skipped === true ? 'skipped' : 'failed',
	          attempts: 1,
	          retryable: failure.retryable,
	          lastError: {
	            message: failure.message,
	            retryable: failure.retryable,
	            ...(failure.skipped === true ? { skipped: true } : {}),
	            ...(failure.stage ? { stage: failure.stage } : {}),
	            ...(typeof failure.status === 'number' ? { status: failure.status } : {})
	          }
	        }
	      }

	      return {
	        service: target.service,
	        model: target.model,
	        local: target.local,
	        artifactDir: target.service === YOUTUBE_CAPTIONS_SERVICE ? '.' : `providers/${getSttTargetDirectoryName(target)}`,
	        status: 'missing',
	        attempts: 0
	      }
	    })
	    const completionStatus = resolveWriteSttCompletionStatus(requestedSttTargets, successfulSttProviders)
	    const missingProviders = requestedSttTargets
	      .filter((target) => !successfulKeys.has(getSttTargetKey(target)))
	      .map(toRequestedProvider)

	    const processingMetadata = {
	      step1: step1Metadata,
	      step2: serializeOneOrMany(Array.isArray(transcriptionResult.metadata) ? transcriptionResult.metadata : [transcriptionResult.metadata]),
	      completionStatus,
	      requestedProviders: requestedSttTargets.map(toRequestedProvider),
	      providerStates: sttProviderStates,
	      missingProviders,
	      cache: {
	        sourceMedia: preparedSttMedia.cache.sourceMedia
	      },
	      ...(step3Serialized !== undefined ? { step3: step3Serialized } : {}),
	      ...(step4Metadata ? { step4: serializeOneOrMany(step4Metadata) } : {}),
	      ...(step5Metadata ? { step5: serializeOneOrMany(step5Metadata) } : {}),
	      ...(step6Metadata ? { step6: serializeOneOrMany(step6Metadata) } : {}),
	      ...(step7Metadata ? { step7: serializeOneOrMany(step7Metadata) } : {}),
	      cost,
	      ...(timing ? { timing } : {}),
	      ...(sttFailures.length > 0 ? { errors: sttFailures } : {}),
	    }
	    await writeRunManifest(outputDir, 'write', processingMetadata)
	    logWriteManifestConsoleSummary(outputDir, processingMetadata, {
	      promptArtifact: 'prompt.md',
	      ...(step3Results.length === 1 && typeof renderedArtifacts.internalArtifacts['rendered'] === 'string'
	        ? { step3RenderedOutput: renderedArtifacts.internalArtifacts['rendered'] }
	        : {})
	    })

	    const totalTime = Date.now() - processStart
	    const step2Entries = Array.isArray(transcriptionResult.metadata)
	      ? transcriptionResult.metadata
	      : [transcriptionResult.metadata]

	    const stepSummaries: StepTimingCost[] = [
	      {
	        label: 'Download',
	        processingTime: step1Time,
	        cost: 0
	      }
	    ]

	    stepSummaries.push(...buildProviderStepSummaries(
	      'Transcribe',
	      'stt',
	      step2Entries,
	      actual.steps,
	      (entry) => {
	        if (entry.transcriptionService === 'reverb') {
	          return buildTimingProviderModelLabel(entry)
	        }
	        const displayService = entry.transcriptionService === 'whisper' ? 'whisper.cpp' : entry.transcriptionService
	        const displayModel = entry.transcriptionService === 'whisper'
	          ? (processingOptions.whisperModel ?? entry.transcriptionModel)
	          : entry.transcriptionModel
	        return `${displayService}/${displayModel}`
	      },
	      (entry) => entry.processingTime
	    ))

	    if (step3Results.length > 0) {
	      stepSummaries.push(...buildProviderStepSummaries(
	        'LLM',
	        'llm',
	        step3Results,
	        actual.steps,
	        (entry) => `${entry.llmService}/${entry.llmModel}`,
	        (entry) => entry.processingTime
	      ))
	    }

	    if (step4Metadata) {
	      stepSummaries.push(...buildProviderStepSummaries(
	        'TTS',
	        'tts',
	        step4Metadata,
	        actual.steps,
	        (entry) => `${entry.ttsService}/${entry.ttsModel}`,
	        (entry) => entry.processingTime
	      ))
	    }

  if (step5Metadata) {
    stepSummaries.push(...buildProviderStepSummaries(
      'Image',
      'image',
      step5Metadata,
      actual.steps,
      (entry) => `${entry.imageService}/${entry.imageModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step6Metadata) {
    stepSummaries.push(...buildProviderStepSummaries(
      'Video',
      'video',
      step6Metadata,
      actual.steps,
      (entry) => `${entry.videoGenService}/${entry.videoGenModel}`,
      (entry) => entry.processingTime
    ))
  }

  if (step7Metadata) {
    stepSummaries.push(...buildProviderStepSummaries(
      'Music',
      'music',
      step7Metadata,
      actual.steps,
      (entry) => `${entry.musicService}/${entry.musicModel}`,
      (entry) => entry.processingTime
    ))
  }

  const artifactFiles: Record<string, string> = {
    audio: step1Metadata.audioFileName,
    transcript: 'transcription.txt',
    result: 'result.json',
    ...renderedArtifacts.internalArtifacts
  }
  if (step2Entries.some((entry) => entry.transcriptionService === YOUTUBE_CAPTIONS_SERVICE)) {
    artifactFiles['captions'] = 'youtube-captions.vtt'
    artifactFiles['captionMetadata'] = 'youtube-captions.json'
  }
  if (successfulSttProviders.length > 1) {
    for (const provider of successfulSttProviders) {
      if (!provider.relativeDir) {
        continue
      }
      const key = `${provider.metadata.transcriptionService}-${provider.metadata.transcriptionModel}`
      artifactFiles[`transcript-${key}`] = `${provider.relativeDir}/transcription.txt`
      artifactFiles[`result-${key}`] = `${provider.relativeDir}/result.json`
    }
  }
  if (step3Results.length === 1) {
    artifactFiles['summary'] = step3Results[0]?.outputFileName ?? 'text.json'
  } else if (step3Results.length > 1) {
    for (const r of step3Results) {
      artifactFiles[`summary-${r.llmModel}`] = r.outputFileName
    }
  }
  if (step4Metadata) {
    Object.assign(artifactFiles, buildTtsArtifactMap(step4Metadata))
  }
  if (step5Metadata) {
    Object.assign(artifactFiles, buildImageArtifactMap(step5Metadata))
  }
  if (step6Metadata) Object.assign(artifactFiles, buildVideoArtifactMap(step6Metadata))
  if (step7Metadata) Object.assign(artifactFiles, buildMusicArtifactMap(step7Metadata))
  artifactFiles['prompt'] = 'prompt.md'
  artifactFiles['run'] = 'run.json'
  l.report.complete(outputDir, artifactFiles, { steps: stepSummaries, totalTimeMs: totalTime, totalCost: actual.totalCost })

  if (sttFailures.length > 0) {
    l.warn(`write run completed with partial STT failures/skips: ${sttFailures.map((failure) => `${failure.service}/${failure.model}: ${failure.message}`).join('; ')}`)
  }

    return outputDir
  } finally {
    await preparedSttMedia?.cleanup?.()
  }
}
